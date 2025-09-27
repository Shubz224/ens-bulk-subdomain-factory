import React, { useState } from "react";
import { namehash } from "../utils/namehash";
import toast from "react-hot-toast";
import { useWallet } from "../hooks/useWallet";
import { useFactoryContract } from "../contracts";

// Sepolia network config
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CONFIG = {
  chainId: '0xaa36a7',
  chainName: 'Sepolia Testnet',
  nativeCurrency: {
    name: 'Sepolia ETH',
    symbol: 'SEP',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia.infura.io/v3/'],
  blockExplorerUrls: ['https://sepolia.etherscan.io/'],
};

export default function DeployConfig({ merkleRoot, claimCount, parentDomain }) {
  const { signer, chain } = useWallet();
  const contract = useFactoryContract(signer);
  const [deploying, setDeploying] = useState(false);

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CONFIG.chainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_CONFIG],
        });
      } else {
        throw switchError;
      }
    }
  };

  const handleDeploy = async () => {
    if (!contract) return toast.error('Wallet not connected');
    
    if (chain !== SEPOLIA_CHAIN_ID) {
      try {
        await switchToSepolia();
        toast.success('Switched to Sepolia testnet');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        toast.error('Please switch to Sepolia testnet manually');
        return;
      }
    }

    setDeploying(true);

    try {
      const parentNode = namehash(parentDomain);
      const tx = await contract.initializeConfig(
        parentNode,
        parentDomain,
        merkleRoot,
        0,
        claimCount
      );
      await tx.wait();
      toast.success('Config deployed on-chain!');
    } catch (e) {
      toast.error('Deploy failed: ' + (e.message || e));
    }
    setDeploying(false);
  };

  if (!merkleRoot || !claimCount) return null;
  
  const isWrongNetwork = chain && chain !== SEPOLIA_CHAIN_ID;

  return (
    <div className="mt-6">
      {isWrongNetwork && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            ⚠️ Wrong network detected. Click deploy to auto-switch to Sepolia.
          </p>
        </div>
      )}
      
      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-medium px-6 py-3 rounded-xl transition-colors duration-200"
      >
        {deploying ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Deploying...
          </span>
        ) : isWrongNetwork ? "Switch to Sepolia & Deploy" : "Deploy Config to Contract"}
      </button>
    </div>
  );
}
