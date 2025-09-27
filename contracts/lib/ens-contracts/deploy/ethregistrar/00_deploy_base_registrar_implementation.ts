import type { DeployFunction } from 'hardhat-deploy/types.js'
import { namehash } from 'viem/ens'

const func: DeployFunction = async function (hre) {
  const { network, viem } = hre

  if (!network.tags.use_root) {
    return true
  }

  const registry = await viem.getContract('ENSRegistry')

  await viem.deploy('BaseRegistrarImplementation', [
    registry.address,
    namehash('eth'),
  ])
  return true
}

func.id = 'BaseRegistrarImplementation:contract v1.0.0'
func.tags = [
  'category:ethregistrar',
  'BaseRegistrarImplementation',
  'BaseRegistrarImplementation:contract',
]
func.dependencies = ['ENSRegistry']

export default func
