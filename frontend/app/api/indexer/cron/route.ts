import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, toBeHex, zeroPadValue } from "ethers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAIN_ID = 8453;
const START_BLOCK = 51_811_281;
const ESCROW_ADDRESS = "0x0ffE00bAe47d6b4AD9d6A12ec649dd8866f130ae";
const REGISTRY_ADDRESS = "0x237023EC6A39e59CEbd1D231777308c354ba542F";
const CONFIRMATIONS = 12;
// Keep each invocation short. The cursor is committed after every chunk.
const MAX_BLOCKS_PER_RUN = 200;
const RPC_LOG_CHUNK_SIZE = 25;
const MAX_CONCURRENCY = 4;

const ESCROW_ABI = [
  "event InventoryDeposited(uint256 indexed listingId,address indexed seller,address indexed token,uint256 amount)",
  "event InventoryWithdrawn(uint256 indexed listingId,address indexed seller,address indexed token,uint256 amount)",
  "event ListingPriceUpdated(uint256 indexed listingId,address indexed seller,uint256 oldPrice,uint256 newPrice)",
  "event ListingOrderLimitsUpdated(uint256 indexed listingId,address indexed seller,uint256 oldMinOrderAmount,uint256 oldMaxOrderAmount,uint256 newMinOrderAmount,uint256 newMaxOrderAmount)",
  "event ListingPaused(uint256 indexed listingId,address indexed seller)",
  "event ListingResumed(uint256 indexed listingId,address indexed seller)",
  "event ListingClosed(uint256 indexed listingId,address indexed seller)",
  "event OrderCreated(uint256 indexed orderId,uint256 indexed listingId,address indexed buyer,address seller,address recipient,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,address paymentToken)",
  "event OrderCompleted(uint256 indexed orderId,address indexed buyer,address indexed seller,uint256 tokenAmount)",
  "event OrderExpired(uint256 indexed orderId,address indexed buyer,address indexed seller,uint256 tokenAmount)",
  "event AutoReleased(uint256 indexed orderId,address indexed buyer,address indexed seller,uint256 tokenAmount)",
  "function paymentToken() view returns (address)",
  "function getListing(uint256 listingId) view returns (uint256 tokenId,address seller,uint256 price,uint256 inventoryDeposited,uint256 inventoryLocked,uint256 minOrderAmount,uint256 maxOrderAmount,uint8 status,uint64 createdAt,uint64 updatedAt)",
  "function getOrder(uint256 orderId) view returns (uint256 listingId,address buyer,address seller,address recipient,address token,address paymentToken,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,uint256 marketplaceFee,uint256 sellerProceeds,uint8 state,uint64 createdAt,uint64 paidAt,uint64 completedAt,uint64 expiresAt)"
] as const;
const REGISTRY_ABI = [
  "function getToken(bytes32 tokenId) view returns (uint256 chainId,address contractAddress,uint8 decimalsSnapshot,address registeredBy,uint64 registeredAt)"
] as const;
const SUPPORTED_EVENTS = new Set([
  "InventoryDeposited", "InventoryWithdrawn", "ListingPriceUpdated",
  "ListingOrderLimitsUpdated", "ListingPaused", "ListingResumed",
  "ListingClosed", "OrderCreated", "OrderCompleted", "OrderExpired", "AutoReleased"
]);
const ORDER_EVENTS = new Set(["OrderCompleted", "OrderExpired", "AutoReleased"]);

type IndexedLog = {
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  index: number;
  topics: string[];
  data: string;
};

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  }
  return value;
}

function statusName(value: unknown): "ACTIVE" | "PAUSED" | "CLOSED" | "UNKNOWN" {
  const n = Number(value);
  return n === 0 ? "ACTIVE" : n === 1 ? "PAUSED" : n === 2 ? "CLOSED" : "UNKNOWN";
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate.?limit|compute units per second|request limit reached/i.test(message);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

async function withRpcFallback<T>(
  providers: JsonRpcProvider[],
  label: string,
  operation: (provider: JsonRpcProvider) => Promise<T>
): Promise<T> {
  const errors: string[] = [];
  for (const [index, provider] of providers.entries()) {
    try {
      return await operation(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`provider #${index + 1}: ${message.slice(0, 180)}`);
    }
  }
  throw new Error(`All Base RPC providers failed for ${label}. ${errors.join(" | ")}`);
}

async function fetchChunkLogs(fromBlock: number, toBlock: number, providers: JsonRpcProvider[]): Promise<IndexedLog[]> {
  return withRpcFallback(providers, `logs ${fromBlock}-${toBlock}`, async (provider) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const logs = await provider.getLogs({ address: ESCROW_ADDRESS, fromBlock, toBlock });
        return logs.map((log) => ({
          blockNumber: log.blockNumber,
          blockHash: log.blockHash,
          transactionHash: log.transactionHash,
          index: log.index,
          topics: [...log.topics],
          data: log.data
        }));
      } catch (error) {
        if (!isRateLimitError(error) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 350 * (2 ** attempt)));
      }
    }
    return [];
  });
}

