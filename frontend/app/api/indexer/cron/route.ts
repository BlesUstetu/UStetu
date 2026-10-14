import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAIN_ID = 8453;
const START_BLOCK = 51_811_281;
const ESCROW_ADDRESS = "0x0ffE00bAe47d6b4AD9d6A12ec649dd8866f130ae";
const REGISTRY_ADDRESS = "0x237023EC6A39e59CEbd1D231777308c354ba542F";
const CONFIRMATIONS = 12;
const MAX_BLOCKS_PER_RUN = 20_000;
const BASESCAN_API_URL = "https://api.basescan.org/api";
const MAX_LOGS_PER_QUERY = 1_000;

type IndexedLog = {
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  index: number;
  topics: string[];
  data: string;
};

type BaseScanLogResponse = {
  status?: string;
  message?: string;
  result?: string | Array<Record<string, unknown>>;
};

function parseExplorerNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const text = String(value ?? "");
  return text.startsWith("0x") ? Number.parseInt(text, 16) : Number(text);
}

async function fetchBaseScanLogs(fromBlock: number, toBlock: number, apiKey: string): Promise<IndexedLog[]> {
  const params = new URLSearchParams({
    module: "logs", action: "getLogs", address: ESCROW_ADDRESS,
    fromBlock: String(fromBlock), toBlock: String(toBlock), page: "1",
    offset: String(MAX_LOGS_PER_QUERY), apikey: apiKey
  });
  const response = await fetch(`${BASESCAN_API_URL}?${params.toString()}`, {
    method: "GET", cache: "no-store", signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`BaseScan logs API returned HTTP ${response.status}`);
  const payload = await response.json() as BaseScanLogResponse;
  const message = String(payload.message ?? "").toLowerCase();
  const resultText = typeof payload.result === "string" ? payload.result.toLowerCase() : "";

  if (payload.status === "1" && Array.isArray(payload.result)) {
    const rawLogs = payload.result;
    // BaseScan caps a page at 1,000 records. Split dense ranges so no logs are silently lost.
    if (rawLogs.length >= MAX_LOGS_PER_QUERY && fromBlock === toBlock) {
      throw new Error(`BaseScan returned the maximum 1,000 logs for single block ${fromBlock}; refusing to advance an incomplete index.`);
    }
    if (rawLogs.length >= MAX_LOGS_PER_QUERY && fromBlock < toBlock) {
      const middle = Math.floor((fromBlock + toBlock) / 2);
      const [left, right] = await Promise.all([
        fetchBaseScanLogs(fromBlock, middle, apiKey),
        fetchBaseScanLogs(middle + 1, toBlock, apiKey)
      ]);
      return [...left, ...right];
    }
    return rawLogs.map((raw) => {
      const topics = Array.isArray(raw.topics)
        ? raw.topics.map(String)
        : [raw.topic0, raw.topic1, raw.topic2, raw.topic3].filter((item) => item != null).map(String);
      return {
        blockNumber: parseExplorerNumber(raw.blockNumber),
        blockHash: String(raw.blockHash ?? ""),
        transactionHash: String(raw.transactionHash ?? ""),
        index: parseExplorerNumber(raw.logIndex ?? raw.index),
        topics,
        data: String(raw.data ?? "0x")
      };
    });
  }

  if (message.includes("no records") || resultText.includes("no records found")) return [];
  const detail = `${message} ${resultText}`;
  if (fromBlock < toBlock && (
    detail.includes("too many") || detail.includes("maximum") || detail.includes("query timeout") ||
    detail.includes("result window") || detail.includes("more than 1000")
  )) {
    const middle = Math.floor((fromBlock + toBlock) / 2);
    const [left, right] = await Promise.all([
      fetchBaseScanLogs(fromBlock, middle, apiKey),
      fetchBaseScanLogs(middle + 1, toBlock, apiKey)
    ]);
    return [...left, ...right];
  }
  throw new Error(`BaseScan logs API error (${payload.status ?? "unknown"}): ${String(payload.result ?? payload.message ?? "Unexpected response")}`);
}

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

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonValue(v)]));
  }
  return value;
}
function statusName(value: unknown): "ACTIVE" | "PAUSED" | "CLOSED" | "UNKNOWN" {
  const n = Number(value);
  return n === 0 ? "ACTIVE" : n === 1 ? "PAUSED" : n === 2 ? "CLOSED" : "UNKNOWN";
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Missing Supabase server configuration" }, { status: 503 });
  }

  const baseScanApiKey = process.env.BASESCAN_API_KEY;
  if (!baseScanApiKey) {
    return NextResponse.json({ ok: false, error: "Missing BASESCAN_API_KEY. Configure a BaseScan API key in Vercel environment variables to index historical events without archive RPC access." }, { status: 503 });
  }

  const rpcUrls = [
    process.env.BASE_RPC_URL || "https://mainnet.base.org",
    process.env.BASE_RPC_FALLBACK_URL || "https://base-rpc.publicnode.com",
    process.env.BASE_RPC_FALLBACK_URL_2 || "https://1rpc.io/base"
  ].filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);
  const confirmations = Number(process.env.INDEXER_CONFIRMATIONS || CONFIRMATIONS);
  const providers = rpcUrls.map((url) => new JsonRpcProvider(url, CHAIN_ID));
  const provider = providers[0];
  const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
  const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) throw new Error(`Wrong RPC chain: ${network.chainId}`);

    const latest = await provider.getBlockNumber();
    const target = latest - confirmations;
    const { data: state, error: stateError } = await db
      .from("indexer_state")
      .select("last_scanned_block,last_finalized_block")
      .eq("chain_id", CHAIN_ID)
      .eq("contract_address", ESCROW_ADDRESS.toLowerCase())
      .maybeSingle();
    if (stateError) throw stateError;

    const from = state ? Number(state.last_scanned_block) + 1 : START_BLOCK;
    if (from > target) {
      return NextResponse.json({ ok: true, message: "Already caught up", fromBlock: from, latestBlock: latest, indexedThrough: state?.last_scanned_block ?? null });
    }
    // Historical event logs come from BaseScan's indexed API, not archive eth_getLogs RPC.
    // Keep each run bounded while allowing a much faster initial backfill.
    let to = Math.min(from + MAX_BLOCKS_PER_RUN - 1, target);
    let logs: IndexedLog[] = await fetchBaseScanLogs(from, to, baseScanApiKey);
    const finalizedThrough = Math.max(0, to - confirmations);
    let processed = 0;

    for (const log of logs) {
      const parsed = escrow.interface.parseLog(log);
      if (!parsed) continue;
      const name = parsed.name;
      const supported = new Set(["InventoryDeposited","InventoryWithdrawn","ListingPriceUpdated","ListingOrderLimitsUpdated","ListingPaused","ListingResumed","ListingClosed","OrderCreated","OrderCompleted","OrderExpired","AutoReleased"]);
      if (!supported.has(name)) continue;

      let listingId: bigint;
      if (name === "OrderCreated") listingId = parsed.args[1] as bigint;
      else if (name === "OrderCompleted" || name === "OrderExpired" || name === "AutoReleased") {
        const order = await escrow.getOrder(parsed.args[0] as bigint);
        listingId = order.listingId as bigint;
      } else listingId = parsed.args[0] as bigint;

      const { error: eventError } = await db.from("indexer_events").upsert({
        chain_id: CHAIN_ID,
        contract_address: ESCROW_ADDRESS.toLowerCase(),
        block_number: log.blockNumber,
        block_hash: log.blockHash,
        transaction_hash: log.transactionHash,
        log_index: log.index,
        event_name: name,
        payload: jsonValue(parsed.args.toObject()),
        finalized_at: log.blockNumber <= finalizedThrough ? new Date().toISOString() : null,
        removed: false
      }, { onConflict: "chain_id,contract_address,transaction_hash,log_index", ignoreDuplicates: true });
      if (eventError) throw eventError;

      const raw = await escrow.getListing(listingId);
      const token = await registry.getToken(raw.tokenId);
      const paymentToken = await escrow.paymentToken();
      const { error: listingError } = await db.from("listings").upsert({
        chain_id: CHAIN_ID,
        contract_address: ESCROW_ADDRESS.toLowerCase(),
        listing_id: listingId.toString(),
        seller: String(raw.seller).toLowerCase(),
        token_id: BigInt(raw.tokenId.toString()).toString(),
        token_contract: String(token.contractAddress).toLowerCase(),
        payment_token: String(paymentToken).toLowerCase(),
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
        finalized: log.blockNumber <= finalizedThrough
      }, { onConflict: "chain_id,contract_address,listing_id" });
      if (listingError) throw listingError;
      processed++;
    }

    const { error: saveError } = await db.from("indexer_state").upsert({
      chain_id: CHAIN_ID,
      contract_address: ESCROW_ADDRESS.toLowerCase(),
      last_scanned_block: to,
      last_finalized_block: finalizedThrough,
      updated_at: new Date().toISOString()
    }, { onConflict: "chain_id,contract_address" });
    if (saveError) throw saveError;

    return NextResponse.json({ ok: true, fromBlock: from, toBlock: to, latestBlock: latest, logsFound: logs.length, eventsProcessed: processed, caughtUp: to >= target });
  } catch (error) {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown; status?: unknown };
    const message = error instanceof Error
      ? error.message
      : typeof candidate?.message === "string"
        ? candidate.message
        : JSON.stringify(error) || "Indexer failed";
    const details = {
      message,
      code: candidate?.code ?? null,
      details: candidate?.details ?? null,
      hint: candidate?.hint ?? null,
      status: candidate?.status ?? null
    };
    console.error("UStetu cron indexer failed", JSON.stringify(details));
    return NextResponse.json({ ok: false, error: message, code: details.code, details: details.details, hint: details.hint }, { status: 500 });
  } finally {
    for (const rpcProvider of providers) rpcProvider.destroy();
  }
}
