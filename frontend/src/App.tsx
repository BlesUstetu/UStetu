import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import type { Listing } from "./lib/api";
import { fetchListings } from "./lib/api";
import { buyListing, getBuyQuote, type BuyQuote, type BuyState } from "./lib/escrow";
import { connectWallet } from "./lib/wallet";

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyListing, setBusyListing] = useState<string | null>(null);
  const [buyState, setBuyState] = useState<BuyState | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<BuyQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
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

  function openBuy(listing: Listing) {
    if (!wallet) {
      void handleConnect();
      return;
    }
    setSelectedListing(listing);
    setAmount("");
    setQuote(null);
    setBuyError(null);
    setBuyState(null);
  }

  function closeBuy() {
    if (busyListing) return;
    setSelectedListing(null);
    setAmount("");
    setQuote(null);
    setBuyError(null);
  }

  async function handleQuote() {
    if (!selectedListing) return;
    try {
      setQuoteLoading(true);
      setBuyError(null);
      const result = await getBuyQuote(BigInt(selectedListing.listing_id), amount);
      setQuote(result);
    } catch (err) {
      setQuote(null);
      setBuyError(err instanceof Error ? err.message : "Unable to calculate order quote");
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleConfirmBuy() {
    if (!selectedListing || !quote) return;
    try {
      setBuyError(null);
      setBusyListing(selectedListing.listing_id);
      const result = await buyListing(quote.listingId, quote.tokenAmount, setBuyState);
      if (result.stage === "COMPLETE") await load();
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusyListing(null);
    }
  }

  const isProcessing = busyListing !== null;
  const isComplete = buyState?.stage === "COMPLETE" && Boolean(quote);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">UStetu</div>
          <div className="subtitle">Decentralized Marketplace</div>
        </div>
        <button className="wallet-button" onClick={() => void handleConnect()}>
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
      {buyState && !selectedListing && (
        <div className="state">
          Purchase status: <strong>{buyState.stage}</strong>
          {buyState.orderId ? ` · Order #${buyState.orderId}` : ""}
        </div>
      )}

      {loading ? <div className="state">Loading active listings…</div> : (
        <section className="grid">
          {listings.map((listing) => (
            <article className="card" key={`${listing.contract_address}-${listing.listing_id}`}>
              <div className="card-head"><span>LISTING #{listing.listing_id}</span><span className="status">{listing.status}</span></div>
              <h2>Token #{listing.token_id}</h2>
              <div className="meta"><span>Seller</span><strong>{listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}</strong></div>
              <div className="meta"><span>Price</span><strong>{listing.price}</strong></div>
              <div className="meta"><span>Available</span><strong>{listing.available_inventory}</strong></div>
              <div className="meta"><span>Order range</span><strong>{listing.min_order_amount} – {listing.max_order_amount}</strong></div>
              <button className="buy-button" disabled={isProcessing} onClick={() => openBuy(listing)}>
                {busyListing === listing.listing_id ? "Processing…" : wallet ? "Buy" : "Connect Wallet"}
              </button>
            </article>
          ))}
        </section>
      )}

      {!loading && listings.length === 0 && !error && <div className="state">No active listings found.</div>}

      {selectedListing && (
        <div className="modal-backdrop" role="presentation">
          <section className="buy-modal" role="dialog" aria-modal="true" aria-labelledby="buy-title">
            <div className="modal-head">
              <div>
                <span className="eyebrow">USTETU ESCROW</span>
                <h2 id="buy-title">Buy Token #{selectedListing.token_id}</h2>
              </div>
              {!isProcessing && <button className="modal-close" onClick={closeBuy} aria-label="Close">×</button>}
            </div>

            {isComplete && quote ? (
              <div className="success-panel">
                <div className="success-icon">✓</div>
                <h3>Order completed</h3>
                <p>Your purchase has been completed through UStetu Escrow.</p>
                <div className="summary-row"><span>Order ID</span><strong>#{buyState?.orderId?.toString()}</strong></div>
                <div className="summary-row"><span>Token amount</span><strong>{formatUnits(quote.tokenAmount, quote.tokenDecimals)}</strong></div>
                <div className="summary-row"><span>Payment</span><strong>{formatUnits(quote.grossPayment, quote.paymentDecimals)} {quote.paymentSymbol}</strong></div>
                <div className="tx-box">Transaction: {buyState?.transactionHash?.slice(0, 10)}…{buyState?.transactionHash?.slice(-8)}</div>
                <button className="buy-button" onClick={() => { closeBuy(); setBuyState(null); }}>Done</button>
              </div>
            ) : (
              <>
                <div className="buy-info-grid">
                  <div><span>Seller</span><strong>{selectedListing.seller.slice(0, 8)}…{selectedListing.seller.slice(-6)}</strong></div>
                  <div><span>Listing</span><strong>#{selectedListing.listing_id}</strong></div>
                </div>

                <label className="amount-label" htmlFor="buy-amount">Token amount</label>
                <div className="amount-input-wrap">
                  <input id="buy-amount" inputMode="decimal" placeholder="0.00" value={amount} disabled={isProcessing} onChange={(event) => { setAmount(event.target.value); setQuote(null); setBuyError(null); }} />
                  <span>TOKEN</span>
                </div>

                <div className="hint">Enter the amount you want to buy. Minimum, maximum, inventory and wallet balance are validated against the blockchain.</div>

                {buyError && <div className="modal-error">{buyError}</div>}

                {!quote ? (
                  <button className="buy-button primary" disabled={quoteLoading || !amount.trim()} onClick={() => void handleQuote()}>
                    {quoteLoading ? "Calculating…" : "Review Order"}
                  </button>
                ) : (
                  <>
                    <div className="quote-panel">
                      <div className="quote-title">Order summary</div>
                      <div className="summary-row"><span>Amount</span><strong>{formatUnits(quote.tokenAmount, quote.tokenDecimals)} TOKEN</strong></div>
                      <div className="summary-row"><span>Unit price</span><strong>{formatUnits(quote.price, quote.paymentDecimals)} {quote.paymentSymbol}</strong></div>
                      <div className="summary-row"><span>Gross payment</span><strong>{formatUnits(quote.grossPayment, quote.paymentDecimals)} {quote.paymentSymbol}</strong></div>
                      <div className="summary-row"><span>Marketplace fee ({Number(quote.feeBps) / 100}%)</span><strong>{formatUnits(quote.fee, quote.paymentDecimals)} {quote.paymentSymbol}</strong></div>
                      <div className="summary-row total"><span>Total buyer payment</span><strong>{formatUnits(quote.grossPayment, quote.paymentDecimals)} {quote.paymentSymbol}</strong></div>
                      <div className="summary-row"><span>Your balance</span><strong>{formatUnits(quote.paymentBalance, quote.paymentDecimals)} {quote.paymentSymbol}</strong></div>
                    </div>

                    <div className="wizard">
                      <div className={buyState ? "wizard-step active" : "wizard-step active"}><span>1</span> Review</div>
                      <div className={buyState && ["APPROVAL_PENDING"].includes(buyState.stage) ? "wizard-step active" : "wizard-step"}><span>2</span> Approve</div>
                      <div className={buyState && ["FUNDING_PENDING"].includes(buyState.stage) ? "wizard-step active" : "wizard-step"}><span>3</span> Fund</div>
                      <div className={buyState && ["COMPLETION_PENDING","COMPLETE"].includes(buyState.stage) ? "wizard-step active" : "wizard-step"}><span>4</span> Complete</div>
                    </div>

                    {quote.paymentBalance < quote.grossPayment && <div className="modal-error">Insufficient {quote.paymentSymbol} balance for this order.</div>}

                    <button className="buy-button primary" disabled={isProcessing || quote.paymentBalance < quote.grossPayment} onClick={() => void handleConfirmBuy()}>
                      {isProcessing ? `${buyState?.stage.replaceAll("_", " ") ?? "PROCESSING"}…` : "Confirm & Buy"}
                    </button>
                    <button className="secondary-button" disabled={isProcessing} onClick={() => setQuote(null)}>Edit amount</button>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
