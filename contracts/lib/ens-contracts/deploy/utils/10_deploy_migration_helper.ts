import type { DeployFunction } from 'hardhat-deploy/types.js'

const func: DeployFunction = async function (hre) {
  const { deployments, viem } = hre
  const { deploy } = deployments

  const { deployer, owner } = await viem.getNamedClients()

  const registrar = await viem.getContract('BaseRegistrarImplementation')
  const wrapper = await viem.getContract('NameWrapper')

  await viem.deploy('MigrationHelper', [registrar.address, wrapper.address])

  if (owner !== undefined && owner.address !== deployer.address) {
    const migrationHelper = await viem.getContract('MigrationHelper')
    const hash = await migrationHelper.write.transferOwnership([owner.address])
    console.log(`Transfer ownership to ${owner.address} (tx: ${hash})...`)
    await viem.waitForTransactionSuccess(hash)
  }

  return true
}

func.id = 'MigrationHelper v1.0.0'
func.tags = ['category:utils', 'MigrationHelper']
func.dependencies = ['BaseRegistrarImplementation', 'NameWrapper']

export default func
