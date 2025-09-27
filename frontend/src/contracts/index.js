import { ethers } from 'ethers';

const ABI = [
  // Main functions
  "function initializeConfig(bytes32 parentNode, string calldata domain, bytes32 merkleRoot, uint32 fuses, uint256 totalSubdomains) external",
  "function commitClaim(bytes32 commitment) external",
  "function claimSubdomain(bytes32 parentNode, string calldata subdomain, uint64 expiry, uint256 nonce, bytes32[] calldata merkleProof) external",
  
  // View functions
  "function getConfigStats(bytes32 parentNode) external view returns (uint256 total, uint256 claimed, string memory domain, address owner, bool active)",
  
  // Admin functions
  "function setDefaultResolver(address resolver) external",
  "function pause() external",
  "function unpause() external",
  "function setDefaultTTL(uint64 ttl) external",
  
  // Public variables
  "function nameWrapper() external view returns (address)",
  "function defaultResolver() external view returns (address)",
  "function defaultTTL() external view returns (uint64)",
  "function paused() external view returns (bool)",
  "function configs(bytes32) external view returns (bytes32 merkleRoot, bytes32 parentNode, string memory parentDomain, address parentOwner, uint32 defaultFuses, bool active, uint256 totalSubdomains, uint256 claimedCount)",
  "function claimed(bytes32) external view returns (bool)",
  "function hasClaimed(address) external view returns (bool)",
  "function commitments(bytes32) external view returns (uint256)",
  
  // Events
  "event SubdomainClaimed(address indexed claimer, string subdomain, bytes32 indexed node)",
  "event ConfigInitialized(bytes32 indexed parentNode, string domain, address owner)",
  "event ContractPaused(bool isPaused)",
  "event DefaultResolverSet(address resolver)"
];

export const address = process.env.REACT_APP_FACTORY_ADDRESS;

export function useFactoryContract(signer) {
  if (!signer) return null;
  return new ethers.Contract(process.env.REACT_APP_FACTORY_ADDRESS, ABI, signer);
}
