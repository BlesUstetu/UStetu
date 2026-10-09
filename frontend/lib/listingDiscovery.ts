import { createPublicClient, fallback, http, parseAbiItem } from "viem";
import { base } from "wagmi/chains";
import { USTETU_ESCROW_ADDRESS, USTETU_BOOTSTRAP_LISTING_ID, USTETU_TOKEN_ADDRESS, USTETU_TOKEN_ID } from "@/lib/contracts";

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

const event = parseAbiItem(
  "event InventoryDeposited(uint256 indexed listingId,address indexed seller,address indexed token,uint256 amount)"
);

const client = createPublicClient({
  chain: base,
  transport: fallback([
    http("https://mainnet.base.org", { timeout: 12_000, retryCount: 1 }),
    http("https://base-rpc.publicnode.com", { timeout: 12_000, retryCount: 1 }),
    http("https://base.publicnode.com", { timeout: 12_000, retryCount: 1 })
  ])
});

// Historical discovery is permanently anchored to the UStetuEscrow deployment
// block. This prevents older listings from disappearing merely because they
// fall outside a rolling block window.
const DISCOVERY_FROM_BLOCK_ENV = "NEXT_PUBLIC_USTETU_LISTING_DISCOVERY_FROM_BLOCK";
// Keep RPC requests bounded, but discover in parallel so the marketplace does
// not remain blank while historical listings are being scanned.
const CHUNK_SIZE = 10_000n;
const MIN_RETRY_CHUNK_SIZE = 1n;
const MAX_CONCURRENT_CHUNKS = 4;
const DISCOVERY_CACHE_MS = 45_000;
let discoveryCache: { at: number; listings: DiscoveredListing[] } | null = null;
let discoveryInFlight: Promise<DiscoveredListing[]> | null = null;

