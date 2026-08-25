export const frontendConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787",
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? "0"),
  escrowAddress: import.meta.env.VITE_ESCROW_ADDRESS ?? "",
  paymentTokenAddress: import.meta.env.VITE_PAYMENT_TOKEN_ADDRESS ?? ""
};

export function requireConfig() {
  if (!frontendConfig.chainId) throw new Error("VITE_CHAIN_ID is not configured");
  if (!frontendConfig.escrowAddress) throw new Error("VITE_ESCROW_ADDRESS is not configured");
}
