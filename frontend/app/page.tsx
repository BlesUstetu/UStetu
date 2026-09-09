"use client";

import { useState } from "react";
import Header from "@/components/Header";

const LISTING = {
  listingId: 1,
  token: "USTETU",
  symbol: "USTETU",
  address: "0xF9843db152623AB8B3f164Ea297956261D31434c",
  seller: "0x568A2C9A2fC86909d9410E31f9A9287258B9928b",
  available: 99,
  price: "1.00",
  payment: "USDC",
  decimals: 18,
  chain: "Base Sepolia",
};

export default function HomePage() {
  const [selected, setSelected] = useState(false);

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
              aria-label="Search token"
              placeholder="Search contract, token name or symbol"
            />
          </div>
        </div>

        <div className="listing-glass">
          <div className="listing-toolbar">
            <span className="listing-count">1 verified listing</span>
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
                <tr className="listing-row" onClick={() => setSelected(true)}>
                  <td>
                    <div className="token-cell">
                      <div className="token-mark">U</div>
                      <div>
                        <strong>{LISTING.token}</strong>
                        <span>{LISTING.symbol}</span>
                      </div>
                      <b className="verified-badge">✓</b>
                    </div>
                  </td>
                  <td className="mono">{LISTING.seller.slice(0, 6)}…{LISTING.seller.slice(-4)}</td>
                  <td>{LISTING.available} USTETU</td>
                  <td><strong>{LISTING.price}</strong> USDC</td>
                  <td><span className="network-text">Base Sepolia</span></td>
                  <td><button className="row-action" type="button">View</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selected && (
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
                <h2>USTETU</h2>
                <span>Verified Token ✓</span>
              </div>
            </div>

            <div className="detail-grid">
              <div><span>Name</span><strong>USTETU</strong></div>
              <div><span>Symbol</span><strong>USTETU</strong></div>
              <div><span>Decimals</span><strong>18</strong></div>
              <div><span>Network</span><strong>Base Sepolia</strong></div>
              <div className="detail-wide"><span>Contract Address</span><strong className="address-value">{LISTING.address}</strong></div>
              <div className="detail-wide"><span>Status</span><strong className="approved">● APPROVED</strong></div>
            </div>

            <div className="drawer-listing-card">
              <div className="drawer-listing-title">Listing #{LISTING.listingId}</div>
              <div className="drawer-price"><strong>{LISTING.price}</strong> <span>USDC / USTETU</span></div>
              <div className="drawer-available">Available <strong>{LISTING.available} USTETU</strong></div>
            </div>

            <div className="drawer-actions">
              <button className="secondary-glass" type="button">Copy Address</button>
              <a className="secondary-glass" href={`https://sepolia.basescan.org/token/${LISTING.address}`} target="_blank" rel="noreferrer">BaseScan ↗</a>
              <button className="primary-glass" type="button">Buy USTETU</button>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