export async function discoverListingsOnChain(
  onProgress?: (listings: DiscoveredListing[]) => void
): Promise<DiscoveredListing[]> {
  const now = Date.now();
  if (discoveryCache && now - discoveryCache.at < DISCOVERY_CACHE_MS) {
    return discoveryCache.listings;
  }
  if (discoveryInFlight) return discoveryInFlight;

  discoveryInFlight = (async () => {
  const latest = await client.getBlockNumber();
  const configuredFrom = process.env.NEXT_PUBLIC_USTETU_LISTING_DISCOVERY_FROM_BLOCK;
  if (!configuredFrom || !/^\d+$/.test(configuredFrom)) {
    throw new Error(
      `Missing or invalid ${DISCOVERY_FROM_BLOCK_ENV}. Set it to the UStetuEscrow deployment block.`
    );
  }
  const fromBlock = BigInt(configuredFrom);
  if (fromBlock > latest) {
    throw new Error(`${DISCOVERY_FROM_BLOCK_ENV} is greater than the current Base Mainnet block.`);
  }

  const discovered = new Map<string, DiscoveredListing>();
  const failedRanges: string[] = [];

  // Known live DNA listing verified directly against Base Mainnet:
  // getListing(153209047311743547595822967164959468753) returned the seller,
  // tokenId, ACTIVE status, and 10 DNA inventory shown in the transaction audit.
  // Seed it before historical RPC scanning so RPC log-range failures cannot
  // make this existing listing disappear from the marketplace.
  const DNA_LISTING_ID = "153209047311743547595822967164959468753";
  const DNA_TOKEN_ID = "18082943315677373775591912433609382296421641131137588533591529078015460316683";
  const DNA_SELLER = "0x73f10c9FcD5A28644c5e39e3B58a970D8696A522" as const;
  const DNA_TOKEN_ADDRESS = "0xDff883676E664E3DBF8ad5F8c00171340efe84FF" as const;
  discovered.set(DNA_LISTING_ID, {
    listing_id: DNA_LISTING_ID,
    seller: DNA_SELLER,
    token_id: DNA_TOKEN_ID,
    token_contract: DNA_TOKEN_ADDRESS,
    payment_token: "",
    price: "",
    inventory_deposited: "",
    inventory_locked: "",
    min_order_amount: "",
    max_order_amount: "",
    status: "ACTIVE"
  });

  // Publish the verified seed immediately. Do not make the user wait for the
  // first historical eth_getLogs batch before the known listing is queried.
  onProgress?.(Array.from(discovered.values()));

  const ranges: Array<{ start: bigint; end: bigint }> = [];
  for (let start = fromBlock; start <= latest; start += CHUNK_SIZE) {
    ranges.push({
      start,
      end: start + CHUNK_SIZE - 1n > latest ? latest : start + CHUNK_SIZE - 1n
    });
  }
  // Prioritize the oldest 320k blocks first. The marketplace's known DNA
  // listing was created shortly after Escrow deployment; scanning newest-first
  // made the UI spend most of its time on unrelated recent blocks before
  // reaching it. After the first 32 chunks, scan the remaining ranges newest-first.
  const oldestPriority = ranges.slice(0, 32);
  const newestPriority = ranges.slice(32).reverse();
  ranges.splice(0, ranges.length, ...oldestPriority, ...newestPriority);

  for (let offset = 0; offset < ranges.length; offset += MAX_CONCURRENT_CHUNKS) {
    const batch = ranges.slice(offset, offset + MAX_CONCURRENT_CHUNKS);
    const readLogsAdaptive = async (start: bigint, end: bigint): Promise<Awaited<ReturnType<typeof client.getLogs>>> => {
      try {
        return await client.getLogs({
          address: USTETU_ESCROW_ADDRESS,
          event,
          fromBlock: start,
          toBlock: end
        });
      } catch (error) {
        // Public RPC providers impose different eth_getLogs range limits.
        // Recursively split failing ranges; a single oversized range should
        // never abort the complete historical discovery scan.
        if (end - start + 1n <= MIN_RETRY_CHUNK_SIZE) throw error;
        const middle = start + (end - start) / 2n;
        const left = await readLogsAdaptive(start, middle);
        const right = await readLogsAdaptive(middle + 1n, end);
        return [...left, ...right];
      }
    };
    // Isolate failures per range. One unavailable RPC slice must not abort
    // the entire discovery job and hide every listing found in other slices.
    const results = await Promise.all(batch.map(async ({ start, end }) => {
      try {
        return await readLogsAdaptive(start, end);
      } catch (error) {
        console.error(
          "[USTETU listing discovery] Failed to read Escrow logs for blocks",
          start.toString(),
          end.toString(),
          error
        );
        failedRanges.push(`${start.toString()}-${end.toString()}`);
        return [];
      }
    }));

    for (const logs of results) {
      for (const log of logs) {
        // viem's adaptive recursive helper widens the inferred log type; the
        // runtime event decoder still supplies args for this typed event.
        const args = (log as typeof log & { args: { listingId?: bigint; seller?: `0x${string}`; token?: `0x${string}` } }).args;
        const listingId = args.listingId?.toString();
        const seller = args.seller;
        const token = args.token;
        if (!listingId || !seller || !token) continue;
        const knownListing = discovered.get(listingId);
        discovered.set(listingId, {
          listing_id: listingId,
          seller,
          token_id: knownListing?.token_id ?? "",
          token_contract: token,
          payment_token: "",
          price: "",
          inventory_deposited: "",
          inventory_locked: "",
          min_order_amount: "",
          max_order_amount: "",
          status: "ACTIVE"
        });
      }
    }

    // Progressive rendering: callers can show listings already discovered
    // instead of waiting for the complete historical scan.
    onProgress?.(Array.from(discovered.values()));
  }

  // Do not cache an incomplete scan as if it were authoritative. A failed
  // range is retried on the next refresh instead of silently hiding listings.
  if (failedRanges.length > 0) {
    throw new Error(
      `Listing discovery could not read ${failedRanges.length} block range(s): ${failedRanges.slice(0, 3).join(", ")}. Retrying on refresh.`
    );
  }

  if (!discovered.has(USTETU_BOOTSTRAP_LISTING_ID.toString())) {
    discovered.set(USTETU_BOOTSTRAP_LISTING_ID.toString(), {
      listing_id: USTETU_BOOTSTRAP_LISTING_ID.toString(),
      seller: "0x52dF1Ff4c9CD41869a691627cb1c903e68a3863b",
      token_id: USTETU_TOKEN_ID,
      token_contract: USTETU_TOKEN_ADDRESS,
      payment_token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      price: "200000",
      inventory_deposited: "10000000000000000000000000",
      inventory_locked: "0",
      min_order_amount: "1000000000000000000",
      max_order_amount: "10000000000000000000000000",
      status: "ACTIVE"
    });
  }

  const result = Array.from(discovered.values());
    discoveryCache = { at: Date.now(), listings: result };
    return result;
  })();
  try {
    return await discoveryInFlight;
  } finally {
    discoveryInFlight = null;
  }
}