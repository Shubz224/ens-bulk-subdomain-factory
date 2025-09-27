import type { DeployFunction } from 'hardhat-deploy/types.js'

const func: DeployFunction = async function (hre) {
  const { network, viem } = hre

  await viem.deploy('RSASHA1Algorithm', [])
  await viem.deploy('RSASHA256Algorithm', [])
  await viem.deploy('P256SHA256Algorithm', [])

  if (network.tags.test) await viem.deploy('DummyAlgorithm', [])

  return true
}

func.id = 'dnssec-algorithms v1.0.0'
func.tags = [
  'category:dnssec-oracle',
  'dnssec-algorithms',
  'RSASHA1Algorithm',
  'RSASHA256Algorithm',
  'P256SHA256Algorithm',
  'DummyAlgorithm',
]
func.dependencies = []

export default func