async function processChunk(
  fromBlock: number,
  toBlock: number,
  providers: JsonRpcProvider[],
  db: SupabaseClient<any>,
  paymentToken: string
): Promise<{ logsFound: number; eventsProcessed: number; listingsUpdated: number }> {
  const logs = await fetchChunkLogs(fromBlock, toBlock, providers);
  const escrowInterfaces = new Contract(ESCROW_ADDRESS, ESCROW_ABI, providers[0]).interface;
  const parsedLogs: Array<{ log: IndexedLog; name: string; args: any; listingId?: bigint }> = [];

  for (const log of logs) {
    const parsed = escrowInterfaces.parseLog(log);
    if (!parsed || !SUPPORTED_EVENTS.has(parsed.name)) continue;
    parsedLogs.push({ log, name: parsed.name, args: parsed.args });
  }

  if (parsedLogs.length === 0) {
    const { error } = await db.from("indexer_state").upsert({
      chain_id: CHAIN_ID,
      contract_address: ESCROW_ADDRESS.toLowerCase(),
      last_scanned_block: toBlock,
      last_finalized_block: toBlock,
      updated_at: new Date().toISOString()
    }, { onConflict: "chain_id,contract_address" });
    if (error) throw error;
    return { logsFound: logs.length, eventsProcessed: 0, listingsUpdated: 0 };
  }

  // Resolve order -> listing once per unique order, not once for every event.
  const orderIds = [...new Set(parsedLogs.filter((item) => ORDER_EVENTS.has(item.name)).map((item) => String(item.args[0])))];
  const orderListingIds = new Map<string, bigint>();
  await mapLimit(orderIds, MAX_CONCURRENCY, async (orderId) => {
    const order = await withRpcFallback(providers, `getOrder ${orderId}`, (rpc) =>
      new Contract(ESCROW_ADDRESS, ESCROW_ABI, rpc).getOrder(BigInt(orderId))
    );
    orderListingIds.set(orderId, order.listingId as bigint);
  });

  for (const item of parsedLogs) {
    if (item.name === "OrderCreated") item.listingId = item.args[1] as bigint;
    else if (ORDER_EVENTS.has(item.name)) item.listingId = orderListingIds.get(String(item.args[0]));
    else item.listingId = item.args[0] as bigint;
    if (item.listingId === undefined) throw new Error(`Could not resolve listing for ${item.name}`);
  }

  const eventRows = parsedLogs.map(({ log, name, args }) => ({
    chain_id: CHAIN_ID,
    contract_address: ESCROW_ADDRESS.toLowerCase(),
    block_number: log.blockNumber,
    block_hash: log.blockHash,
    transaction_hash: log.transactionHash,
    log_index: log.index,
    event_name: name,
    payload: jsonValue(args.toObject()),
    finalized_at: new Date().toISOString(),
    removed: false
  }));
  const { error: eventError } = await db.from("indexer_events").upsert(eventRows, {
    onConflict: "chain_id,contract_address,transaction_hash,log_index",
    ignoreDuplicates: true
  });
  if (eventError) throw eventError;

  const latestByListing = new Map<string, IndexedLog>();
  for (const item of parsedLogs) latestByListing.set(String(item.listingId), item.log);
  const listingIds = [...latestByListing.keys()];
  const listingRows = await mapLimit(listingIds, MAX_CONCURRENCY, async (listingId) => {
    const raw = await withRpcFallback(providers, `getListing ${listingId}`, (rpc) =>
      new Contract(ESCROW_ADDRESS, ESCROW_ABI, rpc).getListing(BigInt(listingId))
    );
    const tokenId = BigInt(raw.tokenId.toString());
    const tokenIdBytes32 = zeroPadValue(toBeHex(tokenId), 32);
    const token = await withRpcFallback(providers, `registry getToken ${tokenId}`, (rpc) =>
      new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, rpc).getToken(tokenIdBytes32)
    );
    const log = latestByListing.get(listingId)!;
    return {
      chain_id: CHAIN_ID,
      contract_address: ESCROW_ADDRESS.toLowerCase(),
      listing_id: listingId,
      seller: String(raw.seller).toLowerCase(),
      token_id: tokenId.toString(),
      token_contract: String(token.contractAddress).toLowerCase(),
      payment_token: paymentToken.toLowerCase(),
      price: raw.price.toString(),
      inventory_deposited: raw.inventoryDeposited.toString(),
      inventory_locked: raw.inventoryLocked.toString(),
      min_order_amount: raw.minOrderAmount.toString(),
      max_order_amount: raw.maxOrderAmount.toString(),
      status: statusName(raw.status),
      created_at: Number(raw.createdAt) ? new Date(Number(raw.createdAt) * 1000).toISOString() : null,
      updated_at: Number(raw.updatedAt) ? new Date(Number(raw.updatedAt) * 1000).toISOString() : null,
      last_block_number: log.blockNumber,
      last_transaction_hash: log.transactionHash,
      last_log_index: log.index,
      finalized: true
    };
  });

  const { error: listingError } = await db.from("listings").upsert(listingRows, {
    onConflict: "chain_id,contract_address,listing_id"
  });
  if (listingError) throw listingError;

  // Commit cursor only after both the canonical event ledger and projection succeed.
  const { error: stateError } = await db.from("indexer_state").upsert({
    chain_id: CHAIN_ID,
    contract_address: ESCROW_ADDRESS.toLowerCase(),
    last_scanned_block: toBlock,
    last_finalized_block: toBlock,
    updated_at: new Date().toISOString()
  }, { onConflict: "chain_id,contract_address" });
  if (stateError) throw stateError;

  return { logsFound: logs.length, eventsProcessed: parsedLogs.length, listingsUpdated: listingRows.length };
}

