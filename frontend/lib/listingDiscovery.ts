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
  created_at: string | null;
};

type ListingIndexResponse = {
  ok: boolean;
  ready: boolean;
  displayReady?: boolean;
  indexStatus?: "current" | "syncing";
  freshnessError?: string | null;
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
      : "UNKNOWN",
    created_at: typeof row.created_at === "string" ? row.created_at : null
  };
}

async function readIndex(
  params: Record<string, string> = {},
  requireFresh = false
): Promise<ListingIndexResponse> {
  const url = new URL(INDEX_URL, window.location.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const result = await response.json().catch(() => null) as ListingIndexResponse | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || "Could not read the Supabase listing index.");
  }
  if (requireFresh && !result.ready) {
    throw new Error(result.freshnessError || result.error || "Listing index is not current; duplicate check is blocked.");
  }
  return result;
}

/**
 * Listing discovery reads finalized rows from the server-side Supabase projection.
 * Display can use that projection while it catches up; duplicate checks remain
 * fail-closed until the endpoint confirms the index is current.
 */
export async function discoverListingsOnChain(
  onProgress?: (listings: DiscoveredListing[]) => void,
  forceRefresh = false
): Promise<DiscoveredListing[]> {
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.at < CACHE_MS) {
    onProgress?.(cached.listings);
    return cached.listings;
  }
  if (inFlight) {
    await inFlight;
    if (!forceRefresh && cached) {
      onProgress?.(cached.listings);
      return cached.listings;
    }
  }

  if (forceRefresh) {
    const result = await readIndex({}, false);
    const listings = (result.listings ?? []).map(normalizeListing);
    cached = { at: Date.now(), listings };
    onProgress?.(listings);
    return listings;
  }

  inFlight = (async () => {
    const result = await readIndex({}, false);
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
  const result = await readIndex({ seller: seller.toLowerCase(), token: token.toLowerCase() }, true);
  return (result.listings ?? [])
    .map((row) => String(row.listing_id ?? ""))
    .filter((id) => /^\d+$/.test(id));
}
