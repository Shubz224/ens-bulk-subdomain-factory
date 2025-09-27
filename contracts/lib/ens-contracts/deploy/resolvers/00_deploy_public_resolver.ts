import type { DeployFunction } from 'hardhat-deploy/types.js'
import { getAddress, namehash } from 'viem'

const func: DeployFunction = async function (hre) {
  const { viem, network } = hre

  const { owner } = await viem.getNamedClients()

  const registry = await viem.getContract('ENSRegistry', owner)
  const nameWrapper = await viem.getContract('NameWrapper')
  const controller = await viem.getContract('ETHRegistrarController')
  const reverseRegistrar = await viem.getContract('ReverseRegistrar', owner)

  const publicResolverDeployment = await viem.deploy('PublicResolver', [
    registry.address,
    nameWrapper.address,
    controller.address,
    reverseRegistrar.address,
  ])

  // Only attempt to make controller etc changes directly on testnets
  if (network.name === 'mainnet' && !network.tags.tenderly) return

  const isReverseRegistrarDefaultResolver = await reverseRegistrar.read
    .defaultResolver()
    .then((v) => getAddress(v) === getAddress(publicResolverDeployment.address))
  if (!isReverseRegistrarDefaultResolver) {
    const reverseRegistrarSetDefaultResolverHash =
      await reverseRegistrar.write.setDefaultResolver([
        publicResolverDeployment.address,
      ])
    console.log(
      `Setting default resolver on ReverseRegistrar to PublicResolver (tx: ${reverseRegistrarSetDefaultResolverHash})...`,
    )
    await viem.waitForTransactionSuccess(reverseRegistrarSetDefaultResolverHash)
  }

  const resolverEthOwner = await registry.read.owner([namehash('resolver.eth')])

  if (resolverEthOwner === owner.address) {
    const publicResolver = await viem.getContract('PublicResolver', owner)
    const setResolverHash = await registry.write.setResolver([
      namehash('resolver.eth'),
      publicResolver.address,
    ])
    console.log(
      `Setting resolver for resolver.eth to PublicResolver (tx: ${setResolverHash})...`,
    )
    await viem.waitForTransactionSuccess(setResolverHash)

    const setAddrHash = await publicResolver.write.setAddr([
      namehash('resolver.eth'),
      publicResolver.address,
    ])
    console.log(
      `Setting address for resolver.eth to PublicResolver (tx: ${setAddrHash})...`,
    )
    await viem.waitForTransactionSuccess(setAddrHash)
  } else {
    console.log(
      'resolver.eth is not owned by the owner address, not setting resolver',
    )
  }

  return true
}

func.id = 'PublicResolver v3.0.0'
func.tags = ['category:resolvers', 'PublicResolver']
func.dependencies = [
  'ENSRegistry',
  'NameWrapper',
  'ETHRegistrarController',
  'ReverseRegistrar',
]

export default func
