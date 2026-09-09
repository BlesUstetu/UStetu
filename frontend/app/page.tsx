"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import Header from "@/components/Header";
import {
  erc20MetadataAbi,
  escrowAbi,
  registryAbi,
  USTETU_ESCROW_ADDRESS,
  USTETU_REGISTRY_ADDRESS,
  USTETU_TOKEN_ID,
} from "@/lib/contracts";

const LISTING_ID = 1n;

export default function HomePage() {
  const [selected, setSelected] = useState(false);
  const [search, setSearch] = useState("");

  const listingQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getListing",
    args: [LISTING_ID],
  });

  const tokenQuery = useReadContract({
    address: USTETU_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "getToken",
    args: [USTETU_TOKEN_ID],
  });

  const tokenAddress = tokenQuery.data?.contractAddress;

  const nameQuery = useReadContract({
    address: tokenAddress,
    abi: erc20MetadataAbi,
    functionName: "name",
    query: { enabled: Boolean(tokenAddress) },
  });

  const symbolQuery = useReadContract({
    address: tokenAddress,
    abi: erc20MetadataAbi,
    functionName: "symbol",
    query: { enabled: Boolean(tokenAddress) },
  });

  const listing = listingQuery.data;
  const token = tokenQuery.data;

  const liveData = useMemo(() => {
    if (!listing || !token) return null;

    const available = listing.inventoryDeposited - listing.inventoryLocked;
    const tokenDecimals = Number(token.decimalsSnapshot);
    const paymentDecimals = 6;

    return {
      listingId: LISTING_ID,
      token: nameQuery.data ?? "USTETU",
      symbol: symbolQuery.data ?? "USTETU",
      address: token.contractAddress,
      seller: listing.seller,
      available: formatUnits(available, tokenDecimals),
      price: formatUnits(listing.price, paymentDecimals),
      paymentToken: listing.paymentToken,
      decimals: tokenDecimals,
      chainId: Number(token.chainId),
      status: Number(token.status),
      listingStatus: Number(listing.status),
    };
  }, [listing, token, nameQuery.data, symbolQuery.data]);

  const isLoading = listingQuery.isLoading || tokenQuery.isLoading || nameQuery.isLoading || symbolQuery.isLoading;
  const hasError = listingQuery.isError || tokenQuery.isError || nameQuery.isError || symbolQuery.isError;

  const matchesSearch = useMemo(() => {
    if (!liveData || !search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [liveData.address, liveData.token, liveData.symbol, liveData.seller].some((value) =>
      value.toLowerCase().includes(q)
    );
  }, [liveData, search]);

  return (
    <main className="app-shell">
      <Header />

      <div className="ambient-glow ambient-glow-one" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-two" aria-hidden="true" />

      <section className="marketplace-shell">
        <div className="marketplace-heading">
          <div>
            <span className="eyebrow">USTETU MARKETPLACE</span>
            <h1>Find what’s next.</h1>
            <p>Verified token listings on Base Sepolia.</p>
          </div>

          <div className="search-glass">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search token"
              placeholder="Search contract, token name or symbol"
            />
          </div>
        </div>

        <div className="listing-glass">
          <div className="listing-toolbar">
            <span className="listing-count">
              {isLoading ? "Loading blockchain data…" : matchesSearch && liveData ? "1 verified listing" : "0 listings"}
            </span>
            <span className="status-dot"><i /> Live</span>
          </div>

          <div className="listing-table-wrap">
            <table className="listing-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Seller</th>
                  <th>Available</th>
                  <th>Price</th>
                  <th>Network</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hasError ? (
                  <tr>
                    <td colSpan={6} className="empty-state">Unable to read Base Sepolia data.</td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={6} className="empty-state">Reading Listing #1 from Escrow…</td>
                  </tr>
                ) : matchesSearch && liveData ? (
                  <tr className="listing-row" onClick={() => setSelected(true)}>
                    <td>
                      <div className="token-cell">
                        <div className="token-mark">U</div>
                        <div>
                          <strong>{liveData.token}</strong>
                          <span>{liveData.symbol}</span>
                        </div>
                        <b className="verified-badge">✓</b>
                      </div>
                    </td>
                    <td className="mono">{liveData.seller.slice(0, 6)}…{liveData.seller.slice(-4)}</td>
                    <td>{liveData.available} {liveData.symbol}</td>
                    <td><strong>{liveData.price}</strong> USDC</td>
                    <td><span className="network-text">Base Sepolia</span></td>
                    <td><button className="row-action" type="button">View</button></td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-state">No matching token found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selected && liveData && (
        <>
          <button
            className="drawer-backdrop"
            aria-label="Close token detail"
            onClick={() => setSelected(false)}
          />
          <aside className="token-drawer" aria-label="Token detail">
            <div className="drawer-topline">
              <span className="eyebrow">VERIFIED TOKEN</span>
              <button className="drawer-close" type="button" onClick={() => setSelected(false)}>×</button>
            </div>

            <div className="drawer-token-head">
              <div className="token-mark token-mark-large">U</div>
              <div>
                <h2>{liveData.token}</h2>
                <span>Verified Token ✓</span>
              </div>
            </div>

            <div className="detail-grid">
              <div><span>Name</span><strong>{liveData.token}</strong></div>
              <div><span>Symbol</span><strong>{liveData.symbol}</strong></div>
              <div><span>Decimals</span><strong>{liveData.decimals}</strong></div>
              <div><span>Network</span><strong>Base Sepolia</strong></div>
              <div className="detail-wide"><span>Contract Address</span><strong className="address-value">{liveData.address}</strong></div>
              <div className="detail-wide"><span>Status</span><strong className="approved">● APPROVED</strong></div>
            </div>

            <div className="drawer-listing-card">
              <div className="drawer-listing-title">Listing #{liveData.listingId.toString()}</div>
              <div className="drawer-price"><strong>{liveData.price}</strong> <span>USDC / {liveData.symbol}</span></div>
              <div className="drawer-available">Available <strong>{liveData.available} {liveData.symbol}</strong></div>
            </div>

            <div className="drawer-actions">
              <button
                className="secondary-glass"
                type="button"
                onClick={() => navigator.clipboard?.writeText(liveData.address)}
              >
                Copy Address
              </button>
              <a className="secondary-glass" href={`https://sepolia.basescan.org/token/${liveData.address}`} target="_blank" rel="noreferrer">BaseScan ↗</a>
              <button className="primary-glass" type="button">Buy {liveData.symbol}</button>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
