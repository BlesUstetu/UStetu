import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "./config.js";
import { ESCROW_ABI } from "./abi.js";

const PAYMENT_PENDING = 1;

function requiredKeeperKey(): string {
  const value = process.env.KEEPER_PRIVATE_KEY?.trim();
  if (!value) throw new Error("Missing environment variable: KEEPER_PRIVATE_KEY");
  return value;
}

const provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
const wallet = new Wallet(requiredKeeperKey(), provider);
const escrow = new Contract(config.escrowAddress, ESCROW_ABI, wallet);
const readEscrow = new Contract(config.escrowAddress, ESCROW_ABI, provider);

const pollIntervalMs = Number(process.env.KEEPER_POLL_INTERVAL_MS ?? "30000");
const bootstrapBlocks = Number(process.env.KEEPER_SCAN_BLOCKS ?? "5000");
let nextBlock = 0;
const attempted = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function expireExpiredOrders(fromBlock: number, toBlock: number) {
  if (toBlock < fromBlock) return;

  const logs = await provider.getLogs({
    address: config.escrowAddress,
    fromBlock,
    toBlock,
    topics: [readEscrow.interface.getEvent("OrderCreated").topicHash]
  });

  const block = await provider.getBlock(toBlock);
  const now = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000));

  for (const log of logs) {
    const parsed = readEscrow.interface.parseLog(log);
    if (!parsed || parsed.name !== "OrderCreated") continue;

    const orderId = BigInt(parsed.args[0]);
    const key = orderId.toString();
    if (attempted.has(key)) continue;

    try {
      const order = await readEscrow.getOrder(orderId);
      if (Number(order.state) !== PAYMENT_PENDING) {
        attempted.add(key);
        continue;
      }

      if (BigInt(order.expiresAt) > now) continue;

      attempted.add(key);
      console.log(`Expiring Order #${key} for Listing #${order.listingId}…`);
      const tx = await escrow.expireOrder(orderId);
      console.log(`Order #${key} expiry tx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        console.error(`Order #${key} expiry transaction failed: ${tx.hash}`);
        attempted.delete(key);
        continue;
      }
      console.log(`Order #${key} expired successfully: ${tx.hash}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Expiry attempt failed for Order #${key}: ${message}`);
      attempted.delete(key);
    }
  }
}

export async function runOnce() {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) {
    throw new Error(`RPC chain ${network.chainId} does not match CHAIN_ID ${config.chainId}`);
  }

  const latest = await provider.getBlockNumber();
  if (nextBlock === 0) nextBlock = Math.max(0, latest - bootstrapBlocks + 1);
  if (nextBlock > latest) return;

  const chunkSize = 2000;
  for (let start = nextBlock; start <= latest; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, latest);
    await expireExpiredOrders(start, end);
    nextBlock = end + 1;
  }
}

async function main() {
  const keeper = await wallet.getAddress();
  console.log(`UStetu expiry keeper started on chain ${config.chainId}`);
  console.log(`Keeper wallet: ${keeper}`);
  console.log(`Escrow: ${config.escrowAddress}`);
  console.log(`Poll interval: ${pollIntervalMs} ms`);

  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error("Expiry keeper cycle failed:", error);
    }
    await sleep(pollIntervalMs);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
