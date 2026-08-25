import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import type { IndexerEventRow, ListingProjection } from "./types.js";

export const db: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function eventExists(
  transactionHash: string,
  logIndex: number
): Promise<boolean> {
  const { data, error } = await db
    .from("indexer_events")
    .select("id")
    .eq("chain_id", config.chainId)
    .eq("contract_address", config.escrowAddress.toLowerCase())
    .eq("transaction_hash", transactionHash)
    .eq("log_index", logIndex)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function insertEvent(row: IndexerEventRow): Promise<void> {
  const { error } = await db.from("indexer_events").upsert(row, {
    onConflict: "chain_id,contract_address,transaction_hash,log_index",
    ignoreDuplicates: true
  });
  if (error) throw error;
}

export async function upsertListing(listing: ListingProjection): Promise<void> {
  const { error } = await db.from("listings").upsert(listing, {
    onConflict: "chain_id,contract_address,listing_id"
  });
  if (error) throw error;
}

export async function getIndexerState() {
  const { data, error } = await db
    .from("indexer_state")
    .select("last_scanned_block,last_finalized_block")
    .eq("chain_id", config.chainId)
    .eq("contract_address", config.escrowAddress.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveIndexerState(
  lastScannedBlock: number,
  lastFinalizedBlock: number
): Promise<void> {
  const { error } = await db.from("indexer_state").upsert(
    {
      chain_id: config.chainId,
      contract_address: config.escrowAddress.toLowerCase(),
      last_scanned_block: lastScannedBlock,
      last_finalized_block: lastFinalizedBlock
    },
    { onConflict: "chain_id,contract_address" }
  );
  if (error) throw error;
}
