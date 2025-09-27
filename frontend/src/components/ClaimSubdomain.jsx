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
  
  // Add state for claimed domains tracking
  const [claimedDomains, setClaimedDomains] = useState([]);
  const [successfulClaim, setSuccessfulClaim] = useState(null);

  // Helper function to normalize address
  const normalizeAddress = (addr) => {
    try {
      return ethers.getAddress(addr.toLowerCase());
    } catch {
      return addr;
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

  // Save claimed domains to localStorage
  const saveClaimedDomain = (domain) => {
    const newClaims = [...claimedDomains, domain];
    setClaimedDomains(newClaims);
    localStorage.setItem(`claimed_${parentDomain}`, JSON.stringify(newClaims));
  };

  // Step 1: Get Merkle proof
  const handleGetProof = async () => {
    if (!manualAddress || !subdomain || !expiry) {
      return toast.error('Please fill all fields');
    }

    if (!ethers.isAddress(manualAddress)) {
      return toast.error('Invalid Ethereum address format');
    }

    // Check if already claimed
    const fullDomain = `${subdomain}.${parentDomain}`;
    const alreadyClaimed = claimedDomains.some(d => d.fullDomain === fullDomain);
    
    if (alreadyClaimed) {
      toast.error(`${fullDomain} has already been claimed in this session!`);
      return;
    }

    setLoading(true);
    try {
      const normalizedAddress = normalizeAddress(manualAddress);
      const proofData = await getProof(normalizedAddress, subdomain, expiry);
      setProof({ ...proofData, normalizedAddress });
      toast.success('Proof generated! Now commit your claim.');
    } catch (e) {
      toast.error('Failed to get proof. Check if the address/subdomain is in CSV.');
    }
    setLoading(false);
  };

  // Step 2: Commit claim
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

      const tx = await contract.commitClaim(commitment);
      
      toast.loading('Transaction pending...', { id: 'commit-tx' });
      await tx.wait();
      toast.dismiss('commit-tx');
      
      setProof({ ...proof, nonce, commitment, normalizedAddress });
      setCommitted(true);
      toast.success('Commitment submitted! Wait 10 minutes to reveal.');
    } catch (e) {
      toast.dismiss('commit-tx');
      toast.error('Commit failed: ' + (e.message || e));
    }
    setLoading(false);
  };

  // Step 3: Reveal and claim
  const handleClaim = async () => {
    if (!proof || !contract || !committed) return;

    setLoading(true);
    try {
      const parentNode = namehash(parentDomain);
      
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
      
      // Save successful claim
      const fullDomain = `${subdomain}.${parentDomain}`;
      const claimData = {
        fullDomain,
        subdomain,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString(),
        owner: proof.normalizedAddress
      };
      
      saveClaimedDomain(claimData);
      setSuccessfulClaim(claimData);
      
      // Reset form
      setSubdomain('');
      setManualAddress('');
      setProof(null);
      setCommitted(false);
      
      toast.success(`🎉 Successfully claimed ${fullDomain}!`);
    } catch (e) {
      toast.dismiss('claim-tx');
      if (e.message.includes('Too early')) {
        toast.error('Please wait 10 minutes after committing before claiming');
      } else if (e.message.includes('already claimed') || e.message.includes('Invalid proof')) {
        toast.error('This subdomain has already been claimed or proof is invalid');
      } else {
        toast.error('Claim failed: ' + (e.message || e));
      }
    }
    setLoading(false);
  };

  const handleAddressChange = (e) => {
    const inputAddr = e.target.value;
    setManualAddress(inputAddr);
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
      {/* Show successful claim */}
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
          <div className="text-sm text-green-600">
            <p>Owner: {successfulClaim.owner}</p>
            <p>Block: #{successfulClaim.blockNumber}</p>
            <a 
              href={`https://sepolia.etherscan.io/tx/${successfulClaim.txHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 underline"
            >
              View on Etherscan →
            </a>
          </div>
        </div>
      )}

      {/* Show previously claimed domains */}
      {claimedDomains.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-blue-800 font-medium mb-2">Previously Claimed Domains ({claimedDomains.length})</h4>
          <div className="space-y-1">
            {claimedDomains.slice(-3).map((domain, index) => (
              <div key={index} className="text-blue-700 text-sm flex justify-between">
                <span className="font-medium">{domain.fullDomain}</span>
                <a 
                  href={`https://sepolia.etherscan.io/tx/${domain.txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  tx
                </a>
              </div>
            ))}
            {claimedDomains.length > 3 && (
              <p className="text-blue-600 text-xs">+ {claimedDomains.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          🎭 <span className="font-medium">Demo Mode:</span> Enter any address from your CSV to test claiming
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
              onChange={e => setSubdomain(e.target.value.toLowerCase())}
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
        </div>
      </div>

      <div className="space-y-3">
        {!proof && (
          <button
            onClick={handleGetProof}
            disabled={loading || !ethers.isAddress(manualAddress) || !subdomain.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium px-6 py-3 rounded-xl transition-colors duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Getting Proof...
              </span>
            ) : 'Get Merkle Proof'}
          </button>
        )}

        {proof && !committed && (
          <button
            onClick={handleCommit}
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-medium px-6 py-3 rounded-xl transition-colors duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Committing...
              </span>
            ) : 'Commit Claim'}
          </button>
        )}

        {committed && (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-medium px-6 py-3 rounded-xl transition-colors duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Claiming...
              </span>
            ) : 'Reveal & Claim Subdomain'}
          </button>
        )}
      </div>

      {proof && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2 text-green-700">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="font-medium">Proof: {proof.proof?.length || 0} elements</span>
            </div>
            <div className="text-gray-600">
              For: {proof.normalizedAddress || normalizeAddress(manualAddress)}
            </div>
            {committed && (
              <div className="flex items-center gap-2 text-yellow-700">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                <span className="font-medium">Committed - wait 10 minutes to claim</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
