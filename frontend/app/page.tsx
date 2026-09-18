"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import Header from "@/components/Header";
import BuyModalFlow from "@/components/BuyModalFlow";
import TokenLogo from "@/components/TokenLogo";
import { useLanguage } from "@/lib/LanguageContext";
import { erc20MetadataAbi, escrowAbi, registryAbi, USTETU_ESCROW_ADDRESS, USTETU_REGISTRY_ADDRESS, USTETU_TOKEN_ID } from "@/lib/contracts";

const LISTING_ID = 2n;
const LISTING_ACTIVE = 1;


export default function HomePage() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [search, setSearch] = useState("");

  const listingQuery = useReadContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getListing", args: [LISTING_ID], query: { refetchInterval: 5000 } });
  const tokenQuery = useReadContract({ address: USTETU_REGISTRY_ADDRESS, abi: registryAbi, functionName: "getToken", args: [USTETU_TOKEN_ID] });
  const tokenAddress = tokenQuery.data?.contractAddress;
  const paymentTokenQuery = useReadContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "paymentToken" });
  const paymentTokenAddress = paymentTokenQuery.data;
  const nameQuery = useReadContract({ address: tokenAddress, abi: erc20MetadataAbi, functionName: "name", query: { enabled: Boolean(tokenAddress) } });
  const symbolQuery = useReadContract({ address: tokenAddress, abi: erc20MetadataAbi, functionName: "symbol", query: { enabled: Boolean(tokenAddress) } });
  const paymentSymbolQuery = useReadContract({ address: paymentTokenAddress, abi: erc20MetadataAbi, functionName: "symbol", query: { enabled: Boolean(paymentTokenAddress) } });
  const paymentDecimalsQuery = useReadContract({ address: paymentTokenAddress, abi: erc20MetadataAbi, functionName: "decimals", query: { enabled: Boolean(paymentTokenAddress) } });
  const listing = listingQuery.data;
  const token = tokenQuery.data;

  const liveData = useMemo(() => {
    if (!listing || !token || paymentDecimalsQuery.data === undefined) return null;
    const available = listing.inventoryDeposited - listing.inventoryLocked;
    const tokenDecimals = Number(token.decimalsSnapshot);
    const paymentDecimals = Number(paymentDecimalsQuery.data);
    return { listingId: LISTING_ID, token: nameQuery.data ?? "USTETU", symbol: symbolQuery.data ?? "USTETU", address: token.contractAddress, seller: listing.seller, available: formatUnits(available, tokenDecimals), availableRaw: available, price: formatUnits(listing.price, paymentDecimals), priceRaw: listing.price, paymentToken: paymentTokenAddress!, paymentSymbol: paymentSymbolQuery.data ?? "PAYMENT", minOrderAmount: listing.minOrderAmount, maxOrderAmount: listing.maxOrderAmount, decimals: tokenDecimals, paymentDecimals, chainId: Number(token.chainId), registered: true, listingStatus: Number(listing.status) };
  }, [listing, token, nameQuery.data, symbolQuery.data, paymentSymbolQuery.data, paymentDecimalsQuery.data]);

  const isLoading = listingQuery.isLoading || tokenQuery.isLoading || nameQuery.isLoading || symbolQuery.isLoading || paymentSymbolQuery.isLoading || paymentDecimalsQuery.isLoading || paymentTokenQuery.isLoading;
  const hasError = listingQuery.isError || tokenQuery.isError || nameQuery.isError || symbolQuery.isError || paymentSymbolQuery.isError || paymentDecimalsQuery.isError || paymentTokenQuery.isError;
  const isBuyable = Boolean(liveData && liveData.listingStatus === LISTING_ACTIVE && liveData.availableRaw >= liveData.minOrderAmount);
  const matchesSearch = useMemo(() => {
    if (!liveData || !search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [liveData.address, liveData.token, liveData.symbol, liveData.seller].some((value) => value.toLowerCase().includes(q));
  }, [liveData, search]);
  const refreshListing = async () => { await listingQuery.refetch(); await tokenQuery.refetch(); await paymentSymbolQuery.refetch(); await paymentDecimalsQuery.refetch(); await paymentTokenQuery.refetch(); };

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
            <span className="listing-count">{isLoading ? t("loading") : matchesSearch && liveData ? `1 ${t("listing")}` : `0 ${t("listings")}`}</span>
            <span className="status-dot"><i /> {liveData?.listingStatus === LISTING_ACTIVE ? t("live") : "Not available"}</span>
          </div>
          <div className="listing-table-wrap">
            <table className="listing-table">
              <thead><tr><th>{t("token")}</th><th>{t("seller")}</th><th>{t("available")}</th><th>{t("price")}</th><th>{t("networkLabel")}</th><th /></tr></thead>
              <tbody>
                {hasError ? <tr><td colSpan={6} className="empty-state">{t("unableRead")}</td></tr> : isLoading ? <tr><td colSpan={6} className="empty-state">{t("readingListing")}</td></tr> : matchesSearch && liveData ? (
                  <tr className="listing-row" onClick={() => setSelected(true)}>
                    <td><div className="token-cell"><TokenLogo address={liveData.address} chainId={liveData.chainId} name={liveData.token} symbol={liveData.symbol} size={38} /><div><strong>{liveData.token}</strong><span>{liveData.symbol}</span></div><b className="verified-badge">✓</b></div></td>
                    <td className="mono">{liveData.seller.slice(0, 6)}…{liveData.seller.slice(-4)}</td>
                    <td>{liveData.available} {liveData.symbol}</td><td><strong>{liveData.price}</strong> {liveData.paymentSymbol}</td><td><span className="network-text">Base Mainnet</span></td>
                    <td><button className="row-action" type="button">{t("view")}</button></td>
                  </tr>
                ) : <tr><td colSpan={6} className="empty-state">{t("noMatch")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selected && liveData && (
        <>
          <button className="drawer-backdrop" aria-label={t("close")} onClick={() => setSelected(false)} />
          <aside className="token-drawer" aria-label="Registered token">
            <div className="drawer-topline"><span className="eyebrow">REGISTERED TOKEN</span><button className="drawer-close" type="button" onClick={() => setSelected(false)}>×</button></div>
            <div className="drawer-token-head"><TokenLogo address={liveData.address} chainId={liveData.chainId} name={liveData.token} symbol={liveData.symbol} size={58} /><div><h2>{liveData.token}</h2><span>Registered on-chain ✓</span></div></div>
            <div className="detail-grid">
              <div><span>{t("name")}</span><strong>{liveData.token}</strong></div><div><span>{t("symbol")}</span><strong>{liveData.symbol}</strong></div><div><span>{t("decimals")}</span><strong>{liveData.decimals}</strong></div><div><span>Payment</span><strong>{liveData.paymentSymbol} · {liveData.paymentDecimals} decimals</strong></div><div><span>{t("networkLabel")}</span><strong>Base Mainnet</strong></div>
              <div className="detail-wide"><span>{t("contractAddress")}</span><strong className="address-value">{liveData.address}</strong></div><div className="detail-wide"><span>{t("status")}</span><strong className="approved">● Registered</strong></div>
            </div>
            <div className="drawer-listing-card"><div className="drawer-listing-title">Listing #{liveData.listingId.toString()}</div><div className="drawer-price"><strong>{liveData.price}</strong> <span>{liveData.paymentSymbol} / {liveData.symbol}</span></div><div className="drawer-available">{t("available")} <strong>{liveData.available} {liveData.symbol}</strong></div></div>
            <div className="drawer-actions">
              <button className="secondary-glass" type="button" onClick={() => navigator.clipboard?.writeText(liveData.address)}>{t("copyAddress")}</button>
              <a className="secondary-glass" href={`https://basescan.org/token/${liveData.address}`} target="_blank" rel="noreferrer">{t("baseScan")}</a>
              <button className="primary-glass" type="button" disabled={!isBuyable} onClick={() => setBuyOpen(true)} title={!isBuyable ? "Listing belum tersedia untuk pembelian." : undefined}>{isBuyable ? `${t("buy")} ${liveData.symbol}` : "Buy unavailable"}</button>
            </div>
          </aside>
          <BuyModalFlow open={buyOpen} onClose={() => setBuyOpen(false)} onCompleted={refreshListing} listingId={liveData.listingId} symbol={liveData.symbol} price={liveData.priceRaw} available={liveData.availableRaw} minOrderAmount={liveData.minOrderAmount} maxOrderAmount={liveData.maxOrderAmount} paymentToken={liveData.paymentToken} tokenDecimals={liveData.decimals} paymentDecimals={liveData.paymentDecimals} paymentSymbol={liveData.paymentSymbol} />
        </>
      )}
    </main>
  );
}
