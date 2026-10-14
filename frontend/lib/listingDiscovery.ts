export type DiscoveredListing = {
  listing_id: string;
  seller: `0x${string}`;
  token_id: string;
  token_contract: `0x${string}`;
  payment_token: string;
  price: string;
  inventory_deposited: string;
  inventory_locked: string;
  min_order_amount: string;
  max_order_amount: string;
  status: "UNKNOWN" | "ACTIVE" | "PAUSED" | "CLOSED";
};

type ListingIndexResponse = {
  ok: boolean;
  ready: boolean;
  error?: string;
  indexedThrough?: number | string | null;
  lastUpdatedAt?: string | null;
  listings?: Array<Record<string, unknown>>;
};

const INDEX_URL = "/api/listings/discovery";
const CACHE_MS = 10_000;
let cached: { at: number; listings: DiscoveredListing[] } | null = null;
let inFlight: Promise<DiscoveredListing[]> | null = null;

function normalizeListing(row: Record<string, unknown>): DiscoveredListing {
  return {
    listing_id: String(row.listing_id ?? ""),
    seller: String(row.seller ?? "").toLowerCase() as `0x${string}`,
    token_id: String(row.token_id ?? ""),
    token_contract: String(row.token_contract ?? "").toLowerCase() as `0x${string}`,
    payment_token: String(row.payment_token ?? "").toLowerCase(),
    price: String(row.price ?? ""),
    inventory_deposited: String(row.inventory_deposited ?? "0"),
    inventory_locked: String(row.inventory_locked ?? "0"),
    min_order_amount: String(row.min_order_amount ?? "0"),
    max_order_amount: String(row.max_order_amount ?? "0"),
    status: row.status === "ACTIVE" || row.status === "PAUSED" || row.status === "CLOSED"
      ? row.status
      : "UNKNOWN"
  };
}

async function readIndex(params: Record<string, string> = {}): Promise<ListingIndexResponse> {
  const url = new URL(INDEX_URL, window.location.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const result = await response.json().catch(() => null) as ListingIndexResponse | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || "Could not read the Supabase listing index.");
  }
  if (!result.ready) {
    throw new Error(result.error || "Listing index is not current; duplicate check is blocked.");
  }
  return result;
}

/**
 * Listing discovery reads the server-side Supabase projection instead of
 * scanning the entire Base event history in every browser session.
 * The endpoint fails closed whenever the indexer cursor is missing or stale.
 */
export async function discoverListingsOnChain(
  onProgress?: (listings: DiscoveredListing[]) => void
): Promise<DiscoveredListing[]> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    onProgress?.(cached.listings);
    return cached.listings;
  }
  if (inFlight) {
    const listings = await inFlight;
    onProgress?.(listings);
    return listings;
  }

  inFlight = (async () => {
    const result = await readIndex();
    const listings = (result.listings ?? []).map(normalizeListing);
    cached = { at: Date.now(), listings };
    return listings;
  })();

  try {
    const listings = await inFlight;
    onProgress?.(listings);
    return listings;
  } finally {
    inFlight = null;
  }
}

/**
 * Returns existing listing IDs for an exact seller + token contract pair.
 * The index must be fresh; otherwise the request throws and callers must
 * block Create Listing rather than risk creating a duplicate.
 */
export async function discoverSellerTokenListingIds(
  seller: `0x${string}`,
  token: `0x${string}`
): Promise<string[]> {
  const result = await readIndex({ seller: seller.toLowerCase(), token: token.toLowerCase() });
  return (result.listings ?? [])
    .map((row) => String(row.listing_id ?? ""))
    .filter((id) => /^\d+$/.test(id));
}
