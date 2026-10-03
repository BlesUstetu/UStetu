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
const MAX_CONCURRENT_CHUNKS = 6;
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
  if (!configuredFrom || !/^\\d+$/.test(configuredFrom)) {
    throw new Error(
      `Missing or invalid ${DISCOVERY_FROM_BLOCK_ENV}. Set it to the UStetuEscrow deployment block.`
    );
  }
  const fromBlock = BigInt(configuredFrom);
  if (fromBlock > latest) {
    throw new Error(`${DISCOVERY_FROM_BLOCK_ENV} is greater than the current Base Mainnet block.`);
  }

  const discovered = new Map<string, DiscoveredListing>();

  const ranges: Array<{ start: bigint; end: bigint }> = [];
  for (let start = fromBlock; start <= latest; start += CHUNK_SIZE) {
    ranges.push({
      start,
      end: start + CHUNK_SIZE - 1n > latest ? latest : start + CHUNK_SIZE - 1n
    });
  }
  // Scan newest blocks first so recently created listings become visible
  // quickly while the remaining historical range continues in the background.
  ranges.reverse();

  for (let offset = 0; offset < ranges.length; offset += MAX_CONCURRENT_CHUNKS) {
    const batch = ranges.slice(offset, offset + MAX_CONCURRENT_CHUNKS);
    const results = await Promise.all(batch.map(async ({ start, end }) => {
      return client.getLogs({
        address: USTETU_ESCROW_ADDRESS,
        event,
        fromBlock: start,
        toBlock: end
      });
    }));

    for (const logs of results) {
      for (const log of logs) {
        const listingId = log.args.listingId?.toString();
        const seller = log.args.seller;
        const token = log.args.token;
        if (!listingId || !seller || !token) continue;
        discovered.set(listingId, {
          listing_id: listingId,
          seller,
          token_id: "",
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