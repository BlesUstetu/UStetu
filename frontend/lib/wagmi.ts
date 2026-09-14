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
 * Buy Order performs several sequential eth_call/read operations around
 * fundOrder/completeOrder. Do not let a short application-level timeout abort
 * before the transport has a chance to retry/fail over to the second RPC.
 */
const rpc = (url: string) =>
  http(url, {
    timeout: 15_000,
    retryCount: 2,
    retryDelay: 750,
  });

export const wagmiConfig = getDefaultConfig({
  appName: "USTETU",
  projectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: fallback([
      rpc("https://sepolia.base.org"),
      rpc("https://base-sepolia-rpc.publicnode.com"),
    ]),
  },
  ssr: true,
});
