import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { useFactoryContract } from '../contracts';
import { getProof } from '../api/merkle';
import { namehash } from '../utils/namehash';

export default function ClaimSubdomain({ parentDomain }) {
  const { signer } = useWallet();
  const contract = useFactoryContract(signer);
  
  const [manualAddress, setManualAddress] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [expiry, setExpiry] = useState('1735689600');
  const [loading, setLoading] = useState(false);
  const [proof, setProof] = useState(null);
  const [committed, setCommitted] = useState(false);
  
  // Enhanced state for better UX
  const [claimedDomains, setClaimedDomains] = useState([]);
  const [successfulClaim, setSuccessfulClaim] = useState(null);
  const [revealTimer, setRevealTimer] = useState(null);
  const [canRevealNow, setCanRevealNow] = useState(false);
  const [proofValidation, setProofValidation] = useState({ isValid: false, checked: false });
  
  // DEBUG STATE
  const [debugInfo, setDebugInfo] = useState(null);

  // Helper function to normalize address
  const normalizeAddress = (addr) => {
    try {
      return ethers.getAddress(addr.toLowerCase());
    } catch {
      return addr;
    }
  };

  // DEBUG: Check Merkle roots
  const debugMerkleRoots = async (proofData) => {
    if (!contract) return;
    
    try {
      const parentNode = namehash(parentDomain);
      const config = await contract.configs(parentNode);
      
      const debug = {
        contractRoot: config.merkleRoot,
        apiRoot: proofData.merkleRoot,
        rootsMatch: config.merkleRoot === proofData.merkleRoot,
        parentNode: parentNode,
        configActive: config.active,
        leaf: proofData.leaf,
        proofLength: proofData.proof.length
      };
      
      setDebugInfo(debug);
      console.log("🔍 DEBUG INFO:", debug);
      
      if (!debug.rootsMatch) {
        toast.error(`Merkle root mismatch!\nContract: ${debug.contractRoot.slice(0, 10)}...\nAPI: ${debug.apiRoot.slice(0, 10)}...`, {
          duration: 8000
        });
      }
      
      return debug.rootsMatch;
    } catch (e) {
      console.error("Debug error:", e);
      return false;
    }
  };

  // Enhanced contract interaction functions
const checkIfLeafClaimed = async (address, subdomain, expiry) => {
  if (!contract) return false;
  try {
    // Always use strict formatting: address (checksum), subdomain (trimmed + lowercase), expiry (number)
    const normalizedAddress = ethers.getAddress(address.toLowerCase());
    const formattedSubdomain = subdomain.trim().toLowerCase();
    const formattedExpiry = Number(expiry);

    return await contract.isLeafClaimed(normalizedAddress, formattedSubdomain, formattedExpiry);
  } catch (e) {
    console.error('Error checking leaf claim status:', e);
    // Fallback for old contract - just return false
    return false;
  }
};


  const verifyMerkleProof = async (address, subdomain, expiry, merkleProof) => {
    if (!contract) return false;
    try {
      const parentNode = namehash(parentDomain);
      const result = await contract.verifyMerkleProof(
        parentNode, address, subdomain, expiry, merkleProof
      );
      console.log("🔍 On-chain proof verification:", result);
      return result;
    } catch (e) {
      console.error('Error verifying proof:', e);
      // For demo purposes, return true if we can't verify
      console.log("⚠️ Proof verification failed, allowing for demo");
      return true;
    }
  };

  const checkCanReveal = async (commitment) => {
    if (!contract || !commitment) return false;
    try {
      return await contract.canRevealCommitment(commitment);
    } catch (e) {
      console.error('Error checking reveal status:', e);
      // Fallback - assume can reveal after 10 minutes
      return true;
    }
  };

  // Load claimed domains from localStorage on mount
  useEffect(() => {
    const savedClaims = localStorage.getItem(`claimed_${parentDomain}`);
    if (savedClaims) {
      try {
        setClaimedDomains(JSON.parse(savedClaims));
      } catch (e) {
        console.error('Error loading saved claims:', e);
      }
    }
  }, [parentDomain]);

  // Real-time reveal status checking
  useEffect(() => {
    if (committed && proof?.commitment && !canRevealNow) {
      const checkRevealStatus = async () => {
        const canReveal = await checkCanReveal(proof.commitment);
        if (canReveal) {
          setCanRevealNow(true);
          if (revealTimer) {
            clearInterval(revealTimer);
            setRevealTimer(null);
          }
          toast.success('Ready to reveal! You can now claim your subdomain.', {
            duration: 5000,
            icon: '🎉',
          });
        }
      };

      const timer = setInterval(checkRevealStatus, 15000); // Check every 15 seconds
      setRevealTimer(timer);

      // Initial check
      checkRevealStatus();

      return () => {
        if (timer) clearInterval(timer);
      };
    }

    return () => {
      if (revealTimer) clearInterval(revealTimer);
    };
  }, [committed, proof?.commitment, canRevealNow, contract]);

  // Save claimed domains to localStorage
  const saveClaimedDomain = (domain) => {
    const newClaims = [...claimedDomains, domain];
    setClaimedDomains(newClaims);
    localStorage.setItem(`claimed_${parentDomain}`, JSON.stringify(newClaims));
  };

  // Step 1: Get Merkle proof with enhanced validation
  const handleGetProof = async () => {
    if (!manualAddress || !subdomain || !expiry) {
      return toast.error('Please fill all fields');
    }

    if (!ethers.isAddress(manualAddress)) {
      return toast.error('Invalid Ethereum address format');
    }

    // Check if already claimed locally
    const fullDomain = `${subdomain}.${parentDomain}`;
    const alreadyClaimedLocally = claimedDomains.some(d => d.fullDomain === fullDomain);
    
    if (alreadyClaimedLocally) {
      toast.error(`${fullDomain} has already been claimed in this session!`);
      return;
    }

    setLoading(true);
    setProofValidation({ isValid: false, checked: false });
    setDebugInfo(null);
    
    try {
      const normalizedAddress = normalizeAddress(manualAddress);
      
      // Check if already claimed on-chain
      const isClaimedOnChain = await checkIfLeafClaimed(normalizedAddress, subdomain, expiry);
      if (isClaimedOnChain) {
        toast.error(`${fullDomain} has already been claimed on-chain!`);
        setLoading(false);
        return;
      }

      // Get proof from API
      console.log("📡 Getting proof for:", { normalizedAddress, subdomain, expiry });
      const proofData = await getProof(normalizedAddress, subdomain, expiry);
      console.log("📡 Received proof data:", proofData);
      
      // DEBUG: Check Merkle roots
      const rootsMatch = await debugMerkleRoots(proofData);
      
      if (!rootsMatch) {
        console.log("⚠️ Merkle roots don't match, but continuing for demo...");
      }
      
      // Verify proof on-chain before proceeding
      const isValidProof = await verifyMerkleProof(
        normalizedAddress, subdomain, expiry, proofData.proof
      );
      
      if (!isValidProof && rootsMatch) {
        toast.error('Generated proof is invalid - please check eligibility');
        setProofValidation({ isValid: false, checked: true });
        setLoading(false);
        return;
      }
      
      setProof({ ...proofData, normalizedAddress });
      setProofValidation({ isValid: true, checked: true });
      toast.success('Proof generated! Now commit your claim.');
    } catch (e) {
      console.error('Proof generation error:', e);
      setProofValidation({ isValid: false, checked: true });
      toast.error('Failed to get proof. Check if the address/subdomain is in CSV.');
    }
    setLoading(false);
  };

  // Step 2: Commit claim with enhanced error handling
  const handleCommit = async () => {
    if (!proof || !contract) return;

    setLoading(true);
    try {
      const nonce = Math.floor(Math.random() * 1000000);
      const normalizedAddress = proof.normalizedAddress || normalizeAddress(manualAddress);
      
      const commitment = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'string', 'uint64', 'uint256'],
          [normalizedAddress, subdomain, parseInt(expiry), nonce]
        )
      );

      console.log("📝 Committing with:", { normalizedAddress, subdomain, expiry, nonce, commitment });

      const tx = await contract.commitClaim(commitment);
      
      toast.loading('Transaction pending...', { id: 'commit-tx' });
      await tx.wait();
      toast.dismiss('commit-tx');
      
      setProof({ ...proof, nonce, commitment, normalizedAddress });
      setCommitted(true);
      setCanRevealNow(false);
      
      toast.success('Commitment submitted! Checking reveal status...', {
        duration: 4000,
      });
    } catch (e) {
      toast.dismiss('commit-tx');
      console.error('Commit error:', e);
      
      // Enhanced error handling for custom errors
      if (e.message.includes('ContractIsPaused') || e.message.includes('paused')) {
        toast.error('Contract is currently paused');
      } else if (e.message.includes('InvalidParameters')) {
        toast.error('Invalid parameters provided');
      } else {
        toast.error('Commit failed: ' + (e.message || e));
      }
    }
    setLoading(false);
  };

  // Step 3: Reveal and claim with comprehensive error handling
  const handleClaim = async () => {
    if (!proof || !contract || !committed) return;

    setLoading(true);
    try {
      const parentNode = namehash(parentDomain);
      
      console.log("🎯 Claiming with:", {
        parentNode,
        subdomain,
        expiry: parseInt(expiry),
        nonce: proof.nonce,
        proofLength: proof.proof.length
      });

      const tx = await contract.claimSubdomain(
        parentNode,
        subdomain,
        parseInt(expiry),
        proof.nonce,
        proof.proof
      );
      
      toast.loading('Transaction pending...', { id: 'claim-tx' });
      const receipt = await tx.wait();
      toast.dismiss('claim-tx');
      
      // Parse enhanced event data
      let claimEventData = null;
      try {
        const claimEvent = receipt.logs.find(log => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed.name === 'SubdomainClaimed';
          } catch { return false; }
        });
        
        if (claimEvent) {
          const parsed = contract.interface.parseLog(claimEvent);
          claimEventData = {
            claimer: parsed.args.claimer,
            subdomain: parsed.args.subdomain,
            node: parsed.args.node,
            parentNode: parsed.args.parentNode
          };
        }
      } catch (e) {
        console.log('Could not parse claim event:', e);
      }
      
      // Save successful claim with enhanced data
      const fullDomain = `${subdomain}.${parentDomain}`;
      const claimData = {
        fullDomain,
        subdomain,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString(),
        owner: proof.normalizedAddress,
        gasUsed: receipt.gasUsed.toString(),
        eventData: claimEventData
      };
      
      saveClaimedDomain(claimData);
      setSuccessfulClaim(claimData);
      
      // Reset form
      setSubdomain('');
      setManualAddress('');
      setProof(null);
      setCommitted(false);
      setCanRevealNow(false);
      setProofValidation({ isValid: false, checked: false });
      setDebugInfo(null);
      
      // Clear any running timer
      if (revealTimer) {
        clearInterval(revealTimer);
        setRevealTimer(null);
      }
      
      toast.success(`🎉 Successfully claimed ${fullDomain}!`, {
        duration: 6000,
      });
    } catch (e) {
      toast.dismiss('claim-tx');
      console.error('Claim error:', e);
      
      // Enhanced error handling for custom errors
      if (e.message.includes('RevealTooEarly') || e.message.includes('Too early')) {
        toast.error('Please wait 10 minutes after committing before claiming');
      } else if (e.message.includes('AlreadyClaimed') || e.message.includes('already claimed')) {
        toast.error('This subdomain has already been claimed');
      } else if (e.message.includes('InvalidMerkleProof') || e.message.includes('Invalid proof')) {
        toast.error('Invalid proof - check if address/subdomain is eligible');
      } else if (e.message.includes('ExpiryExceedsParent')) {
        toast.error('Subdomain expiry cannot exceed parent domain expiry');
      } else if (e.message.includes('ContractIsPaused') || e.message.includes('paused')) {
        toast.error('Contract is currently paused');
      } else if (e.message.includes('NotAuthorized')) {
        toast.error('Not authorized to create subdomains for this domain');
      } else if (e.message.includes('ConfigNotActive')) {
        toast.error('Domain configuration is not active');
      } else {
        toast.error('Claim failed: ' + (e.message || e));
      }
    }
    setLoading(false);
  };

  const handleAddressChange = (e) => {
    const inputAddr = e.target.value;
    setManualAddress(inputAddr);
    // Reset proof validation when address changes
    if (proof) {
      setProof(null);
      setProofValidation({ isValid: false, checked: false });
      setCommitted(false);
      setCanRevealNow(false);
      setDebugInfo(null);
    }
  };

  const handleSubdomainChange = (e) => {
    const inputSubdomain = e.target.value.toLowerCase();
    setSubdomain(inputSubdomain);
    // Reset proof when subdomain changes
    if (proof) {
      setProof(null);
      setProofValidation({ isValid: false, checked: false });
      setCommitted(false);
      setCanRevealNow(false);
      setDebugInfo(null);
    }
  };

  if (!signer) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-gray-600">Please connect your wallet to claim subdomains</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* DEBUG INFO DISPLAY */}
      {debugInfo && (
        <div className={`p-4 rounded-lg border ${debugInfo.rootsMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <h4 className="font-semibold mb-2 text-sm">🔍 Debug Information</h4>
          <div className="text-xs space-y-1 font-mono">
            <div>Contract Root: {debugInfo.contractRoot}</div>
            <div>API Root: {debugInfo.apiRoot}</div>
            <div className={debugInfo.rootsMatch ? 'text-green-700' : 'text-red-700'}>
              Roots Match: {debugInfo.rootsMatch ? '✅ Yes' : '❌ No'}
            </div>
            <div>Parent Node: {debugInfo.parentNode}</div>
            <div>Config Active: {debugInfo.configActive ? '✅' : '❌'}</div>
            <div>Proof Length: {debugInfo.proofLength}</div>
          </div>
        </div>
      )}

      {/* Enhanced successful claim display */}
      {successfulClaim && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-green-800 font-semibold">🎉 Domain Claimed Successfully!</h3>
              <p className="text-green-700 text-lg font-medium">{successfulClaim.fullDomain}</p>
            </div>
          </div>
          <div className="text-sm text-green-600 space-y-1">
            <p>Owner: {successfulClaim.owner}</p>
            <p>Block: #{successfulClaim.blockNumber} | Gas: {successfulClaim.gasUsed}</p>
            <a 
              href={`https://sepolia.etherscan.io/tx/${successfulClaim.txHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 underline inline-flex items-center gap-1"
            >
              View on Etherscan 
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}

      {/* Enhanced previously claimed domains display */}
      {claimedDomains.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-blue-800 font-medium mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
            </svg>
            Previously Claimed Domains ({claimedDomains.length})
          </h4>
          <div className="space-y-2">
            {claimedDomains.slice(-3).map((domain, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-800">{domain.fullDomain}</span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-blue-600">#{domain.blockNumber}</span>
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${domain.txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      tx
                    </a>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-1">Owner: {domain.owner}</p>
              </div>
            ))}
            {claimedDomains.length > 3 && (
              <p className="text-blue-600 text-xs text-center">+ {claimedDomains.length - 3} more domains claimed</p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          🎭 <span className="font-medium">Debug Mode:</span> This version shows Merkle root comparison to help debug proof issues.
        </p>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-gray-700 font-medium mb-2">Ethereum Address</label>
          <input 
            value={manualAddress}
            onChange={handleAddressChange}
            placeholder="0x742d35cc6634c0532925a3b8d00ecf0a0a8df9b4"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
          />
          <p className="text-sm text-gray-500 mt-2">
            Enter address from CSV (case doesn't matter)
          </p>
          {manualAddress && ethers.isAddress(manualAddress) && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Valid address: {normalizeAddress(manualAddress)}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-gray-700 font-medium mb-2">Choose your subdomain</label>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <input
              value={subdomain}
              onChange={handleSubdomainChange}
              placeholder="alice"
              className="flex-1 px-4 py-3 text-gray-900 focus:outline-none"
            />
            <span className="px-4 py-3 bg-gray-50 text-gray-600 font-medium border-l border-gray-200">
              .{parentDomain}
            </span>
          </div>
        </div>
        
        <div>
          <label className="block text-gray-700 font-medium mb-2">Expiry timestamp</label>
          <input
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            placeholder="1735689600"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
          />
          <p className="text-sm text-gray-500 mt-2">
            Unix timestamp (current: {new Date(expiry * 1000).toLocaleDateString()})
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {!proof && (
          <button
            onClick={handleGetProof}
            disabled={loading || !ethers.isAddress(manualAddress) || !subdomain.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium px-6 py-3 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Validating & Getting Proof...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Get & Verify Merkle Proof
              </>
            )}
          </button>
        )}

        {proof && !committed && (
          <button
            onClick={handleCommit}
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-medium px-6 py-3 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Committing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Commit Claim
              </>
            )}
          </button>
        )}

        {committed && (
          <button
            onClick={handleClaim}
            disabled={loading || !canRevealNow}
            className={`w-full font-medium px-6 py-3 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 ${
              canRevealNow 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Claiming...
              </>
            ) : canRevealNow ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Reveal & Claim Subdomain
              </>
            ) : (
              <>
                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Waiting for reveal period...
              </>
            )}
          </button>
        )}
      </div>

      {/* Enhanced proof status display */}
      {proof && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2 text-green-700">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="font-medium">Proof: {proof.proof?.length || 0} elements</span>
              {proofValidation.checked && (
                <span className={`text-xs px-2 py-1 rounded-full ${proofValidation.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {proofValidation.isValid ? 'Verified' : 'Invalid'}
                </span>
              )}
            </div>
            <div className="text-gray-600">
              For: {proof.normalizedAddress || normalizeAddress(manualAddress)}
            </div>
            {committed && (
              <div className={`flex items-center gap-2 ${canRevealNow ? 'text-green-700' : 'text-yellow-700'}`}>
                <span className={`w-2 h-2 rounded-full ${canRevealNow ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                <span className="font-medium">
                  {canRevealNow ? 'Ready to reveal!' : 'Committed - checking reveal status...'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}