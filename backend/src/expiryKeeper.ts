import "dotenv/config";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

const PAYMENT_PENDING = 1;
const KEEPER_ABI = [
  "event OrderCreated(uint256 indexed orderId,uint256 indexed listingId,address indexed buyer,address seller,address recipient,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,address paymentToken)",
  "function getOrder(uint256 orderId) view returns (uint256 listingId,address buyer,address seller,address recipient,address token,address paymentToken,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,uint256 marketplaceFee,uint256 sellerProceeds,uint8 state,uint64 createdAt,uint64 paidAt,uint64 completedAt,uint64 refundedAt,uint64 expiresAt,uint256 disputeId)",
  "function expireOrder(uint256 orderId)"
] as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const rpcUrl = required("RPC_URL");
const chainId = Number(required("CHAIN_ID"));
const escrowAddress = required("ESCROW_ADDRESS");
const provider = new JsonRpcProvider(rpcUrl, chainId);

function requiredKeeperKey(): string {
  return required("KEEPER_PRIVATE_KEY");
}

const wallet = new Wallet(requiredKeeperKey(), provider);
const escrow = new Contract(escrowAddress, KEEPER_ABI, wallet);
const readEscrow = new Contract(escrowAddress, KEEPER_ABI, provider);

const pollIntervalMs = Number(process.env.KEEPER_POLL_INTERVAL_MS ?? "30000");
const bootstrapBlocks = Number(process.env.KEEPER_SCAN_BLOCKS ?? "50000");
let nextBlock = 0;
const candidates = new Set<string>();
const attempted = new Set<string>();

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function discoverOrders(fromBlock: number, toBlock: number) {
  if (toBlock < fromBlock) return;
  const orderCreatedEvent = readEscrow.interface.getEvent("OrderCreated");
  if (!orderCreatedEvent) throw new Error("OrderCreated event is missing from keeper ABI");
  const logs = await provider.getLogs({ address: escrowAddress, fromBlock, toBlock, topics: [orderCreatedEvent.topicHash] });
  for (const log of logs) {
    const parsed = readEscrow.interface.parseLog(log);
    if (!parsed || parsed.name !== "OrderCreated") continue;
    candidates.add(BigInt(parsed.args[0]).toString());
  }
}

async function expireCandidates(now: bigint) {
  for (const key of Array.from(candidates)) {
    if (attempted.has(key)) continue;
    try {
      const orderId = BigInt(key);
      const order = await readEscrow.getOrder(orderId);
      if (Number(order.state) !== PAYMENT_PENDING) { candidates.delete(key); continue; }
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
      candidates.delete(key);
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
  if (Number(network.chainId) !== chainId) throw new Error(`RPC chain ${network.chainId} does not match CHAIN_ID ${chainId}`);
  const latest = await provider.getBlockNumber();
  if (nextBlock === 0) nextBlock = Math.max(0, latest - bootstrapBlocks + 1);
  if (nextBlock <= latest) {
    const chunkSize = 2000;
    for (let start = nextBlock; start <= latest; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, latest);
      await discoverOrders(start, end);
      nextBlock = end + 1;
    }
  }
  const block = await provider.getBlock(latest);
  const now = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000));
  await expireCandidates(now);
}

async function main() {
  const keeper = await wallet.getAddress();
  console.log(`UStetu expiry keeper started on chain ${chainId}`);
  console.log(`Keeper wallet: ${keeper}`);
  console.log(`Escrow: ${escrowAddress}`);
  console.log(`Poll interval: ${pollIntervalMs} ms`);
  for (;;) {
    try { await runOnce(); } catch (error) { console.error("Expiry keeper cycle failed:", error); }
    await sleep(pollIntervalMs);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();