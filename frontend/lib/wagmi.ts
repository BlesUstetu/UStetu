import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";
import { fallback, http } from "viem";

// WalletConnect Project ID is a public dApp identifier. The environment
// variable remains supported for local development; GitHub Pages uses this
// configured project ID when no environment variable is present.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "482adba19d5eaa8abbc716350e90eed3";

/**
 * USTETU wallet configuration.
 *
 * Keep RainbowKit's default wallet connectors. For Base Sepolia RPC access,
 * use two public endpoints so a lagging RPC cannot leave transaction receipts
 * invisible to the frontend after the wallet has already confirmed them.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "USTETU",
  projectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: fallback([
      http("https://sepolia.base.org", { timeout: 10_000 }),
      http("https://base-sepolia-rpc.publicnode.com", { timeout: 10_000 }),
    ]),
  },
  ssr: true,
});
