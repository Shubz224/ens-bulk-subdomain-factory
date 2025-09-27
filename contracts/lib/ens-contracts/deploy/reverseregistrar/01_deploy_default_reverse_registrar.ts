import type { DeployFunction } from 'hardhat-deploy/types.js'

const func: DeployFunction = async function (hre) {
  const { viem } = hre

  const { owner } = await viem.getNamedClients()

  await viem.deploy('DefaultReverseRegistrar', [])
  const defaultReverseRegistrar = await viem.getContract(
    'DefaultReverseRegistrar',
  )

  const defaultReverseRegistrarOwner =
    await defaultReverseRegistrar.read.owner()
  if (defaultReverseRegistrarOwner !== owner.address) {
    const hash = await defaultReverseRegistrar.write.transferOwnership([
      owner.address,
    ])
    console.log(
      `Transferring ownership of DefaultReverseRegistrar to ${owner.address} (tx: ${hash})...`,
    )
    await viem.waitForTransactionSuccess(hash)
  }

  return true
}

func.id = 'DefaultReverseRegistrar v1.0.0'
func.tags = ['category:reverseregistrar', 'DefaultReverseRegistrar']
func.dependencies = []

export default func
