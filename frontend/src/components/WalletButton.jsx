import { useState, useRef, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import toast from 'react-hot-toast';

export default function WalletButton() {
  const { address, connect, disconnect, chain } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try { 
      await connect(); 
      toast.success('Wallet connected successfully', {
        duration: 3000,
        icon: '🎉'
      }); 
    }
    catch (error) { 
      toast.error('Failed to connect wallet', {
        duration: 4000,
        icon: '❌'
      });
      console.error('Wallet connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDropdownOpen(false);
      
      // Method 1: Try the hook's disconnect method first
      if (disconnect && typeof disconnect === 'function') {
        await disconnect();
        toast.success('Wallet disconnected', {
          duration: 3000,
          icon: '👋'
        });
        return;
      }

      // Method 2: Modern MetaMask disconnect using wallet_revokePermissions (2024+)
      if (window.ethereum?.request) {
        try {
          // First revoke eth_accounts permission (new MetaMask method)
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{
              eth_accounts: {}
            }]
          });
          
          toast.success('Wallet disconnected', {
            duration: 3000,
            icon: '👋'
          });
          
          // Force a page refresh to ensure clean state
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return;
          
        } catch (revokeError) {
          console.log('wallet_revokePermissions not supported, trying alternative methods');
        }
      }

      // Method 3: Request permissions to force account selection on next connect
      if (window.ethereum?.request) {
        try {
          // This forces MetaMask to show account selection next time
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{
              eth_accounts: {}
            }]
          });
          
          // Clear local storage
          localStorage.removeItem('walletconnect');
          localStorage.removeItem('wallet-connect');
          localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
          localStorage.removeItem('wagmi.connected');
          localStorage.removeItem('wagmi.wallet');
          
          toast.success('Wallet session reset', {
            duration: 3000,
            icon: '🔄'
          });
          
          // Reload to ensure clean state
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
          
        } catch (permError) {
          console.log('wallet_requestPermissions failed, using fallback');
        }
      }

      // Method 4: WalletConnect v2 specific disconnect
      if (window.ethereum?.isWalletConnect || localStorage.getItem('walletconnect')) {
        try {
          if (window.ethereum?.disconnect) {
            await window.ethereum.disconnect();
          }
          
          // Clear WalletConnect storage
          localStorage.removeItem('walletconnect');
          localStorage.removeItem('wallet-connect');
          localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
          
          toast.success('WalletConnect disconnected', {
            duration: 3000,
            icon: '👋'
          });
          
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return;
          
        } catch (wcError) {
          console.log('WalletConnect disconnect failed');
        }
      }

      // Method 5: Final fallback - clear all wallet-related storage and reload
      console.log('Using final fallback disconnect method');
      
      // Clear all possible wallet-related localStorage keys
      const keysToRemove = [
        'walletconnect',
        'wallet-connect',
        'WALLETCONNECT_DEEPLINK_CHOICE',
        'wagmi.connected',
        'wagmi.wallet',
        'wagmi.store',
        'metamask-connection',
        '-walletlink:https://www.walletlink.org:session:id',
        '-walletlink:https://www.walletlink.org:session:secret',
        '-walletlink:https://www.walletlink.org:session:linkedAccount'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      toast.success('Clearing wallet connection...', {
        duration: 2000,
        icon: '🔄'
      });
      
      // Reload page to ensure completely clean state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Ultimate disconnect error:', error);
      
      // Ultimate fallback: Clear everything and reload
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageError) {
        console.error('Storage clear failed:', storageError);
      }
      
      toast.success('Resetting application...', {
        duration: 2000,
        icon: '🔄'
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard', {
        duration: 2000,
        icon: '📋'
      });
      setIsDropdownOpen(false);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('Address copied to clipboard', {
          duration: 2000,
          icon: '📋'
        });
      } catch (fallbackError) {
        toast.error('Failed to copy address');
      }
      document.body.removeChild(textArea);
      setIsDropdownOpen(false);
    }
  };

  const getChainName = (chainId) => {
    const chainNames = {
      1: 'Ethereum',
      5: 'Goerli',
      11155111: 'Sepolia',
      17000: 'Holesky',
      137: 'Polygon',
      80001: 'Mumbai',
      80002: 'Amoy',
      56: 'BSC',
      97: 'BSC Testnet',
      42161: 'Arbitrum',
      421614: 'Arbitrum Sepolia',
      10: 'Optimism',
      11155420: 'OP Sepolia',
      8453: 'Base',
      84532: 'Base Sepolia'
    };
    return chainNames[chainId] || `Chain ${chainId}`;
  };

  // Connected state with dropdown
  if (address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2.5 transition-all duration-200 shadow-sm hover:shadow-md group"
        >
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-sm"></div>
            <span className="text-gray-700 font-medium text-sm">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          
          {/* Chain badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
              {getChainName(chain)}
            </span>
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Dropdown menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">W</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Wallet Connected</p>
                  <p className="text-xs text-gray-600">
                    {getChainName(chain)} Network
                  </p>
                </div>
              </div>
            </div>

            {/* Address section */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</p>
                  <p className="text-sm font-mono text-gray-900 mt-1 break-all">{address}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="py-2">
              <button
                onClick={copyAddress}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors duration-150"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Address
              </button>
              
              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 text-sm text-red-600 transition-colors duration-150 border-t border-gray-100"
              >
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <button 
      onClick={handleConnect}
      disabled={isConnecting}
      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
    >
      {isConnecting ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Connect Wallet
        </>
      )}
    </button>
  );
}
