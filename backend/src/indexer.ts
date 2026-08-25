import { Contract, JsonRpcProvider, type Log } from "ethers";
import { config } from "./config.js";
import { ESCROW_ABI } from "./abi.js";
import {
  eventExists,
  getIndexerState,
  insertEvent,
  saveIndexerState,
  upsertListing
} from "./store.js";
import type { ListingProjection } from "./types.js";

const provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
const escrow = new Contract(config.escrowAddress, ESCROW_ABI, provider);

function address(value: unknown): string {
  return String(value).toLowerCase();
}

function big(value: unknown): string {
  return BigInt(String(value)).toString();
}

function statusName(value: unknown): ListingProjection["status"] {
  const n = Number(value);
  if (n === 0) return "ACTIVE";
  if (n === 1) return "PAUSED";
  if (n === 2) return "CLOSED";
  if (n === 3) return "SUSPENDED";
  return "UNKNOWN";
}

async function refreshListing(listingId: bigint, log: Log, finalized: boolean) {
  const raw = await escrow.getListing(listingId);
  const block = await provider.getBlock(log.blockNumber);
  if (!block) throw new Error(`Missing block ${log.blockNumber}`);

  const projection: ListingProjection = {
    chain_id: config.chainId,
    contract_address: config.escrowAddress.toLowerCase(),
    listing_id: listingId.toString(),
    seller: address(raw.seller),
    token_id: big(raw.tokenId),
    token_contract: null,
    payment_token: address(raw.paymentToken),
    price: big(raw.price),
    inventory_deposited: big(raw.inventoryDeposited),
    inventory_locked: big(raw.inventoryLocked),
    min_order_amount: big(raw.minOrderAmount),
    max_order_amount: big(raw.maxOrderAmount),
    status: statusName(raw.status),
    created_at: new Date(Number(raw.createdAt) * 1000).toISOString(),
    updated_at: new Date(Number(raw.updatedAt) * 1000).toISOString(),
    last_block_number: log.blockNumber,
    last_transaction_hash: log.transactionHash,
    last_log_index: log.index,
    finalized
  };

  await upsertListing(projection);
}

async function processLog(log: Log, finalized: boolean) {
  const parsed = escrow.interface.parseLog(log);
  if (!parsed) return;

  const eventName = parsed.name;
  const args = parsed.args;
  const listingId = args[0] as bigint | undefined;
  if (listingId === undefined) return;

  const duplicate = await eventExists(log.transactionHash, log.index);
  if (duplicate) return;

  await insertEvent({
    chain_id: config.chainId,
    contract_address: config.escrowAddress.toLowerCase(),
    block_number: log.blockNumber,
    block_hash: log.blockHash,
    transaction_hash: log.transactionHash,
    log_index: log.index,
    event_name: eventName,
    payload: Object.fromEntries(
      Object.entries(args).filter(([key]) => Number.isNaN(Number(key)))
    ),
    finalized_at: finalized ? new Date().toISOString() : null,
    removed: false
  });

  await refreshListing(listingId, log, finalized);
}

async function scan(fromBlock: number, toBlock: number) {
  if (toBlock < fromBlock) return;
  const logs = await provider.getLogs({
    address: config.escrowAddress,
    fromBlock,
    toBlock
  });
  const finalizedBlock = Math.max(0, toBlock - config.confirmations);
  for (const log of logs) {
    await processLog(log, log.blockNumber <= finalizedBlock);
  }
  await saveIndexerState(toBlock, finalizedBlock);
}

export async function runOnce() {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) {
    throw new Error(`RPC chain ${network.chainId} does not match CHAIN_ID ${config.chainId}`);
  }

  const latest = await provider.getBlockNumber();
  const state = await getIndexerState();
  const from = state ? Number(state.last_scanned_block) + 1 : config.startBlock;
  if (from > latest) return;

  const chunkSize = 2_000;
  for (let start = from; start <= latest; start += chunkSize) {
    await scan(start, Math.min(start + chunkSize - 1, latest));
  }
}

async function main() {
  console.log(`UStetu indexer started on chain ${config.chainId}`);
  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error("Indexer cycle failed:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
