import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 8453;
const ESCROW_ADDRESS = "0x0ffe00bae47d6b4ad9d6a12ec649dd8866f130ae";
const INDEXER_MAX_AGE_MS = 10 * 60 * 1000;
const CONFIRMATIONS = 12;

async function getLatestBaseBlock(): Promise<number> {
  const urls = [
    process.env.BASE_RPC_URL || "https://mainnet.base.org",
    process.env.BASE_RPC_FALLBACK_URL || "https://base-rpc.publicnode.com",
    process.env.BASE_RPC_FALLBACK_URL_2
  ].filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);
  const errors: string[] = [];
  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        signal: AbortSignal.timeout(2500),
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const payload = await response.json() as { result?: string; error?: { message?: string } };
      if (payload.error) throw new Error(payload.error.message || "RPC returned an error");
      if (!payload.result || !/^0x[0-9a-f]+$/i.test(payload.result)) throw new Error("RPC returned an invalid block number");
      return Number(BigInt(payload.result));
    } catch (error) {
      errors.push(`provider #${index + 1}: ${error instanceof Error ? error.message.slice(0, 140) : String(error)}`);
    }
  }
  throw new Error(`Base RPC freshness check failed. ${errors.join(" | ")}`);
}

type ListingRow = {
  listing_id_text: string;
  seller: string;
  token_id: string;
  token_contract: string;
  payment_token: string;
  price: string;
  inventory_deposited: string;
  inventory_locked: string;
  min_order_amount: string;
  max_order_amount: string;
  status: "UNKNOWN" | "ACTIVE" | "PAUSED" | "CLOSED" | "SUSPENDED";
  finalized: boolean;
  available_inventory: string | number;
};

export async function GET(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, ready: false, error: "Listing index is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const seller = url.searchParams.get("seller")?.toLowerCase();
  const token = url.searchParams.get("token")?.toLowerCase();
  const isDuplicateCheck = Boolean(seller && token);

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  try {
    const { data: state, error: stateError } = await db
      .from("indexer_state")
      .select("last_scanned_block,updated_at")
      .eq("chain_id", CHAIN_ID)
      .eq("contract_address", ESCROW_ADDRESS)
      .maybeSingle();
    if (stateError) throw stateError;

    // Normal marketplace browsing is a database read only: it never waits for Base RPC.
    // RPC freshness is checked only on the seller+token duplicate-guard request.
    let latestBlock: number | null = null;
    let latestBlockError: string | null = null;
    if (isDuplicateCheck) {
      try {
        latestBlock = await getLatestBaseBlock();
      } catch (error) {
        latestBlockError = error instanceof Error ? error.message : "Base RPC is unavailable.";
      }
    }

    const requiredThrough = latestBlock === null ? null : Math.max(0, latestBlock - CONFIRMATIONS);
    const indexedThrough = Number(state?.last_scanned_block ?? 0);
    const updatedAt = state?.updated_at ? Date.parse(state.updated_at) : 0;
    const stateIsFresh = Boolean(
      state && Number.isFinite(updatedAt) &&
      Date.now() - updatedAt >= 0 &&
      Date.now() - updatedAt <= INDEXER_MAX_AGE_MS
    );
    const ready = Boolean(
      state && stateIsFresh &&
      (!isDuplicateCheck || (requiredThrough !== null && indexedThrough >= requiredThrough))
    );

    let query = db
      .from("listings")
      .select("listing_id_text:listing_id::text,seller,token_id,token_contract,payment_token,price,inventory_deposited,inventory_locked,min_order_amount,max_order_amount,status,finalized,available_inventory")
      .eq("chain_id", CHAIN_ID)
      .eq("contract_address", ESCROW_ADDRESS)
      .order("last_block_number", { ascending: false });

    if (!isDuplicateCheck) query = query.eq("finalized", true);
    if (seller) query = query.eq("seller", seller);
    if (token) query = query.eq("token_contract", token);

    const { data, error } = await query.limit(5000);
    if (error) throw error;
    const rows = (data ?? []) as ListingRow[];

    return NextResponse.json({
      ok: true,
      ready,
      displayReady: true,
      indexStatus: ready ? "current" : "syncing",
      freshnessError: ready ? null : latestBlockError
        ? "Base RPC freshness check is temporarily unavailable."
        : isDuplicateCheck
          ? "Indexer is behind the latest finalized Base blocks."
          : "Indexer heartbeat is stale; duplicate checks remain blocked.",
      indexedThrough: state?.last_scanned_block ?? null,
      requiredThrough,
      latestBlock,
      lastUpdatedAt: state?.updated_at ?? null,
      listings: rows.map(({ listing_id_text, ...row }) => ({ ...row, listing_id: listing_id_text }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read listing index.";
    console.error("Listing discovery API failed", message);
    return NextResponse.json({ ok: false, ready: false, error: "Could not read the listing index." }, { status: 503 });
  }
}
