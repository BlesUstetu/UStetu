import { getDefaultConfig, type WalletDetailsParams } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConnector, injected } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { http } from "wagmi";

// WalletConnect Project ID is a public dApp identifier and is safe to bundle
// into the client application. The environment variable remains supported for
// local development/overrides, while GitHub Pages uses the configured ID.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "482adba19d5eaa8abbc716350e90eed3";

// Keep Trust Wallet's official RainbowKit presentation/metadata, but replace
// only its connection implementation with a direct EIP-1193 injected provider.
// This avoids the Trust-specific handoff flow that can remain pending after the
// browser extension has already approved the connection.
const trustWalletDirect = (params: { projectId: string }) => {
  const baseWallet = trustWallet(params);

  return {
    ...baseWallet,
    createConnector: (walletDetails: WalletDetailsParams) => {
      const connector = injected({
        target: {
          id: "trustWalletDirect",
          name: "Trust Wallet",
          provider: (browserWindow) => {
            if (!browserWindow) return undefined;

            const ethereum = browserWindow.ethereum as any;

            if (ethereum?.isTrust) return ethereum;

            if (Array.isArray(ethereum?.providers)) {
              const trustProvider = ethereum.providers.find(
                (provider: any) => provider?.isTrust,
              );
              if (trustProvider) return trustProvider;
            }

            return (browserWindow as any).trustwallet ?? undefined;
          },
        },
      });

      return createConnector((config) => ({
        ...connector(config),
        ...walletDetails,
      }));
    },
  };
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
  // Prevent automatic EIP-6963 discovery from adding a second Trust connector.
  multiInjectedProviderDiscovery: false,
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
