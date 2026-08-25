import { useEffect, useState } from "react";
import type { Listing } from "./lib/api";
import { fetchListings } from "./lib/api";
import { connectWallet } from "./lib/wallet";

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchListings({ status: "ACTIVE", limit: 24 });
      setListings(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleConnect() {
    try {
      setError(null);
      const state = await connectWallet();
      setWallet(state.address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">UStetu</div>
          <div className="subtitle">Decentralized Marketplace</div>
        </div>
        <button className="wallet-button" onClick={handleConnect}>
          {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect Wallet"}
        </button>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">ON-CHAIN MARKETPLACE</span>
          <h1>Trade verified assets directly through escrow.</h1>
          <p>Listings are discovered through the indexer. Transactions remain wallet-signed and enforced by UStetuEscrow.</p>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {loading ? <div className="state">Loading active listings…</div> : (
        <section className="grid">
          {listings.map((listing) => (
            <article className="card" key={`${listing.contract_address}-${listing.listing_id}`}>
              <div className="card-head"><span>LISTING #{listing.listing_id}</span><span className="status">{listing.status}</span></div>
              <h2>Token #{listing.token_id}</h2>
              <div className="meta"><span>Seller</span><strong>{listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}</strong></div>
              <div className="meta"><span>Price</span><strong>{listing.price}</strong></div>
              <div className="meta"><span>Available</span><strong>{listing.available_inventory}</strong></div>
              <button className="buy-button" disabled={!wallet}>Buy — Connect wallet to continue</button>
            </article>
          ))}
        </section>
      )}

      {!loading && listings.length === 0 && !error && <div className="state">No active listings found.</div>}
    </main>
  );
}
