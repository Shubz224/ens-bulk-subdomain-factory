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
  const [deployed, setDeployed] = useState(false);
  const [txHash, setTxHash] = useState(null);

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
      
      setTxHash(tx.hash);
      toast.loading('Transaction pending...', { id: 'deploy-tx' });
      
      await tx.wait();
      
      toast.dismiss('deploy-tx');
      setDeployed(true);
      toast.success('Config deployed on-chain! 🎉');
    } catch (e) {
      toast.dismiss('deploy-tx');
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
      
      {/* Show different UI based on deployment state */}
      {!deployed ? (
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
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-green-800 font-semibold">✅ Configuration Deployed!</h3>
              <p className="text-green-600 text-sm">Contract is ready for claims</p>
            </div>
          </div>
          
          {txHash && (
            <a 
              href={`https://sepolia.etherscan.io/tx/${txHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-medium"
            >
              View on Etherscan
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