export async function GET(request: Request) {
  const secrets = [process.env.INDEXER_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean);
  const authorization = request.headers.get("authorization");
  if (secrets.length === 0 || !authorization || !secrets.some((secret) => authorization === `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Missing Supabase server configuration" }, { status: 503 });
  }

  const rpcUrls = [
    process.env.BASE_RPC_URL || "https://mainnet.base.org",
    process.env.BASE_RPC_FALLBACK_URL || "https://base-rpc.publicnode.com",
    process.env.BASE_RPC_FALLBACK_URL_2
  ].filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);
  const providers = rpcUrls.map((url) => new JsonRpcProvider(url, CHAIN_ID));
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const validProviders: JsonRpcProvider[] = [];
    const providerErrors: string[] = [];
    for (const [index, provider] of providers.entries()) {
      try {
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== CHAIN_ID) throw new Error(`Wrong chain ID: ${network.chainId}`);
        validProviders.push(provider);
      } catch (error) {
        providerErrors.push(`provider #${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (validProviders.length === 0) {
      throw new Error(`No configured RPC endpoint is connected to Base mainnet. ${providerErrors.join(" | ")}`);
    }

    const latest = await withRpcFallback(validProviders, "latest block number", (rpc) => rpc.getBlockNumber());
    const target = latest - Number(process.env.INDEXER_CONFIRMATIONS || CONFIRMATIONS);
    const { data: state, error: stateError } = await db
      .from("indexer_state")
      .select("last_scanned_block")
      .eq("chain_id", CHAIN_ID)
      .eq("contract_address", ESCROW_ADDRESS.toLowerCase())
      .maybeSingle();
    if (stateError) throw stateError;

    let cursor = state ? Number(state.last_scanned_block) : START_BLOCK;
    if (!Number.isSafeInteger(cursor) || cursor < START_BLOCK) cursor = START_BLOCK;
    const fromBlock = cursor + 1;
    if (fromBlock > target) {
      // Refresh heartbeat while caught up; discovery duplicate checks use this timestamp.
      const { error } = await db.from("indexer_state").upsert({
        chain_id: CHAIN_ID,
        contract_address: ESCROW_ADDRESS.toLowerCase(),
        last_scanned_block: cursor,
        last_finalized_block: cursor,
        updated_at: new Date().toISOString()
      }, { onConflict: "chain_id,contract_address" });
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Already caught up", latestBlock: latest, indexedThrough: cursor, caughtUp: true });
    }

    const paymentToken = await withRpcFallback(validProviders, "paymentToken", (rpc) =>
      new Contract(ESCROW_ADDRESS, ESCROW_ABI, rpc).paymentToken()
    );
    const endBlock = Math.min(cursor + MAX_BLOCKS_PER_RUN, target);
    let logsFound = 0;
    let eventsProcessed = 0;
    let listingsUpdated = 0;
    let chunksProcessed = 0;

    for (let start = fromBlock; start <= endBlock; start += RPC_LOG_CHUNK_SIZE) {
      const end = Math.min(start + RPC_LOG_CHUNK_SIZE - 1, endBlock);
      const result = await processChunk(start, end, validProviders, db, String(paymentToken));
      logsFound += result.logsFound;
      eventsProcessed += result.eventsProcessed;
      listingsUpdated += result.listingsUpdated;
      chunksProcessed++;
    }

    const indexedThrough = endBlock;
    return NextResponse.json({
      ok: true, fromBlock, toBlock: indexedThrough, latestBlock: latest,
      logsFound, eventsProcessed, listingsUpdated, chunksProcessed,
      caughtUp: indexedThrough >= target
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("UStetu cron indexer failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    for (const provider of providers) provider.destroy();
  }
}
