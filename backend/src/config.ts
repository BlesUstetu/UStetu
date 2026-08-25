import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const config = {
  rpcUrl: required("RPC_URL"),
  chainId: Number(required("CHAIN_ID")),
  escrowAddress: required("ESCROW_ADDRESS"),
  confirmations: Number(process.env.CONFIRMATIONS ?? "12"),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "10000"),
  startBlock: Number(process.env.START_BLOCK ?? "0"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  apiPort: Number(process.env.API_PORT ?? "8787")
};

if (!Number.isInteger(config.chainId) || config.chainId <= 0) throw new Error("CHAIN_ID must be a positive integer");
if (!Number.isInteger(config.confirmations) || config.confirmations < 0) throw new Error("CONFIRMATIONS must be >= 0");
if (!Number.isInteger(config.startBlock) || config.startBlock < 0) throw new Error("START_BLOCK must be >= 0");
