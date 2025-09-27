import type { DeployFunction } from 'hardhat-deploy/types.js'

const func: DeployFunction = async function (hre) {
  const { network, viem } = hre

  if (!network.tags.use_root) {
    return true
  }

  const registry = await viem.getContract('ENSRegistry')

  await viem.deploy('Root', [registry.address])

  return true
}

func.id = 'Root:contract v1.0.0'
func.tags = ['category:root', 'Root', 'Root:contract']
func.dependencies = ['ENSRegistry']

export default func
