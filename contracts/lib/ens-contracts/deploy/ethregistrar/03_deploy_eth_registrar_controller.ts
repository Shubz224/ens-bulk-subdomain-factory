import type { DeployFunction } from 'hardhat-deploy/types.js'
import { getAddress, namehash, zeroAddress } from 'viem'
import { createInterfaceId } from '../../test/fixtures/createInterfaceId.js'

const func: DeployFunction = async function (hre) {
  const { deployments, network, viem } = hre

  const { deployer, owner } = await viem.getNamedClients()

  const registry = await viem.getContract('ENSRegistry', owner)

  const registrar = await viem.getContract('BaseRegistrarImplementation', owner)
  const priceOracle = await viem.getContract(
    'ExponentialPremiumPriceOracle',
    owner,
  )
  const reverseRegistrar = await viem.getContract('ReverseRegistrar', owner)
  const defaultReverseRegistrar = await viem.getContract(
    'DefaultReverseRegistrar',
  )

  await viem.deploy('ETHRegistrarController', [
    registrar.address,
    priceOracle.address,
    60n,
    86400n,
    reverseRegistrar.address,
    defaultReverseRegistrar.address,
    registry.address,
  ])
  const controller = await viem.getContract('ETHRegistrarController')

  const controllerOwner = await controller.read.owner()
  if (controllerOwner !== owner.address) {
    const hash = await controller.write.transferOwnership([owner.address])
    console.log(
      `Transferring ownership of ETHRegistrarController to ${owner.address} (tx: ${hash})...`,
    )
    await viem.waitForTransactionSuccess(hash)
  }

  // Only attempt to make controller etc changes directly on testnets
  if (network.name === 'mainnet' && !network.tags.tenderly) return

  const isRegistrarController = await registrar.read.controllers([
    controller.address,
  ])
  if (!isRegistrarController) {
    const registrarAddControllerHash = await registrar.write.addController([
      controller.address,
    ])
    console.log(
      `Adding ETHRegistrarController as a controller of BaseRegistrarImplementation (tx: ${registrarAddControllerHash})...`,
    )
    await viem.waitForTransactionSuccess(registrarAddControllerHash)
  }

  const isReverseRegistrarController = await reverseRegistrar.read.controllers([
    controller.address,
  ])
  if (!isReverseRegistrarController) {
    const reverseRegistrarSetControllerHash =
      await reverseRegistrar.write.setController([controller.address, true])
    console.log(
      `Adding ETHRegistrarController as a controller of ReverseRegistrar (tx: ${reverseRegistrarSetControllerHash})...`,
    )
    await viem.waitForTransactionSuccess(reverseRegistrarSetControllerHash)
  }

  const isDefaultReverseRegistrarController =
    await defaultReverseRegistrar.read.controllers([controller.address])
  if (!isDefaultReverseRegistrarController) {
    const defaultReverseRegistrarSetControllerHash =
      await defaultReverseRegistrar.write.setController([
        controller.address,
        true,
      ])
    console.log(
      `Adding ETHRegistrarController as a controller of DefaultReverseRegistrar (tx: ${defaultReverseRegistrarSetControllerHash})...`,
    )
    await viem.waitForTransactionSuccess(
      defaultReverseRegistrarSetControllerHash,
    )
  }

  const artifact = await deployments.getArtifact('IETHRegistrarController')
  const interfaceId = createInterfaceId(artifact.abi)

  const resolver = await registry.read.resolver([namehash('eth')])
  if (resolver === zeroAddress) {
    console.log(
      `No resolver set for .eth; not setting interface ${interfaceId} for ETH Registrar Controller`,
    )
    return
  }

  const ethOwnedResolver = await viem.getContractAt('OwnedResolver', resolver, {
    client: owner,
  })
  const hasInterfaceSet = await ethOwnedResolver.read
    .interfaceImplementer([namehash('eth'), interfaceId])
    .then((v) => getAddress(v) === getAddress(controller.address))
  if (!hasInterfaceSet) {
    const setInterfaceHash = await ethOwnedResolver.write.setInterface([
      namehash('eth'),
      interfaceId,
      controller.address,
    ])
    console.log(
      `Setting ETHRegistrarController interface ID ${interfaceId} on .eth resolver (tx: ${setInterfaceHash})...`,
    )
    await viem.waitForTransactionSuccess(setInterfaceHash)
  }

  return true
}

func.id = 'ETHRegistrarController v3.0.0'
func.tags = ['category:ethregistrar', 'ETHRegistrarController']
func.dependencies = [
  'ENSRegistry',
  'BaseRegistrarImplementation',
  'ExponentialPremiumPriceOracle',
  'ReverseRegistrar',
  'DefaultReverseRegistrar',
  'NameWrapper',
  'OwnedResolver',
]

export default func
