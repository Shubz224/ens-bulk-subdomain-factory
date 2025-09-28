import { useState, useEffect } from "react";
import WalletButton from "../components/WalletButton";
import UploadCSV from "../components/UploadCSV";
import DeployConfig from "../components/DeployConfig";
import ClaimSubdomain from "../components/ClaimSubdomain";
import { useFactoryContract } from '../contracts';
import { useWallet } from '../hooks/useWallet';
import toast from 'react-hot-toast';


// --- PauseBanner Component ---
function PauseBanner({ contract }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!contract) return;
    contract.paused().then(setPaused).catch(() => {});
  }, [contract]);
  if (!paused) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-center py-3 px-4 mb-6 rounded-lg">
      <div className="flex items-center justify-center gap-2">
        <span>⚠️</span>
        <p className="text-sm font-medium">
          Contract is PAUSED. All claiming and configuration actions are disabled!
        </p>
      </div>
    </div>
  );
}
// --- End PauseBanner ---


export default function Home() {
  const [root, setRoot] = useState(null);
  const [count, setCount] = useState(null);
  const [parentDomain, setParentDomain] = useState("demo.eth");


  const { signer } = useWallet();
  const contract = useFactoryContract(signer);


  const handlePause = async () => {
    if (!contract) return;
    try {
      const tx = await contract.pause();
      toast('Pausing contract... (pending)');
      await tx.wait();
      toast.success('Factory contract is paused');
    } catch (e) {
      toast.error('Pause failed');
    }
  };
  const handleUnpause = async () => {
    if (!contract) return;
    try {
      const tx = await contract.unpause();
      toast('Unpausing contract... (pending)');
      await tx.wait();
      toast.success('Factory contract is now live');
    } catch (e) {
      toast.error('Unpause failed');
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <div className="ml-3">
                  <h1 className="text-lg font-semibold text-gray-900">ENS Bulk Factory</h1>
                  <p className="text-xs text-gray-500">Your web3 username</p>
                </div>
              </div>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>


      {/* Domain Tags Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium">uni.eth</span>
            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">base.eth</span>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">dao.eth</span>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">nba.eth</span>
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">vitalik.eth</span>
            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">linea.eth</span>
          </div>
        </div>
      </div>


      {/* Main Dashboard Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* --- PauseBanner is injected here --- */}
        <PauseBanner contract={contract} />


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Admin Panel */}
          <div className="space-y-6">
            {/* Registration Card */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center">
                  <span className="text-lg">📋</span>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">Register Names</h3>
                    <p className="text-sm text-gray-600">Configure bulk domain registration</p>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-6">
                {/* Parent Domain Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Parent ENS Domain</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={parentDomain}
                    onChange={e => setParentDomain(e.target.value)}
                    placeholder="demo.eth"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the parent domain for subdomain minting
                  </p>
                </div>
                
                {/* CSV Upload */}
                <UploadCSV onRoot={(merkleRoot, total) => { setRoot(merkleRoot); setCount(total); }} />
              </div>
            </div>


            {/* Configuration Results Card */}
            {root && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center">
                    <span className="text-lg">✅</span>
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-gray-900">Configuration Ready</h3>
                      <p className="text-sm text-gray-600">Deploy to smart contract</p>
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Merkle Root</label>
                      <div className="mt-2 p-3 bg-gray-50 rounded border">
                        <code className="text-xs text-gray-800 break-all font-mono">{root}</code>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Total Claims</span>
                        <div className="text-xl font-semibold text-gray-900">{count}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Parent Domain</span>
                        <div className="text-lg font-semibold text-gray-900">{parentDomain}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <DeployConfig
                      merkleRoot={root}
                      claimCount={count}
                      parentDomain={parentDomain}
                    />
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={handlePause} 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded font-medium transition-colors">
                      Pause Contract
                    </button>
                    <button 
                      onClick={handleUnpause}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded font-medium transition-colors">
                      Unpause Contract
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Right Column - User Panel */}
          <div className="space-y-6">
            {/* Claim Subdomain Card */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center">
                  <span className="text-lg">🎯</span>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">Claim Subdomain</h3>
                    <p className="text-sm text-gray-600">Users can claim their allocated subdomains</p>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-6">
                <ClaimSubdomain parentDomain={parentDomain} />
              </div>
            </div>


            {/* How It Works Card */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center">
                  <span className="text-lg">🚀</span>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">How it works</h3>
                    <p className="text-sm text-gray-600">Simple 3-step process</p>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Upload CSV</p>
                      <p className="text-xs text-gray-600 mt-1">Upload CSV with addresses, subdomains, expiry</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Deploy Config</p>
                      <p className="text-xs text-gray-600 mt-1">Deploy configuration to smart contract</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Claim Names</p>
                      <p className="text-xs text-gray-600 mt-1">Users claim subdomains with Merkle proofs</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
