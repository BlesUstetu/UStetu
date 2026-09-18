"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import Header from "@/components/Header";
import BuyModalFlow from "@/components/BuyModalFlow";
import TokenLogo from "@/components/TokenLogo";
import { useLanguage } from "@/lib/LanguageContext";
import { erc20MetadataAbi, escrowAbi, registryAbi, USTETU_ESCROW_ADDRESS, USTETU_REGISTRY_ADDRESS } from "@/lib/contracts";

const LISTING_ACTIVE = 1;
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

  const paymentTokenQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "paymentToken",
    query: { refetchInterval: 30000 }
  });
  const paymentTokenAddress = paymentTokenQuery.data;

  const tokenConfigs = useMemo(
    () => listings.map((item) => ({
      address: USTETU_REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: "getToken" as const,
      args: [hexTokenId(item.token_id)] as const
    })).filter((item) => item.address !== null),
    [listings]
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

  const loadListings = async () => {
    if (!INDEXER_API_URL) {
      setApiError("Marketplace indexer belum dikonfigurasi.");
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setApiError("");
    try {
      const baseUrl = INDEXER_API_URL.replace(/\/$/, "");
      const collected: ApiListing[] = [];
      let cursor: string | null = null;
      do {
        const query = new URLSearchParams({ status: "ACTIVE", limit: "100" });
        if (cursor) query.set("cursor", cursor);
        const response = await fetch(`${baseUrl}/listings?${query.toString()}`, { cache: "no-store" });
        const body = await response.json() as { success?: boolean; items?: ApiListing[]; pagination?: { nextCursor?: string | null; hasMore?: boolean }; error?: string };
        if (!response.ok || !body.success) throw new Error(body.error ?? "Unable to read marketplace listings.");
        collected.push(...(body.items ?? []));
        cursor = body.pagination?.hasMore ? (body.pagination.nextCursor ?? null) : null;
        if (body.pagination?.hasMore && !cursor) throw new Error("Marketplace pagination returned an invalid cursor.");
      } while (cursor);
      setListings(collected.filter((item) => item.token_contract));
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to read marketplace listings.");
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadListings();
    const timer = window.setInterval(() => void loadListings(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const liveListings = useMemo<LiveListing[]>(() => {
    if (paymentTokenAddress === undefined || paymentDecimalsQuery.data === undefined) return [];
    const paymentDecimals = Number(paymentDecimalsQuery.data);
    const paymentSymbol = paymentSymbolQuery.data ?? "USDC";
    return listings.map((item, index) => {
      const token = tokenQueries.data?.[index]?.result as readonly [bigint, `0x${string}`, number, `0x${string}`, bigint] | undefined;
      const tokenAddress = normalizeAddress(item.token_contract);
      if (!token || !tokenAddress) return null;
      const tokenDecimals = Number(token[2]);
      const deposited = BigInt(item.inventory_deposited);
      const locked = BigInt(item.inventory_locked);
      const availableRaw = deposited > locked ? deposited - locked : 0n;
      const listingId = BigInt(item.listing_id);
      return {
        listingId,
        seller: item.seller as `0x${string}`,
        tokenId: hexTokenId(item.token_id),
        address: tokenAddress,
        tokenName: "Token",
        symbol: "TOKEN",
        tokenDecimals,
        paymentToken: paymentTokenAddress,
        paymentSymbol,
        paymentDecimals,
        availableRaw,
        available: formatUnits(availableRaw, tokenDecimals),
        priceRaw: BigInt(item.price),
        price: formatUnits(BigInt(item.price), paymentDecimals),
        minOrderAmount: BigInt(item.min_order_amount),
        maxOrderAmount: BigInt(item.max_order_amount),
        chainId: 8453,
        status: item.status === "ACTIVE" ? LISTING_ACTIVE : item.status === "PAUSED" ? 2 : item.status === "CLOSED" ? 3 : 0
      };
    }).filter((item): item is LiveListing => item !== null);
  }, [listings, tokenQueries.data, paymentTokenAddress, paymentDecimalsQuery.data, paymentSymbolQuery.data]);

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

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedListings;
    return enrichedListings.filter((item) =>
      [item.address, item.tokenName, item.symbol, item.seller].some((value) => value.toLowerCase().includes(q))
    );
  }, [enrichedListings, search]);

  const selected = selectedId === null ? null : enrichedListings.find((item) => item.listingId === selectedId) ?? null;
  const isLoading = loading || paymentTokenQuery.isLoading || paymentDecimalsQuery.isLoading || (listings.length > 0 && tokenQueries.isLoading);
  const hasError = Boolean(apiError);
  const refreshMarketplace = async () => { await loadListings(); };

  return (
    <main className="app-shell">
      <Header showHome={false} />
      <div className="ambient-glow ambient-glow-one" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-two" aria-hidden="true" />
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
            <span className="listing-count">{isLoading ? t("loading") : `${filteredListings.length} ${filteredListings.length === 1 ? t("listing") : t("listings")}`}</span>
            <span className="status-dot"><i /> {t("live")}</span>
          </div>
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
            <div className="drawer-topline"><span className="eyebrow">{t("registeredToken")}</span><button className="drawer-close" type="button" onClick={() => setSelectedId(null)}>×</button></div>
            <div className="drawer-token-head"><TokenLogo address={selected.address} chainId={selected.chainId} name={selected.tokenName} symbol={selected.symbol} size={58} /><div><h2>{selected.tokenName}</h2><span>Registered on-chain</span></div></div>
            <div className="detail-grid">
              <div><span>{t("name")}</span><strong>{selected.tokenName}</strong></div><div><span>{t("symbol")}</span><strong>{selected.symbol}</strong></div><div><span>{t("decimals")}</span><strong>{selected.tokenDecimals}</strong></div><div><span>Payment</span><strong>{selected.paymentSymbol} · {selected.paymentDecimals} decimals</strong></div><div><span>{t("networkLabel")}</span><strong>Base Mainnet</strong></div>
              <div className="detail-wide"><span>{t("contractAddress")}</span><strong className="address-value">{selected.address}</strong></div><div className="detail-wide"><span>{t("status")}</span><strong>● Registered</strong></div>
            </div>
            <div className="drawer-listing-card"><div className="drawer-listing-title">Listing #{selected.listingId.toString()}</div><div className="drawer-price"><strong>{selected.price}</strong> <span>{selected.paymentSymbol} / {selected.symbol}</span></div><div className="drawer-available">{t("available")} <strong>{selected.available} {selected.symbol}</strong></div></div>
            <div className="drawer-actions">
              <button className="secondary-glass" type="button" onClick={() => navigator.clipboard?.writeText(selected.address)}>{t("copyAddress")}</button>
              <a className="secondary-glass" href={`https://basescan.org/token/${selected.address}`} target="_blank" rel="noreferrer">{t("baseScan")}</a>
              <button className="primary-glass" type="button" disabled={selected.status !== LISTING_ACTIVE || selected.availableRaw < selected.minOrderAmount} onClick={() => setBuyOpen(true)}>{selected.status === LISTING_ACTIVE && selected.availableRaw >= selected.minOrderAmount ? `${t("buy")} ${selected.symbol}` : "Buy unavailable"}</button>
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
    </main>
  );
}
