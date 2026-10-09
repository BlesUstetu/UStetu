"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import Header from "@/components/Header";
import BuyModalFlow from "@/components/BuyModalFlow";
import TokenLogo from "@/components/TokenLogo";
import { useLanguage } from "@/lib/LanguageContext";
import { discoverListingsOnChain } from "@/lib/listingDiscovery";
import {
  erc20MetadataAbi,
  escrowAbi,
  registryAbi,
  USTETU_BOOTSTRAP_LISTING_ID,
  USTETU_BOOTSTRAP_SELLER,
  USTETU_ESCROW_ADDRESS,
  USTETU_REGISTRY_ADDRESS,
  USTETU_TOKEN_ID,
  USTETU_TOKEN_ADDRESS,
} from "@/lib/contracts";

// UStetuTypes.ListingStatus: ACTIVE = 0, PAUSED = 1, CLOSED = 2.
const LISTING_ACTIVE = 0;
const INDEXER_API_URL = process.env.NEXT_PUBLIC_USTETU_INDEXER_API_URL ?? "";

type ApiListing = {
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
  status: "UNKNOWN" | "ACTIVE" | "PAUSED" | "CLOSED";
};

const BOOTSTRAP_LISTING: ApiListing = {
  listing_id: USTETU_BOOTSTRAP_LISTING_ID.toString(),
  seller: USTETU_BOOTSTRAP_SELLER,
  token_id: USTETU_TOKEN_ID,
  token_contract: USTETU_TOKEN_ADDRESS,
  payment_token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  price: "200000",
  inventory_deposited: "10000000000000000000000000",
  inventory_locked: "0",
  min_order_amount: "1000000000000000000",
  max_order_amount: "10000000000000000000000000",
  status: "ACTIVE",
};

type LiveListing = {
  listingId: bigint;
  seller: `0x${string}`;
  tokenId: `0x${string}`;
  address: `0x${string}`;
  tokenName: string;
  symbol: string;
  tokenDecimals: number;
  paymentToken: `0x${string}`;
  paymentSymbol: string;
  paymentDecimals: number;
  availableRaw: bigint;
  available: string;
  priceRaw: bigint;
  price: string;
  minOrderAmount: bigint;
  maxOrderAmount: bigint;
  chainId: number;
  status: number;
};

