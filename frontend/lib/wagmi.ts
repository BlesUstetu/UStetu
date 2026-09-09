import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { baseSepolia } from "wagmi/chains";
import { http } from "wagmi";

// WalletConnect Project ID is a public dApp identifier and is safe to bundle
// into the client application. The environment variable remains supported for
// local development/overrides, while GitHub Pages uses the configured ID.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "482adba19d5eaa8abbc716350e90eed3";

export const wagmiConfig = getDefaultConfig({
  appName: "USTETU",
  projectId,
  chains: [baseSepolia],
  wallets: [
    {
      groupName: "Recommended",
      wallets: [injectedWallet, walletConnectWallet],
    },
  ],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
