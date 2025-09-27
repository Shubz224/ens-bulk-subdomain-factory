import type { DeployFunction } from 'hardhat-deploy/types.js'
import { namehash, zeroAddress, type Address } from 'viem'
import { createInterfaceId } from '../../test/fixtures/createInterfaceId.js'

const func: DeployFunction = async function (hre) {
  const { deployments, network, viem } = hre

  const { owner } = await viem.getNamedClients()

  const registry = await viem.getContract('ENSRegistry', owner)
  const controller = await viem.getContract('ETHRegistrarController', owner)

  const bulkRenewal = await viem.deploy('StaticBulkRenewal', [
    controller.address,
  ])

  // Only attempt to make resolver etc changes directly on testnets
  if (network.name === 'mainnet' && !network.tags.tenderly) return

  const artifact = await deployments.getArtifact('IBulkRenewal')
  const interfaceId = createInterfaceId(artifact.abi)

  const resolver = await registry.read.resolver([namehash('eth')])
  if (resolver === zeroAddress) {
    console.log(
      `No resolver set for .eth; not setting interface ${interfaceId} for BulkRenewal`,
    )
    return
  }

  const ethOwnedResolver = await viem.getContractAt('OwnedResolver', resolver, {
    client: owner,
  })
  const setInterfaceHash = await ethOwnedResolver.write.setInterface([
    namehash('eth'),
    interfaceId,
    bulkRenewal.address as Address,
  ])
  console.log(
    `Setting BulkRenewal interface ID ${interfaceId} on .eth resolver (tx: ${setInterfaceHash})...`,
  )
  await viem.waitForTransactionSuccess(setInterfaceHash)

  return true
}

func.id = 'StaticBulkRenewal v1.0.0'
func.tags = ['category:ethregistrar', 'StaticBulkRenewal']
func.dependencies = ['ENSRegistry', 'ETHRegistrarController', 'OwnedResolver']

export default func
