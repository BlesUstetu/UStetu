import { BrowserProvider, type Eip1193Provider } from "ethers";
import { frontendConfig } from "../config";

interface EthereumProvider extends Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

export interface WalletState {
  address: string | null;
  chainId: bigint | null;
}

function getEthereumProvider(): EthereumProvider {
  const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
  if (!ethereum || typeof ethereum !== "object" || !("request" in ethereum)) {
    throw new Error("No compatible EIP-1193 browser wallet detected");
  }
  return ethereum as EthereumProvider;
}

export async function connectWallet(): Promise<WalletState> {
  const ethereum = getEthereumProvider();
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
