import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 8453;
const ESCROW_ADDRESS = "0x0ffe00bae47d6b4ad9d6a12ec649dd8866f130ae";
const INDEXER_MAX_AGE_MS = 10 * 60 * 1000;
const CONFIRMATIONS = 12;

async function getLatestBaseBlock(apiKey: string): Promise<number> {
  const params = new URLSearchParams({ module: "proxy", action: "eth_blockNumber", apikey: apiKey });
  const response = await fetch(`https://api.basescan.org/api?${params.toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`BaseScan block API returned HTTP ${response.status}`);
  const payload = await response.json() as { status?: string; result?: string; message?: string };
  if (payload.status !== "1" || !payload.result || !payload.result.startsWith("0x")) {
    throw new Error(`Could not verify latest Base block: ${payload.message ?? "invalid response"}`);
  }
  return Number.parseInt(payload.result, 16);
}

type ListingRow = {
  listing_id: string;
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
  const baseScanApiKey = process.env.BASESCAN_API_KEY;
  if (!supabaseUrl || !serviceKey || !baseScanApiKey) {
    return NextResponse.json({ ok: false, ready: false, error: "Listing index is not configured. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and BASESCAN_API_KEY." }, { status: 503 });
  }

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
    const latestBlock = await getLatestBaseBlock(baseScanApiKey);
    const requiredThrough = Math.max(0, latestBlock - CONFIRMATIONS);
    const indexedThrough = Number(state?.last_scanned_block ?? 0);
    const updatedAt = state?.updated_at ? Date.parse(state.updated_at) : 0;
    const ready = Boolean(
      state &&
      indexedThrough >= requiredThrough &&
      Number.isFinite(updatedAt) &&
      Date.now() - updatedAt <= INDEXER_MAX_AGE_MS
    );

    if (!ready) {
      return NextResponse.json({
        ok: true,
        ready: false,
        error: "Listing index is not current. Duplicate checks are temporarily unavailable.",
        indexedThrough: state?.last_scanned_block ?? null,
        requiredThrough,
        latestBlock,
        lastUpdatedAt: state?.updated_at ?? null,
        listings: []
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const url = new URL(request.url);
    const seller = url.searchParams.get("seller")?.toLowerCase();
    const token = url.searchParams.get("token")?.toLowerCase();
    let query = db
      .from("listings")
      .select("listing_id,seller,token_id,token_contract,payment_token,price,inventory_deposited,inventory_locked,min_order_amount,max_order_amount,status,finalized,available_inventory")
      .eq("chain_id", CHAIN_ID)
      .eq("contract_address", ESCROW_ADDRESS)
      .order("last_block_number", { ascending: false });

    if (seller) query = query.eq("seller", seller);
    if (token) query = query.eq("token_contract", token);

    const rows: ListingRow[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as ListingRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
      if (rows.length > 5000) {
        return NextResponse.json({ ok: false, ready: false, error: "Listing index result exceeds safe response size." }, { status: 503 });
      }
    }

    return NextResponse.json({
      ok: true,
      ready: true,
      indexedThrough: state?.last_scanned_block ?? null,
      lastUpdatedAt: state?.updated_at ?? null,
      listings: rows
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read listing index.";
    console.error("Listing discovery API failed", message);
    return NextResponse.json({ ok: false, ready: false, error: "Could not read the listing index." }, { status: 503 });
  }
}
