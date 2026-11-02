import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 8453;
const ESCROW_ADDRESS = "0x0ffe00bae47d6b4ad9d6a12ec649dd8866f130ae";

export async function GET(request: Request) {
  const seller = new URL(request.url).searchParams.get("seller")?.toLowerCase() ?? "";
  const listingId = new URL(request.url).searchParams.get("listingId");
  if (!/^0x[a-f0-9]{40}$/.test(seller)) {
    return NextResponse.json({ ok: false, error: "A valid seller address is required." }, { status: 400 });
  }
  if (listingId !== null && !/^\d+$/.test(listingId)) {
    return NextResponse.json({ ok: false, error: "Listing ID must be a non-negative integer." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Order index is not configured." }, { status: 503 });
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: state, error: stateError } = await db
      .from("indexer_state")
      .select("last_scanned_block,last_finalized_block,updated_at")
      .eq("chain_id", CHAIN_ID)
      .eq("contract_address", ESCROW_ADDRESS)
      .maybeSingle();
    if (stateError) throw stateError;
    if (!state) {
      return NextResponse.json({ ok: true, ready: false, orderIds: [], indexedThrough: 0, lastUpdatedAt: null });
    }

    const ids = new Set<string>();
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      let query = db
        .from("indexer_events")
        .select("payload,block_number")
        .eq("chain_id", CHAIN_ID)
        .eq("contract_address", ESCROW_ADDRESS)
        .eq("event_name", "OrderCreated")
        .eq("removed", false)
        .not("finalized_at", "is", null)
        .filter("payload->>seller", "eq", seller)
        .order("block_number", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (listingId !== null) query = query.filter("payload->>listingId", "eq", listingId);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      for (const row of rows) {
        const id = String((row.payload as Record<string, unknown> | null)?.orderId ?? "");
        if (/^\d+$/.test(id)) ids.add(id);
      }
      if (rows.length < pageSize) break;
    }

    const updatedAt = state.updated_at ? Date.parse(state.updated_at) : 0;
    const fresh = Number.isFinite(updatedAt) && Date.now() - updatedAt <= 10 * 60 * 1000;
    return NextResponse.json({
      ok: true,
      ready: fresh,
      orderIds: [...ids],
      indexedThrough: state.last_finalized_block ?? state.last_scanned_block,
      lastUpdatedAt: state.updated_at
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Seller order discovery failed", error);
    return NextResponse.json({ ok: false, error: "Could not read indexed seller orders." }, { status: 503 });
  }
}
