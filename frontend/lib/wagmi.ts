import { getDefaultConfig, type WalletDetailsParams } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConnector, injected } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { http } from "wagmi";

// WalletConnect Project ID is a public dApp identifier. The environment
// variable remains supported for local development; GitHub Pages uses this
// configured project ID when no environment variable is present.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "482adba19d5eaa8abbc716350e90eed3";

/**
 * Find a specific injected EIP-1193 provider without relying on EIP-6963.
 * This is important when several browser extensions inject window.ethereum.
 */
function findInjectedProvider(
  browserWindow: Window,
  predicate: (provider: any) => boolean,
) {
  const ethereum = (browserWindow as any).ethereum;

  if (predicate(ethereum)) return ethereum;

  if (Array.isArray(ethereum?.providers)) {
    const provider = ethereum.providers.find(predicate);
    if (provider) return provider;
  }

  return undefined;
}

// Trust Wallet: direct provider connector. This preserves the Trust Wallet
// connection behavior that is already working in the deployed application.
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

            return (
              findInjectedProvider(browserWindow, (provider) =>
                Boolean(provider?.isTrust),
              ) ?? (browserWindow as any).trustwallet
            );
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

// MetaMask: direct provider connector. This prevents Trust Wallet from
// capturing window.ethereum when both extensions are installed.
const metaMaskDirect = (params: { projectId: string }) => {
  void params;

  return {
    id: "metaMask",
    name: "MetaMask",
    iconUrl:
      "https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg",
    iconBackground: "#f6851b",
    installed:
      typeof window !== "undefined" &&
      Boolean(
        findInjectedProvider(window, (provider) => Boolean(provider?.isMetaMask)),
      ),
    createConnector: (walletDetails: WalletDetailsParams) => {
      const connector = injected({
        target: {
          id: "metaMaskDirect",
          name: "MetaMask",
          provider: (browserWindow) => {
            if (!browserWindow) return undefined;

            return findInjectedProvider(browserWindow, (provider) =>
              Boolean(provider?.isMetaMask),
            );
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
      wallets: [trustWalletDirect, metaMaskDirect],
    },
    {
      groupName: "Other",
      wallets: [injectedWallet, walletConnectWallet],
    },
  ],
  // Explicit direct connectors avoid provider collisions when multiple browser
  // extensions are installed while WalletConnect remains the universal fallback.
  multiInjectedProviderDiscovery: false,
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