function hexTokenId(value: string): `0x${string}` {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

function normalizeAddress(value: string | null): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

export default function HomePage() {
  const { t } = useLanguage();
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [copiedAddress, setCopiedAddress] = useState(false);

  const paymentTokenQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "paymentToken",
    query: { refetchInterval: 30000 }
  });
  const paymentTokenAddress = paymentTokenQuery.data;

  const listingConfigs = useMemo(
    () => listings.map((item) => ({
      address: USTETU_ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "getListing" as const,
      args: [BigInt(item.listing_id)] as const
    })),
    [listings]
  );

  const listingQueries = useReadContracts({
    contracts: listingConfigs as never[],
    query: { enabled: listingConfigs.length > 0, refetchInterval: 10000 }
  });

  const tokenConfigs = useMemo(
    () => (listingQueries.data ?? []).map((entry) => {
      const chainListing: any = entry?.result;
      // Keep one registry read per listing index. Filtering failed listing
      // reads here would shift tokenQueries.data indexes and attach token
      // metadata to the wrong listing.
      const tokenId = chainListing?.tokenId?.toString() ?? "0";
      return {
        address: USTETU_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "getToken" as const,
        args: [hexTokenId(tokenId)] as const
      };
    }),
    [listingQueries.data]
  );

  const tokenQueries = useReadContracts({
    contracts: tokenConfigs as never[],
    query: { enabled: tokenConfigs.length > 0 }
  });

  const paymentSymbolQuery = useReadContract({
    address: paymentTokenAddress,
    abi: erc20MetadataAbi,
    functionName: "symbol",
    query: { enabled: Boolean(paymentTokenAddress) }
  });
  const paymentDecimalsQuery = useReadContract({
    address: paymentTokenAddress,
    abi: erc20MetadataAbi,
    functionName: "decimals",
    query: { enabled: Boolean(paymentTokenAddress) }
  });

  const loadListings = async (background = false) => {
    if (!background) setLoading(true);
    setApiError("");
    try {
      // The indexer is an acceleration layer, not the authoritative discovery
      // source. Load it when configured, then always run the permanent on-chain
      // historical discovery once per page session so listings cannot be hidden
      // by an incomplete/stale indexer.
      const mergeListings = (items: ApiListing[]) => {
        setListings((current) => {
          const byId = new Map<string, ApiListing>([
            [BOOTSTRAP_LISTING.listing_id, BOOTSTRAP_LISTING],
            ...current.map((item) => [item.listing_id, item] as const),
            ...items.map((item) => [item.listing_id, item] as const)
          ]);
          return Array.from(byId.values());
        });
      };

      setListings((current) => current.length > 0 ? current : [BOOTSTRAP_LISTING]);

      if (INDEXER_API_URL) {
        const baseUrl = INDEXER_API_URL.replace(/\/$/, "");
        const collected: ApiListing[] = [];
        let cursor: string | null = null;
        do {
          const query = new URLSearchParams({ limit: "100" });
          if (cursor) query.set("cursor", cursor);
          const response = await fetch(baseUrl + "/listings?" + query.toString(), { cache: "no-store" });
          const body = await response.json() as { success?: boolean; items?: ApiListing[]; pagination?: { nextCursor?: string | null; hasMore?: boolean }; error?: string };
          if (!response.ok || !body.success) throw new Error(body.error ?? "Unable to read marketplace listings.");
          collected.push(...(body.items ?? []));
          cursor = body.pagination?.hasMore ? (body.pagination.nextCursor ?? null) : null;
          if (body.pagination?.hasMore && !cursor) throw new Error("Marketplace pagination returned an invalid cursor.");
        } while (cursor);
        mergeListings(collected.filter((item) => item.token_contract));
      }

      // Do not block the marketplace UI on the full historical RPC scan.
      // The permanent scan starts at the Escrow deployment block and merges
      // InventoryDeposited events progressively as they are discovered.
      // With an indexer configured, this is done on the initial page load so
      // the indexer can never hide older listings. Without an indexer, it also
      // runs on background refreshes.
      const shouldRunHistoricalDiscovery = !background || !INDEXER_API_URL;
      if (shouldRunHistoricalDiscovery) {
        if (!background) setLoading(false);
        const discovered = await discoverListingsOnChain((items) => {
          mergeListings(items);
        });
        mergeListings(discovered);
      } else if (!background) {
        setLoading(false);
      }
    } catch (error) {
      // Preserve already discovered listings, but do not hide discovery failures.
      // listingDiscovery.ts avoids caching incomplete scans, so the next refresh
      // can retry failed RPC ranges instead of permanently omitting their listings.
      setListings((current) => current.length > 0 ? current : [BOOTSTRAP_LISTING]);
      setApiError(error instanceof Error ? error.message : "Unable to discover marketplace listings.");
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    void loadListings();
    const timer = window.setInterval(() => void loadListings(true), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const liveListings = useMemo<LiveListing[]>(() => {
    if (paymentTokenAddress === undefined || paymentDecimalsQuery.data === undefined) return [];
    const paymentDecimals = Number(paymentDecimalsQuery.data);
    const paymentSymbol = paymentSymbolQuery.data ?? "USDC";

    return listings.map((item, index) => {
      const token: any = tokenQueries.data?.[index]?.result;
      const chainListing: any = listingQueries.data?.[index]?.result;
      if (!token || !chainListing) return null;

      const indexedTokenAddress = normalizeAddress(item.token_contract);
      const registeredTokenAddress = token.contractAddress as `0x${string}`;
      if (!indexedTokenAddress || registeredTokenAddress.toLowerCase() !== indexedTokenAddress.toLowerCase()) return null;

      const chainTokenId = hexTokenId(chainListing.tokenId.toString());
      const indexedTokenId = item.token_id ? hexTokenId(item.token_id) : chainTokenId;
      if (item.token_id && indexedTokenId.toLowerCase() !== chainTokenId.toLowerCase()) return null;
      if (chainListing.seller.toLowerCase() !== item.seller.toLowerCase()) return null;

      // The Escrow payment token is authoritative. The indexer is discovery-only.
      const indexedPaymentToken = normalizeAddress(item.payment_token);
      if (indexedPaymentToken && indexedPaymentToken.toLowerCase() !== paymentTokenAddress.toLowerCase()) return null;

      const tokenDecimals = Number(token.decimalsSnapshot);
      const inventoryDeposited = BigInt(chainListing.inventoryDeposited);
      const inventoryLocked = BigInt(chainListing.inventoryLocked);
      const priceRaw = BigInt(chainListing.price);
      const minOrderAmount = BigInt(chainListing.minOrderAmount);
      const maxOrderAmount = BigInt(chainListing.maxOrderAmount);
      const availableRaw = inventoryDeposited > inventoryLocked
        ? inventoryDeposited - inventoryLocked
        : 0n;
      const listingId = BigInt(item.listing_id);

      return {
        listingId,
        seller: chainListing.seller,
        tokenId: indexedTokenId,
        address: registeredTokenAddress,
        tokenName: "Token",
        symbol: "TOKEN",
        tokenDecimals,
        paymentToken: paymentTokenAddress,
        paymentSymbol,
        paymentDecimals,
        availableRaw,
        available: formatUnits(availableRaw, tokenDecimals),
        priceRaw,
        price: formatUnits(priceRaw, paymentDecimals),
        minOrderAmount,
        maxOrderAmount,
        chainId: 8453,
        status: Number(chainListing.status)
      };
    }).filter((item): item is LiveListing => item !== null);
  }, [listings, tokenQueries.data, listingQueries.data, paymentTokenAddress, paymentDecimalsQuery.data, paymentSymbolQuery.data]);
  const metadataConfigs = useMemo(() => liveListings.map((item) => ([
    { address: item.address, abi: erc20MetadataAbi, functionName: "name" as const },
    { address: item.address, abi: erc20MetadataAbi, functionName: "symbol" as const }
  ])).flat(), [liveListings]);
  const metadataQueries = useReadContracts({
    contracts: metadataConfigs as never[],
    query: { enabled: metadataConfigs.length > 0 }
  });

  const enrichedListings = useMemo(() => liveListings.map((item, index) => ({
    ...item,
    tokenName: String(metadataQueries.data?.[index * 2]?.result ?? "Token"),
    symbol: String(metadataQueries.data?.[index * 2 + 1]?.result ?? "TOKEN")
  })), [liveListings, metadataQueries.data]);



  // Token logo availability is presentation-only. It must never decide whether a
  // valid on-chain listing is visible in the marketplace.
  const logoVerifiedListings = enrichedListings;

  // Inventory is the visibility rule. A listing remains discoverable while
  // any inventory is available, regardless of ACTIVE/PAUSED/CLOSED status.
  // Status only controls whether the Buy action is enabled.
  const availableListings = useMemo(
    () => logoVerifiedListings.filter((item) => item.availableRaw > 0n),
    [logoVerifiedListings]
  );

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableListings;
    return availableListings.filter((item) =>
      [item.address, item.tokenName, item.symbol, item.seller].some((value) => value.toLowerCase().includes(q))
    );
  }, [availableListings, search]);

  const selected = selectedId === null ? null : availableListings.find((item) => item.listingId === selectedId) ?? null;
  const isLoading = loading || paymentTokenQuery.isLoading || paymentDecimalsQuery.isLoading || (listings.length > 0 && (tokenQueries.isLoading || listingQueries.isLoading));
  const hasError = Boolean(apiError) && listings.length === 0;

  // Diagnose every discovered listing that the marketplace filters out.
  // A listing can exist in Escrow but remain hidden if Registry metadata or
  // its live inventory does not pass the same validation as visible rows.
  const hiddenListingDiagnostics = listings.flatMap((item, index) => {
    const id = item.listing_id;
    if (availableListings.some((visible) => visible.listingId.toString() === id)) return [];
    const chainListing: any = listingQueries.data?.[index]?.result;
    const registeredToken: any = tokenQueries.data?.[index]?.result;
    let reason = "";
    if (listingQueries.isLoading || tokenQueries.isLoading || paymentTokenQuery.isLoading || paymentDecimalsQuery.isLoading) {
      reason = "waiting for Escrow/Registry reads";
    } else if (!chainListing) {
      reason = "Escrow getListing read failed or returned no listing";
    } else if (!registeredToken || !registeredToken.contractAddress || /^0x0{40}$/i.test(registeredToken.contractAddress)) {
      reason = "Registry getToken returned no registered token for Escrow tokenId";
    } else if (!item.token_contract || registeredToken.contractAddress.toLowerCase() !== item.token_contract.toLowerCase()) {
      reason = "Registry token contract does not match discovered token contract";
    } else if (chainListing.seller.toLowerCase() !== item.seller.toLowerCase()) {
      reason = "seller address does not match Escrow";
    } else if (item.token_id && hexTokenId(item.token_id).toLowerCase() !== hexTokenId(chainListing.tokenId.toString()).toLowerCase()) {
      reason = "tokenId does not match Escrow";
    } else if (paymentTokenAddress && item.payment_token && item.payment_token.toLowerCase() !== paymentTokenAddress.toLowerCase()) {
      reason = "payment token does not match Escrow";
    } else if (BigInt(chainListing.inventoryDeposited) <= BigInt(chainListing.inventoryLocked)) {
      reason = "available inventory is zero";
    } else {
      reason = "listing failed a live validation check";
    }
    return [{ id, token: item.token_contract ?? "unknown token", reason }];
  });
  const refreshMarketplace = async () => { await loadListings(); };

  return (
    <main className="app-shell">
      <Header showHome={false} />
      <section className="marketplace-shell">
        <div className="marketplace-heading">
          <div className="marketplace-heading-spacer" aria-hidden="true" />
          <div className="search-glass">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} />
          </div>
        </div>

        <div className="listing-glass">
          <div className="listing-toolbar">
            <span className="listing-count">{isLoading ? t("readingListings") : `${filteredListings.length} ${filteredListings.length === 1 ? t("listing") : t("listings")}`}</span>
            <span className="status-dot"><i /> {t("live")}</span>
          </div>
          {apiError && <div className="listing-discovery-warning" role="status">{apiError}</div>}
          {hiddenListingDiagnostics.map((item) => <div className="listing-discovery-warning" role="status" key={item.id}>Listing #{item.id} ({item.token}): hidden because {item.reason}.</div>)}
          <div className="listing-table-wrap">
            <table className="listing-table">
              <thead><tr><th>{t("token")}</th><th>{t("seller")}</th><th>{t("available")}</th><th>{t("price")}</th><th>{t("networkLabel")}</th><th /></tr></thead>
              <tbody>
                {hasError ? <tr><td colSpan={6} className="empty-state">{apiError}</td></tr> :
                 isLoading ? <tr><td colSpan={6} className="empty-state">{t("readingListings")}</td></tr> :
                 filteredListings.length === 0 ? <tr><td colSpan={6} className="empty-state">{t("noMatch")}</td></tr> :
                 filteredListings.map((item) => (
                  <tr key={item.listingId.toString()} className="listing-row" onClick={() => setSelectedId(item.listingId)}>
                    <td><div className="token-cell"><TokenLogo address={item.address} chainId={item.chainId} name={item.tokenName} symbol={item.symbol} size={38} /><div><strong>{item.tokenName}</strong><span>{item.symbol}</span></div><span className="registered-badge">Registered</span></div></td>
                    <td className="mono">{item.seller.slice(0, 6)}…{item.seller.slice(-4)}</td>
                    <td>{item.available} {item.symbol}</td><td><strong>{item.price}</strong> {item.paymentSymbol}</td><td><span className="network-text">Base Mainnet</span></td>
                    <td><button className="row-action" type="button">{t("view")}</button></td>
                  </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selected && (
        <>
          <button className="drawer-backdrop" aria-label={t("close")} onClick={() => { setSelectedId(null); setBuyOpen(false); }} />
          <aside className="token-drawer" aria-label="Registered token">
            <div className="drawer-topline"><span aria-hidden="true"></span><button className="drawer-close" type="button" onClick={() => setSelectedId(null)}>×</button></div>
            <div className="drawer-token-head"><TokenLogo address={selected.address} chainId={selected.chainId} name={selected.tokenName} symbol={selected.symbol} size={58} /><div><h2>{selected.tokenName}</h2><span>Registered on-chain</span></div></div>
            <div className="detail-grid">
              <div><span>{t("name")}</span><strong>{selected.tokenName}</strong></div><div><span>{t("symbol")}</span><strong>{selected.symbol}</strong></div><div><span>{t("decimals")}</span><strong>{selected.tokenDecimals}</strong></div><div><span>Payment</span><strong>{selected.paymentSymbol} · {selected.paymentDecimals} decimals</strong></div><div><span>{t("networkLabel")}</span><strong>Base Mainnet</strong></div>
              <div className="detail-wide"><span>{t("contractAddress")}</span><div className="address-line"><strong className="address-value">{selected.address}</strong><div className="address-tools"><button className="address-icon-button" type="button" onClick={async () => { try { await navigator.clipboard?.writeText(selected.address); setCopiedAddress(true); window.setTimeout(() => setCopiedAddress(false), 1600); } catch {} }} aria-label={copiedAddress ? "Copied" : "Copy address"} title={copiedAddress ? "Copied" : "Copy address"}>{copiedAddress ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></svg>}</button><a className="address-icon-button" href={`https://basescan.org/token/${selected.address}`} target="_blank" rel="noreferrer" aria-label="Open BaseScan" title="BaseScan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M10 19V5M15 19v-8M20 19V3" /><path d="M3 19h18" /></svg></a></div></div></div><div className="detail-wide"><span>{t("status")}</span><strong>● Registered</strong></div>
            </div>
            <div className="drawer-listing-card"><div className="drawer-listing-title">Listing #{selected.listingId.toString()}</div><div className="drawer-price"><strong>{selected.price}</strong> <span>{selected.paymentSymbol} / {selected.symbol}</span></div><div className="drawer-available">{t("available")} <strong>{selected.available} {selected.symbol}</strong></div></div>
            <div className="drawer-actions">
              <button className="primary-glass" type="button" disabled={selected.status !== LISTING_ACTIVE || selected.availableRaw < selected.minOrderAmount} onClick={() => setBuyOpen(true)}>{selected.status === LISTING_ACTIVE && selected.availableRaw >= selected.minOrderAmount ? `${t("buy")} ${selected.symbol}` : selected.status === 1 ? "Listing paused" : selected.status === 2 ? "Listing closed" : "Buy unavailable"}</button>
            </div>
          </aside>
          {buyOpen && (
            <BuyModalFlow
              open={buyOpen}
              onClose={() => setBuyOpen(false)}
              onCompleted={refreshMarketplace}
              listingId={selected.listingId}
              symbol={selected.symbol}
              price={selected.priceRaw}
              available={selected.availableRaw}
              minOrderAmount={selected.minOrderAmount}
              maxOrderAmount={selected.maxOrderAmount}
              paymentToken={selected.paymentToken}
              tokenDecimals={selected.tokenDecimals}
              paymentDecimals={selected.paymentDecimals}
              paymentSymbol={selected.paymentSymbol}
            />
          )}
        </>
      )}
      <footer className="site-footer" aria-label="Contact">
        <a className="site-footer-email" href="mailto:info@ustetu.dev" aria-label="Email USTETU" title="Email USTETU">
          <span className="site-footer-email-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 6.5h17v11h-17v-11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="m4.2 7.2 7.8 6 7.8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        </a>
      </footer>

    </main>
  );
}
