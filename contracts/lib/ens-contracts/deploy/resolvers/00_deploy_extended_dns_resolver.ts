import type { DeployFunction } from 'hardhat-deploy/types.js'

const func: DeployFunction = async function (hre) {
  const { viem } = hre

  await viem.deploy('ExtendedDNSResolver', [])

  return true
}

func.id = 'ExtendedDNSResolver v1.0.0'
func.tags = ['category:resolvers', 'ExtendedDNSResolver']
func.dependencies = []

export default func
