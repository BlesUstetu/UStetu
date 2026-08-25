import { BrowserProvider } from "ethers";
import { frontendConfig } from "../config";

export interface WalletState {
  address: string | null;
  chainId: bigint | null;
}

export async function connectWallet(): Promise<WalletState> {
  const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
  if (!ethereum) throw new Error("No browser wallet detected");

  const provider = new BrowserProvider(ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();

  if (frontendConfig.chainId && network.chainId !== BigInt(frontendConfig.chainId)) {
    throw new Error(`Wrong network. Expected chain ${frontendConfig.chainId}`);
  }

  return {
    address: await signer.getAddress(),
    chainId: network.chainId
  };
}
