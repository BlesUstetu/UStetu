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
// into the client application. The environment variable remains supported
// for local development/overrides, while GitHub Pages uses this configured ID.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "482adba19d5eaa8abbc716350e90eed3";

// Trust Wallet is kept on a direct EIP-1193 connector because the browser
// extension can expose its provider through window.ethereum / providers.
// This preserves the Trust Wallet connection fix that is already working.
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

            // Trust Wallet extension may expose itself directly.
            if (ethereum?.isTrust) return ethereum;

            // Multiple injected wallets can coexist in the browser.
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
      wallets: [
        trustWalletDirect,
        metaMaskWallet,
      ],
    },
    {
      groupName: "Other",
      wallets: [
        injectedWallet,
        walletConnectWallet,
      ],
    },
  ],
  // Keep explicit wallet connectors above so MetaMask and Trust remain
  // independently selectable even when several browser wallets are installed.
  // The generic injected fallback is still available through injectedWallet.
  multiInjectedProviderDiscovery: false,
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
