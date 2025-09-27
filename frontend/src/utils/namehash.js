import { ethers } from 'ethers';

export function namehash(name) {
  let node = '0x' + '00'.repeat(32);
  if (name) {
    const labels = name.toLowerCase().split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      node = ethers.keccak256(
        ethers.concat([
          ethers.getBytes(node),
          ethers.keccak256(ethers.toUtf8Bytes(labels[i]))
        ])
      );
    }
  }
  return node;
}
