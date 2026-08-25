export type ListingStatus = "UNKNOWN" | "ACTIVE" | "PAUSED" | "CLOSED" | "SUSPENDED";

export interface ListingProjection {
  chain_id: number;
  contract_address: string;
  listing_id: string;
  seller: string;
  token_id: string;
  token_contract: string | null;
  payment_token: string;
  price: string;
  inventory_deposited: string;
  inventory_locked: string;
  min_order_amount: string;
  max_order_amount: string;
  status: ListingStatus;
  created_at: string | null;
  updated_at: string | null;
  last_block_number: number;
  last_transaction_hash: string | null;
  last_log_index: number | null;
  finalized: boolean;
}

export interface IndexerEventRow {
  chain_id: number;
  contract_address: string;
  block_number: number;
  block_hash: string | null;
  transaction_hash: string;
  log_index: number;
  event_name: string;
  payload: Record<string, unknown>;
  finalized_at: string | null;
  removed: boolean;
}
