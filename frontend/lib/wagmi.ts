import { getDefaultConfig } from "@rainbow-me/rainbowkit";
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
 * Use RainbowKit's default wallet connectors directly. This lets RainbowKit
 * manage EIP-6963 discovery and its built-in WalletConnect integration without
 * a custom wallet list or custom injected-provider connectors.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "USTETU",
  projectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
