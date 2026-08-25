import { frontendConfig } from "../config";

export interface Listing {
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
  available_inventory: string;
  min_order_amount: string;
  max_order_amount: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  finalized: boolean;
}

interface ListingsResponse {
  success: boolean;
  items: Listing[];
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
}

export async function fetchListings(params: {
  limit?: number;
  cursor?: string;
  status?: string;
  seller?: string;
  token?: string;
} = {}): Promise<ListingsResponse> {
  const url = new URL("/listings", frontendConfig.apiBaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, String(value));
  });
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to load listings");
  return body;
}
