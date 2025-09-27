import type { GetContractReturnType } from '@nomicfoundation/hardhat-viem/types.js'
import hre from 'hardhat'
import type { ArtifactsMap } from 'hardhat/types'
import { labelhash, namehash, type Address } from 'viem'
import { createInterfaceId } from './createInterfaceId.js'

export const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

type Contracts = {
  [A in keyof ArtifactsMap]: GetContractReturnType<ArtifactsMap[A]['abi']>
}
type AnyContract = Contracts[keyof ArtifactsMap]

export type EnsStack = {
  ensRegistry: Contracts['ENSRegistry']
  root: Contracts['Root']
  reverseRegistrar: Contracts['ReverseRegistrar']
  baseRegistrarImplementation: Contracts['BaseRegistrarImplementation']
  ethOwnedResolver: Contracts['OwnedResolver']
  dummyOracle: Contracts['DummyOracle']
  exponentialPremiumPriceOracle: Contracts['ExponentialPremiumPriceOracle']
  staticMetadataService: Contracts['StaticMetadataService']
  nameWrapper: Contracts['NameWrapper']
  ethRegistrarController: Contracts['ETHRegistrarController']
  staticBulkRenewal: Contracts['StaticBulkRenewal']
  publicResolver: Contracts['PublicResolver']
  universalResolver: Contracts['UniversalResolver']
}

const setRootNodeOwner = async ({
  ensRegistry,
  root,
}: Pick<EnsStack, 'ensRegistry' | 'root'>) => {
  await ensRegistry.write.setOwner([ZERO_HASH, root.address])
}
const setRootSubnodeOwner = async ({
  root,
  label,
  owner: subnodeOwner,
}: Pick<EnsStack, 'root'> & { label: string; owner: { address: Address } }) => {
  const { owner } = await hre.getNamedAccounts()
  return await root.write.setSubnodeOwner(
    [labelhash(label), subnodeOwner.address],
    {
      account: owner as Address,
    },
  )
}
const setAddrReverseNodeOwner = async ({
  ensRegistry,
  reverseRegistrar,
}: Pick<EnsStack, 'ensRegistry' | 'reverseRegistrar'>) => {
  const { owner } = await hre.getNamedAccounts()
  return await ensRegistry.write.setSubnodeOwner(
    [namehash('reverse'), labelhash('addr'), reverseRegistrar.address],
    {
      account: owner as Address,
    },
  )
}
const setBaseRegistrarResolver = async ({
  baseRegistrarImplementation,
  ethOwnedResolver,
}: Pick<EnsStack, 'baseRegistrarImplementation' | 'ethOwnedResolver'>) => {
  const { owner } = await hre.getNamedAccounts()
  return await baseRegistrarImplementation.write.setResolver(
    [ethOwnedResolver.address],
    {
      account: owner as Address,
    },
  )
}
const addBaseRegistrarController = async ({
  baseRegistrarImplementation,
  controller,
}: Pick<EnsStack, 'baseRegistrarImplementation'> & {
  controller: AnyContract
}) => {
  const { owner } = await hre.getNamedAccounts()
  return await baseRegistrarImplementation.write.addController(
    [controller.address],
    {
      account: owner as Address,
    },
  )
}
const setEthResolverInterface = async ({
  ethOwnedResolver,
  interfaceName,
  contract,
}: Pick<EnsStack, 'ethOwnedResolver'> & {
  interfaceName: string
  contract: AnyContract
}) => {
  const { owner } = await hre.getNamedAccounts()
  const contractInterface = await hre.artifacts.readArtifact(interfaceName)
  const interfaceId = createInterfaceId(contractInterface.abi)
  return await ethOwnedResolver.write.setInterface(
    [namehash('eth'), interfaceId, contract.address],
    {
      account: owner as Address,
    },
  )
}
const setReverseDefaultResolver = async ({
  reverseRegistrar,
  contract,
}: Pick<EnsStack, 'reverseRegistrar'> & { contract: AnyContract }) => {
  const { owner } = await hre.getNamedAccounts()
  return await reverseRegistrar.write.setDefaultResolver([contract.address], {
    account: owner as Address,
  })
}

