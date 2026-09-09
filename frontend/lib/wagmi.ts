import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "wagmi/chains";
import { http } from "wagmi";

// WalletConnect Project ID is a public dApp identifier and is safe to bundle
// into the client application. The environment variable remains supported for
// local development/overrides, while GitHub Pages uses the configured ID.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "482adba19d5eaa8abbc716350e90eed3";

// Trust Wallet's browser extension exposes an EIP-1193 provider through
// window.ethereum / window.ethereum.providers / window.trustwallet.
// Use the direct injected provider instead of the RainbowKit Trust connector
// flow that can remain pending after the extension approval on some browsers.
const trustWalletDirect = {
  ...trustWallet(),
  createConnector: () =>
    injected({
      target: {
        id: "trustWalletDirect",
        name: "Trust Wallet",
        provider: (window) => {
          const ethereum = window.ethereum as any;

          if (ethereum?.isTrust) return ethereum;

          if (Array.isArray(ethereum?.providers)) {
            const trustProvider = ethereum.providers.find(
              (provider: any) => provider?.isTrust,
            );
            if (trustProvider) return trustProvider;
          }

          return (window as any).trustwallet ?? undefined;
        },
      },
    }),
};

export const wagmiConfig = getDefaultConfig({
  appName: "USTETU",
  projectId,
  chains: [baseSepolia],
  wallets: [
    {
      groupName: "Installed",
      wallets: [trustWalletDirect, metaMaskWallet],
    },
    {
      groupName: "Other",
      wallets: [injectedWallet, walletConnectWallet],
    },
  ],
  // Prevent automatic EIP-6963 connector injection from re-adding the
  // original Trust Wallet connector alongside our direct provider connector.
  multiInjectedProviderDiscovery: false,
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
