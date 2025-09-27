import { useWallet } from '../hooks/useWallet';
import toast from 'react-hot-toast';

export default function WalletButton() {
  const { address, connect, chain } = useWallet();

  const handleConnect = async () => {
    try { 
      await connect(); 
      toast.success('Connected'); 
    }
    catch { 
      toast.error('Wallet connect failed'); 
    }
  };

  if (address) return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
      <span className="text-gray-700 font-medium text-sm">
        {address.slice(0,6)}...{address.slice(-4)}
      </span>
      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
        Chain {chain}
      </span>
    </div>
  );

  return (
    <button 
      onClick={handleConnect}
      className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2.5 rounded-full transition-colors duration-200 shadow-sm"
    >
      Connect
    </button>
  );
}
