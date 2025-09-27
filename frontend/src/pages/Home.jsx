import { useState } from "react";
import WalletButton from "../components/WalletButton";
import UploadCSV from "../components/UploadCSV";
import DeployConfig from "../components/DeployConfig";
import ClaimSubdomain from "../components/ClaimSubdomain";

export default function Home() {
  const [root, setRoot] = useState(null);
  const [count, setCount] = useState(null);
  const [parentDomain, setParentDomain] = useState("demo.eth");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  ENS Bulk Factory
                </h1>
                <p className="text-sm text-gray-500">
                  Your web3 username
                </p>
              </div>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 py-16">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to the<br />
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              New Internet
            </span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            For every dreamer, creator, and change-maker tired of the old internet, Web3 is here. 
            ENS is more than a protocol - it's a commitment to a better web, built for everyone.
          </p>
          
          {/* Sample Domain Badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <span className="bg-pink-100 text-pink-700 px-4 py-2 rounded-full font-medium">uni.eth</span>
            <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full font-medium">base.eth</span>
            <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-medium">dao.eth</span>
            <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-medium">nba.eth</span>
            <span className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-medium">vitalik.eth</span>
            <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-medium">linea.eth</span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Left Column - Admin Panel */}
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-xl font-semibold mb-6 text-gray-900">
                📋 Register your name
              </h2>
              
              {/* Parent Domain Input */}
              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-3">Parent ENS Domain</label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                    value={parentDomain}
                    onChange={e => setParentDomain(e.target.value)}
                    placeholder="demo.eth"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Enter the parent domain for subdomain minting
                </p>
              </div>
              
              {/* CSV Upload */}
              <UploadCSV onRoot={(merkleRoot, total) => { setRoot(merkleRoot); setCount(total); }} />
            </div>

            {/* Results Panel */}
            {root && (
              <div className="bg-green-50 rounded-2xl p-8 border border-green-200">
                <h3 className="text-lg font-semibold mb-6 text-green-800">✅ Configuration Ready</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-gray-600 text-sm font-medium">Merkle Root</span>
                    <div className="font-mono text-green-700 text-sm bg-white p-3 rounded-lg mt-2 border">
                      {root}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Claims</span>
                      <div className="text-blue-600 font-semibold text-lg">{count}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Parent Domain</span>
                      <div className="text-purple-600 font-semibold text-lg">{parentDomain}</div>
                    </div>
                  </div>
                </div>
                
                <DeployConfig
                  merkleRoot={root}
                  claimCount={count}
                  parentDomain={parentDomain}
                />
              </div>
            )}
          </div>

          {/* Right Column - User Panel */}
          <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">🎯 Claim Subdomain</h2>
                <p className="text-gray-600 text-sm mt-2">
                  Users can claim their allocated subdomains here
                </p>
              </div>
              <div className="p-8">
                <ClaimSubdomain parentDomain={parentDomain} />
              </div>
            </div>

            {/* Demo Info Panel */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-6">🚀 How it works</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">1</div>
                  <div>
                    <p className="text-gray-700 font-medium">Upload CSV</p>
                    <p className="text-gray-600 text-sm">Upload CSV with addresses, subdomains, expiry</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">2</div>
                  <div>
                    <p className="text-gray-700 font-medium">Deploy Config</p>
                    <p className="text-gray-600 text-sm">Deploy configuration to smart contract</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">3</div>
                  <div>
                    <p className="text-gray-700 font-medium">Claim Names</p>
                    <p className="text-gray-600 text-sm">Users claim subdomains with Merkle proofs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
