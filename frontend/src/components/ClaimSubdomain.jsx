import React, { useState } from 'react';
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

  // Helper function to normalize address
  const normalizeAddress = (addr) => {
    try {
      return ethers.getAddress(addr.toLowerCase());
    } catch {
      return addr;
    }
  };

  // Step 1: Get Merkle proof
  const handleGetProof = async () => {
    if (!manualAddress || !subdomain || !expiry) {
      return toast.error('Please fill all fields');
    }

    if (!ethers.isAddress(manualAddress)) {
      return toast.error('Invalid Ethereum address format');
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
      await tx.wait();
      
      setProof({ ...proof, nonce, commitment, normalizedAddress });
      setCommitted(true);
      toast.success('Commitment submitted! Wait 10 minutes to reveal.');
    } catch (e) {
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
      await tx.wait();
      
      toast.success(`Successfully claimed ${subdomain}.${parentDomain}!`);
    } catch (e) {
      if (e.message.includes('Too early')) {
        toast.error('Please wait 10 minutes after committing before claiming');
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
              onChange={e => setSubdomain(e.target.value)}
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
            disabled={loading || !ethers.isAddress(manualAddress)}
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
