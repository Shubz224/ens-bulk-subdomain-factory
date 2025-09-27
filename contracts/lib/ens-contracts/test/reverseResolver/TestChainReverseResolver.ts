import { shouldSupportInterfaces } from '@ensdomains/hardhat-chai-matchers-viem/behaviour'
import { serve } from '@namestone/ezccip/serve'
import { loadFixture } from '@nomicfoundation/hardhat-toolbox-viem/network-helpers.js'
import { Gateway, UncheckedRollup } from '@unruggable/gateways'
import { expect } from 'chai'
import { BrowserProvider } from 'ethers/providers'
import hre from 'hardhat'
import { namehash, slice } from 'viem'
import { deployArtifact } from '../fixtures/deployArtifact.js'
import { deployDefaultReverseFixture } from '../fixtures/deployDefaultReverseFixture.js'
import { dnsEncodeName } from '../fixtures/dnsEncodeName.js'
import {
  chainFromCoinType,
  COIN_TYPE_DEFAULT,
  getReverseName,
  getReverseNamespace,
} from '../fixtures/ensip19.js'
import { urgArtifact } from '../fixtures/externalArtifacts.js'
import { KnownProfile, makeResolutions } from '../utils/resolutions.js'

const testName = 'test.eth'
const l2CoinType = COIN_TYPE_DEFAULT | 12345n // any evm chain

async function fixture() {
  const F = await deployDefaultReverseFixture()
  const gateway = new Gateway(
    new UncheckedRollup(new BrowserProvider(hre.network.provider)),
  )
  gateway.disableCache()
  const ccip = await serve(gateway, { protocol: 'raw', log: false })
  after(ccip.shutdown)
  const GatewayVM = await deployArtifact({
    file: urgArtifact('GatewayVM'),
  })
  const verifierAddress = await deployArtifact({
    file: urgArtifact('UncheckedVerifier'),
    args: [[ccip.endpoint]],
    libs: { GatewayVM },
  })
  const reverseRegistrar = await hre.viem.deployContract('L2ReverseRegistrar', [
    l2CoinType,
  ])
  const reverseResolver = await hre.viem.deployContract(
    'ChainReverseResolver',
    [
      F.owner,
      l2CoinType,
      F.defaultReverseRegistrar.address,
      reverseRegistrar.address,
      verifierAddress,
      [ccip.endpoint],
    ],
    {
      client: {
        public: await hre.viem.getPublicClient({ ccipRead: undefined }),
      },
    },
  )
  const reverseNamespace = getReverseNamespace(l2CoinType)
  await F.takeControl(reverseNamespace)
  await F.ensRegistry.write.setResolver([
    namehash(reverseNamespace),
    reverseResolver.address,
  ])
  return {
    ...F,
    reverseNamespace,
    reverseRegistrar,
    reverseResolver,
  }
}

describe('ChainReverseResolver', () => {
  shouldSupportInterfaces({
    contract: () => loadFixture(fixture).then((F) => F.reverseResolver),
    interfaces: [
      '@openzeppelin/contracts-v5/utils/introspection/IERC165.sol:IERC165',
      'IExtendedResolver',
      'INameReverser',
    ],
  })

  it('coinType()', async () => {
    const F = await loadFixture(fixture)
    await expect(F.reverseResolver.read.coinType()).resolves.toStrictEqual(
      l2CoinType,
    )
  })

  it('chainId()', async () => {
    const F = await loadFixture(fixture)
    await expect(F.reverseResolver.read.chainId()).resolves.toStrictEqual(
      chainFromCoinType(l2CoinType),
    )
  })

  describe('resolve()', () => {
    it('unsupported profile', async () => {
      const F = await loadFixture(fixture)
      const kp: KnownProfile = {
        name: getReverseName(F.owner),
        texts: [{ key: 'dne', value: 'abc' }],
      }
      const [res] = makeResolutions(kp)
      await expect(F.reverseResolver)
        .read('resolve', [dnsEncodeName(kp.name), res.call])
        .toBeRevertedWithCustomError('UnsupportedResolverProfile')
        .withArgs(slice(res.call, 0, 4))
    })

    it('addr("{coinType}.reverse") = registrar', async () => {
      const F = await loadFixture(fixture)
      const kp: KnownProfile = {
        name: F.reverseNamespace,
        addresses: [
          { coinType: l2CoinType, value: F.reverseRegistrar.address },
          { coinType: l2CoinType + 1n, value: '0x' },
        ],
      }
      for (const res of makeResolutions(kp)) {
        res.expect(
          await F.reverseResolver.read.resolve([
            dnsEncodeName(kp.name),
            res.call,
          ]),
        )
      }
    })

    it('unset name()', async () => {
      const F = await loadFixture(fixture)
      const kp: KnownProfile = {
        name: getReverseName(F.owner, l2CoinType),
        primary: { value: '' },
      }
      const [res] = makeResolutions(kp)
      res.expect(
        await F.reverseResolver.read.resolve([
          dnsEncodeName(kp.name),
          res.call,
        ]),
      )
    })

    it('name()', async () => {
      const F = await loadFixture(fixture)
      await F.reverseRegistrar.write.setName([testName])
      const kp: KnownProfile = {
        name: getReverseName(F.owner, l2CoinType),
        primary: { value: testName },
      }
      const [res] = makeResolutions(kp)
      res.expect(
        await F.reverseResolver.read.resolve([
          dnsEncodeName(kp.name),
          res.call,
        ]),
      )
    })

    it('name() w/fallback', async () => {
      const F = await loadFixture(fixture)
      await F.defaultReverseRegistrar.write.setName([testName])
      const kp: KnownProfile = {
        name: getReverseName(F.owner, l2CoinType),
        primary: { value: testName },
      }
      const [res] = makeResolutions(kp)
      res.expect(
        await F.reverseResolver.read.resolve([
          dnsEncodeName(kp.name),
          res.call,
        ]),
      )
    })
  })

  describe('resolveNames()', () => {
    it('empty', async () => {
      const F = await loadFixture(fixture)
      await expect(
        F.reverseResolver.read.resolveNames([[], 255]),
      ).resolves.toStrictEqual([])
    })

    it('multiple pages', async () => {
      const F = await loadFixture(fixture)
      const wallets = await hre.viem.getWalletClients()
      for (const w of wallets) {
        await F.reverseRegistrar.write.setName([w.uid], { account: w.account })
      }
      await expect(
        F.reverseResolver.read.resolveNames([
          wallets.map((x) => x.account.address),
          3,
        ]),
      ).resolves.toStrictEqual(wallets.map((x) => x.uid))
    })

    it('1 chain + 1 default + 1 unset', async () => {
      const F = await loadFixture(fixture)
      const wallets = await hre.viem.getWalletClients()
      await F.reverseRegistrar.write.setName(['A'], {
        account: wallets[0].account,
      })
      await F.defaultReverseRegistrar.write.setName(['B'], {
        account: wallets[1].account,
      })
      await expect(
        F.reverseResolver.read.resolveNames([
          wallets.slice(0, 3).map((x) => x.account.address),
          255,
        ]),
      ).resolves.toStrictEqual(['A', 'B', ''])
    })
  })
})
