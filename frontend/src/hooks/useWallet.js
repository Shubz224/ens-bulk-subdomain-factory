import { useEffect, useState } from "react";
import { ethers } from "ethers";

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chain, setChain] = useState(null);

  // Check if already connected on page load
  useEffect(() => {
    const checkConnection = async () => {
      if (!window.ethereum) return;
      
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const net = await provider.getNetwork();
          const newSigner = await provider.getSigner();
          
          setAddress(accounts[0]);
          setSigner(newSigner);
          setChain(Number(net.chainId));
        }
      } catch (error) {
        console.log("Connection check failed:", error);
      }
    };
    
    checkConnection();
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length > 0) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const newSigner = await provider.getSigner();
        setAddress(accounts[0]);
        setSigner(newSigner);
      } else {
        setAddress(null);
        setSigner(null);
      }
    };
    
    const handleChainChanged = (chainId) => {
      setChain(Number(chainId));
    };
    
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = async () => {
    if (!window.ethereum) throw Error("MetaMask not available");
    
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      const newSigner = await provider.getSigner();
      
      setAddress(addr);
      setSigner(newSigner);
      setChain(Number(net.chainId));
      
      console.log("Wallet connected:", { addr, chainId: Number(net.chainId) });
      
      return { addr, chainId: Number(net.chainId) };
    } catch (error) {
      console.error("Connect failed:", error);
      throw error;
    }
  };

  return { connect, address, signer, chain };
}
