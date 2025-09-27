import type { DeployFunction } from 'hardhat-deploy/types.js'

const func: DeployFunction = async function (hre) {
  const { network, viem } = hre

  await viem.deploy('SHA1Digest', [])
  await viem.deploy('SHA256Digest', [])

  if (network.tags.test) await viem.deploy('DummyDigest', [])

  return true
}

func.id = 'dnssec-digests v1.0.0'
func.tags = [
  'category:dnssec-oracle',
  'dnssec-digests',
  'SHA1Digest',
  'SHA256Digest',
  'DummyDigest',
]
func.dependencies = []

export default func
