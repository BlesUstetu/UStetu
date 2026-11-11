import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { JsonRpcProvider } from "ethers";

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
  for (const [providerIndex, url] of urls.entries()) {
    const provider = new JsonRpcProvider(url, CHAIN_ID);
    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) throw new Error(`Wrong chain ID: ${network.chainId}`);
      return await provider.getBlockNumber();
    } catch (error) {
      errors.push(`provider #${providerIndex + 1}: ${error instanceof Error ? error.message.slice(0, 180) : String(error)}`);
    } finally {
      provider.destroy();
    }
  }
  throw new Error(`All Base RPC providers failed to verify the latest block. ${errors.join(" | ")}`);
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
  created_at: string | null;
};

export async function GET(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, ready: false, error: "Listing index is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
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
    // The indexer projection is useful for displaying already-finalized listings
    // even while it is catching up. Freshness is enforced separately for writes
    // (seller + token duplicate checks) by the client.
    let latestBlock: number | null = null;
    let latestBlockError: string | null = null;
    try {
      latestBlock = await getLatestBaseBlock();
    } catch (error) {
      latestBlockError = error instanceof Error ? error.message : "Base RPC is unavailable.";
      console.warn("Listing discovery freshness check unavailable", latestBlockError);
    }

    const requiredThrough = latestBlock === null
      ? null
      : Math.max(0, latestBlock - CONFIRMATIONS);
    const indexedThrough = Number(state?.last_scanned_block ?? 0);
    const updatedAt = state?.updated_at ? Date.parse(state.updated_at) : 0;
    const stateIsFresh = Boolean(
      state &&
      Number.isFinite(updatedAt) &&
      Date.now() - updatedAt <= INDEXER_MAX_AGE_MS
    );
    const ready = Boolean(
      state &&
      requiredThrough !== null &&
      indexedThrough >= requiredThrough &&
      stateIsFresh
    );

    const url = new URL(request.url);
    const seller = url.searchParams.get("seller")?.toLowerCase();
    const token = url.searchParams.get("token")?.toLowerCase();
    let query = db
      .from("listings")
      .select("listing_id_text:listing_id::text,seller,token_id,token_contract,payment_token,price,inventory_deposited,inventory_locked,min_order_amount,max_order_amount,status,finalized,available_inventory,created_at")
      .eq("chain_id", CHAIN_ID)
      .eq("contract_address", ESCROW_ADDRESS)
      // created_at is sourced from the immutable on-chain Listing.createdAt,
      // unlike last_block_number which changes whenever listing activity occurs.
      .order("created_at", { ascending: false, nullsFirst: false })
      .order("listing_id", { ascending: false });

    // Marketplace display only needs finalized rows. Duplicate checks pass both
    // seller and token and must also see the indexer's recent, not-yet-finalized
    // projection rows to avoid allowing a duplicate during the confirmation lag.
    if (!(seller && token)) query = query.eq("finalized", true);

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
      // "ready" is deliberately strict: callers that create listings must
      // require a fully current index before duplicate checks can pass.
      ready,
      // Finalized rows remain safe to display while the indexer catches up.
      displayReady: true,
      indexStatus: ready ? "current" : "syncing",
      freshnessError: ready ? null : latestBlockError
        ? "Base RPC freshness check is temporarily unavailable."
        : "Indexer is behind the latest finalized Base blocks.",
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