export async function deployEnsStack(): Promise<EnsStack> {
  const ensRegistry = await hre.viem.deployContract('ENSRegistry', [])
  const root = await hre.viem.deployContract('Root', [ensRegistry.address])
  const walletClients = await hre.viem.getWalletClients()

  const owner = walletClients[1].account
  await setRootNodeOwner({ ensRegistry, root })
  await root.write.setController([owner.address, true])
  await root.write.transferOwnership([owner.address])

  const reverseRegistrar = await hre.viem.deployContract('ReverseRegistrar', [
    ensRegistry.address,
  ])

  await reverseRegistrar.write.transferOwnership([owner.address])
  await setRootSubnodeOwner({
    root,
    label: 'reverse',
    owner,
  })
  await setAddrReverseNodeOwner({ ensRegistry, reverseRegistrar })

  const baseRegistrarImplementation = await hre.viem.deployContract(
    'BaseRegistrarImplementation',
    [ensRegistry.address, namehash('eth')],
  )

  await baseRegistrarImplementation.write.transferOwnership([owner.address])
  await setRootSubnodeOwner({
    root,
    label: 'eth',
    owner: baseRegistrarImplementation,
  })

  const ethOwnedResolver = await hre.viem.deployContract('OwnedResolver', [])
  await ethOwnedResolver.write.transferOwnership([owner.address])

  await setBaseRegistrarResolver({
    baseRegistrarImplementation,
    ethOwnedResolver,
  })

  const dummyOracle = await hre.viem.deployContract('DummyOracle', [
    160000000000n,
  ])
  const exponentialPremiumPriceOracle = await hre.viem.deployContract(
    'ExponentialPremiumPriceOracle',
    [
      dummyOracle.address,
      [0n, 0n, 20294266869609n, 5073566717402n, 158548959919n],
      100000000000000000000000000n,
      21n,
    ],
  )

  const staticMetadataService = await hre.viem.deployContract(
    'StaticMetadataService',
    ['http://localhost:8080/name/0x{id}'],
  )
  const nameWrapper = await hre.viem.deployContract('NameWrapper', [
    ensRegistry.address,
    baseRegistrarImplementation.address,
    staticMetadataService.address,
  ])

  await nameWrapper.write.transferOwnership([owner.address])
  await addBaseRegistrarController({
    baseRegistrarImplementation,
    controller: nameWrapper,
  })
  await setEthResolverInterface({
    ethOwnedResolver,
    interfaceName: 'INameWrapper',
    contract: nameWrapper,
  })

  const defaultReverseRegistrar = await hre.viem.deployContract(
    'DefaultReverseRegistrar',
    [],
  )

  const ethRegistrarController = await hre.viem.deployContract(
    'ETHRegistrarController',
    [
      baseRegistrarImplementation.address,
      exponentialPremiumPriceOracle.address,
      60n,
      86400n,
      reverseRegistrar.address,
      defaultReverseRegistrar.address,
      ensRegistry.address,
    ],
  )

  await ethRegistrarController.write.transferOwnership([owner.address])
  await nameWrapper.write.setController(
    [ethRegistrarController.address, true],
    {
      account: owner,
    },
  )
  await reverseRegistrar.write.setController(
    [ethRegistrarController.address, true],
    {
      account: owner,
    },
  )
  await setEthResolverInterface({
    ethOwnedResolver,
    interfaceName: 'IETHRegistrarController',
    contract: ethRegistrarController,
  })

  const staticBulkRenewal = await hre.viem.deployContract('StaticBulkRenewal', [
    ethRegistrarController.address,
  ])

  await setEthResolverInterface({
    ethOwnedResolver,
    interfaceName: 'IBulkRenewal',
    contract: staticBulkRenewal,
  })

  const publicResolver = await hre.viem.deployContract('PublicResolver', [
    ensRegistry.address,
    nameWrapper.address,
    ethRegistrarController.address,
    reverseRegistrar.address,
  ])

  await setReverseDefaultResolver({
    reverseRegistrar,
    contract: publicResolver,
  })

  const batchGatewayProvider = await hre.viem.deployContract(
    'GatewayProvider',
    [owner.address, ['http://universal-offchain-resolver.local/']],
  )

  const universalResolver = await hre.viem.deployContract('UniversalResolver', [
    owner.address,
    ensRegistry.address,
    batchGatewayProvider.address,
  ])

  return {
    ensRegistry,
    root,
    reverseRegistrar,
    baseRegistrarImplementation,
    ethOwnedResolver,
    dummyOracle,
    exponentialPremiumPriceOracle,
    staticMetadataService,
    nameWrapper,
    ethRegistrarController,
    staticBulkRenewal,
    publicResolver,
    universalResolver,
  }
}
