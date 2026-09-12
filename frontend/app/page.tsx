"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import Header from "@/components/Header";
import BuyModal from "@/components/BuyModal";
import { useLanguage } from "@/lib/LanguageContext";
import { erc20MetadataAbi, escrowAbi, registryAbi, USTETU_ESCROW_ADDRESS, USTETU_REGISTRY_ADDRESS, USTETU_TOKEN_ID } from "@/lib/contracts";

const LISTING_ID = 2n;

export default function HomePage() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [search, setSearch] = useState("");

  const listingQuery = useReadContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getListing", args: [LISTING_ID] });
  const tokenQuery = useReadContract({ address: USTETU_REGISTRY_ADDRESS, abi: registryAbi, functionName: "getToken", args: [USTETU_TOKEN_ID] });
  const tokenAddress = tokenQuery.data?.contractAddress;
  const nameQuery = useReadContract({ address: tokenAddress, abi: erc20MetadataAbi, functionName: "name", query: { enabled: Boolean(tokenAddress) } });
  const symbolQuery = useReadContract({ address: tokenAddress, abi: erc20MetadataAbi, functionName: "symbol", query: { enabled: Boolean(tokenAddress) } });
  const listing = listingQuery.data;
  const token = tokenQuery.data;

  const liveData = useMemo(() => {
    if (!listing || !token) return null;
    const available = listing.inventoryDeposited - listing.inventoryLocked;
    const tokenDecimals = Number(token.decimalsSnapshot);
    return { listingId: LISTING_ID, token: nameQuery.data ?? "USTETU", symbol: symbolQuery.data ?? "USTETU", address: token.contractAddress, seller: listing.seller, available: formatUnits(available, tokenDecimals), availableRaw: available, price: formatUnits(listing.price, 6), priceRaw: listing.price, paymentToken: listing.paymentToken, minOrderAmount: listing.minOrderAmount, maxOrderAmount: listing.maxOrderAmount, decimals: tokenDecimals, chainId: Number(token.chainId), status: Number(token.status), listingStatus: Number(listing.status) };
  }, [listing, token, nameQuery.data, symbolQuery.data]);

  const isLoading = listingQuery.isLoading || tokenQuery.isLoading || nameQuery.isLoading || symbolQuery.isLoading;
  const hasError = listingQuery.isError || tokenQuery.isError || nameQuery.isError || symbolQuery.isError;
  const matchesSearch = useMemo(() => {
    if (!liveData || !search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [liveData.address, liveData.token, liveData.symbol, liveData.seller].some((value) => value.toLowerCase().includes(q));
  }, [liveData, search]);
  const refreshListing = async () => { await listingQuery.refetch(); await tokenQuery.refetch(); };

  return (
    <main className="app-shell">
      <Header />
      <div className="ambient-glow ambient-glow-one" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-two" aria-hidden="true" />
      <section className="marketplace-shell">
        <div className="marketplace-heading">
          <div>
            <span className="eyebrow">{t("marketplaceEyebrow")}</span>
            <h1>{t("findNext")}</h1>
            <p>{t("verifiedListings")}</p>
          </div>
          <div className="search-glass">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} />
          </div>
        </div>

        <div className="listing-glass">
          <div className="listing-toolbar">
            <span className="listing-count">{isLoading ? t("loading") : matchesSearch && liveData ? `1 ${t("listing")}` : `0 ${t("listings")}`}</span>
            <span className="status-dot"><i /> {t("live")}</span>
          </div>
          <div className="listing-table-wrap">
            <table className="listing-table">
              <thead><tr><th>{t("token")}</th><th>{t("seller")}</th><th>{t("available")}</th><th>{t("price")}</th><th>{t("networkLabel")}</th><th /></tr></thead>
              <tbody>
                {hasError ? <tr><td colSpan={6} className="empty-state">{t("unableRead")}</td></tr> : isLoading ? <tr><td colSpan={6} className="empty-state">{t("readingListing")}</td></tr> : matchesSearch && liveData ? (
                  <tr className="listing-row" onClick={() => setSelected(true)}>
                    <td><div className="token-cell"><div className="token-mark">U</div><div><strong>{liveData.token}</strong><span>{liveData.symbol}</span></div><b className="verified-badge">✓</b></div></td>
                    <td className="mono">{liveData.seller.slice(0, 6)}…{liveData.seller.slice(-4)}</td>
                    <td>{liveData.available} {liveData.symbol}</td><td><strong>{liveData.price}</strong> USDC</td><td><span className="network-text">Base Sepolia</span></td>
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
          <aside className="token-drawer" aria-label={t("verifiedToken")}>
            <div className="drawer-topline"><span className="eyebrow">{t("verifiedToken")}</span><button className="drawer-close" type="button" onClick={() => setSelected(false)}>×</button></div>
            <div className="drawer-token-head"><div className="token-mark token-mark-large">U</div><div><h2>{liveData.token}</h2><span>{t("verifiedToken")} ✓</span></div></div>
            <div className="detail-grid">
              <div><span>{t("name")}</span><strong>{liveData.token}</strong></div><div><span>{t("symbol")}</span><strong>{liveData.symbol}</strong></div><div><span>{t("decimals")}</span><strong>{liveData.decimals}</strong></div><div><span>{t("networkLabel")}</span><strong>Base Sepolia</strong></div>
              <div className="detail-wide"><span>{t("contractAddress")}</span><strong className="address-value">{liveData.address}</strong></div><div className="detail-wide"><span>{t("status")}</span><strong className="approved">● {t("approved")}</strong></div>
            </div>
            <div className="drawer-listing-card"><div className="drawer-listing-title">Listing #{liveData.listingId.toString()}</div><div className="drawer-price"><strong>{liveData.price}</strong> <span>USDC / {liveData.symbol}</span></div><div className="drawer-available">{t("available")} <strong>{liveData.available} {liveData.symbol}</strong></div></div>
            <div className="drawer-actions">
              <button className="secondary-glass" type="button" onClick={() => navigator.clipboard?.writeText(liveData.address)}>{t("copyAddress")}</button>
              <a className="secondary-glass" href={`https://sepolia.basescan.org/token/${liveData.address}`} target="_blank" rel="noreferrer">{t("baseScan")}</a>
              <button className="primary-glass" type="button" onClick={() => setBuyOpen(true)}>{t("buy")} {liveData.symbol}</button>
            </div>
          </aside>
          <BuyModal open={buyOpen} onClose={() => setBuyOpen(false)} onCompleted={refreshListing} listingId={liveData.listingId} symbol={liveData.symbol} price={liveData.priceRaw} available={liveData.availableRaw} minOrderAmount={liveData.minOrderAmount} maxOrderAmount={liveData.maxOrderAmount} paymentToken={liveData.paymentToken} />
        </>
      )}
    </main>
  );
}
