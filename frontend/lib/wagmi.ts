import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { baseSepolia } from "wagmi/chains";
import { http } from "wagmi";

// WalletConnect Project ID is a public dApp identifier. The environment
// variable remains supported for local development; GitHub Pages uses this
// configured project ID when no environment variable is present.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "482adba19d5eaa8abbc716350e90eed3";

/**
 * USTETU wallet configuration
 *
 * Use RainbowKit's official wallet connectors directly. RainbowKit 2.x
 * supports EIP-6963 provider discovery, which prevents conflicts when
 * multiple browser wallets are installed. WalletConnect and Injected Wallet
 * are kept as generic fallbacks so mobile and browser wallets remain covered.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "USTETU",
  projectId,
  chains: [baseSepolia],
  wallets: [
    {
      groupName: "Installed",
      wallets: [metaMaskWallet, trustWallet],
    },
    {
      groupName: "Other",
      wallets: [injectedWallet, walletConnectWallet],
    },
  ],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
