"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { escrowAbi, USTETU_ESCROW_ADDRESS, USTETU_SELLER_REGISTRY_ADDRESS, USTETU_TOKEN_ADDRESS, USDC_BASE_SEPOLIA_ADDRESS } from "@/lib/contracts";

const LISTING_ID = 2n;
const TOKEN_DECIMALS = 18;
const USDC_DECIMALS = 6;
const ZERO = "0x0000000000000000000000000000000000000000";

const sellerRegistryAbi = [
  { type: "function", name: "isRegisteredSeller", stateMutability: "view", inputs: [{ name: "seller", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "isVerifiedSeller", stateMutability: "view", inputs: [{ name: "seller", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "getSeller", stateMutability: "view", inputs: [{ name: "seller", type: "address" }], outputs: [{ name: "seller", type: "tuple", components: [
    { name: "wallet", type: "address" }, { name: "withdrawalWallet", type: "address" }, { name: "registeredAt", type: "uint64" }, { name: "withdrawalWalletChangeEffectiveAt", type: "uint64" }, { name: "verificationStatus", type: "uint8" }, { name: "activeListingCount", type: "uint32" }, { name: "totalCompletedOrders", type: "uint256" }, { name: "totalDisputedOrders", type: "uint256" }
  ] }] },
  { type: "function", name: "getPendingWithdrawalWallet", stateMutability: "view", inputs: [{ name: "seller", type: "address" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "registerSeller", stateMutability: "nonpayable", inputs: [{ name: "withdrawalWallet", type: "address" }], outputs: [] },
  { type: "function", name: "requestWithdrawalWalletChange", stateMutability: "nonpayable", inputs: [{ name: "newWallet", type: "address" }], outputs: [] },
  { type: "function", name: "activateWithdrawalWalletChange", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

const tokenAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const short = (v?: string) => v ? `${v.slice(0, 6)}…${v.slice(-4)}` : "—";

export default function SellerDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("1");
  const [newPrice, setNewPrice] = useState("1");
  const [minOrder, setMinOrder] = useState("1");
  const [maxOrder, setMaxOrder] = useState("5");
  const [withdrawalWallet, setWithdrawalWallet] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sellerQuery = useReadContract({ address: USTETU_SELLER_REGISTRY_ADDRESS, abi: sellerRegistryAbi, functionName: "getSeller", args: address ? [address] : undefined, query: { enabled: !!address, retry: false } });
  const registeredQuery = useReadContract({ address: USTETU_SELLER_REGISTRY_ADDRESS, abi: sellerRegistryAbi, functionName: "isRegisteredSeller", args: address ? [address] : undefined, query: { enabled: !!address } });
  const verifiedQuery = useReadContract({ address: USTETU_SELLER_REGISTRY_ADDRESS, abi: sellerRegistryAbi, functionName: "isVerifiedSeller", args: address ? [address] : undefined, query: { enabled: !!address } });
  const listingQuery = useReadContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getListing", args: [LISTING_ID], query: { enabled: !!address } });
  const claimableQuery = useReadContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "claimable", args: address ? [address, USDC_BASE_SEPOLIA_ADDRESS] : undefined, query: { enabled: !!address } });
  const balanceQuery = useReadContract({ address: USTETU_TOKEN_ADDRESS, abi: tokenAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const allowanceQuery = useReadContract({ address: USTETU_TOKEN_ADDRESS, abi: tokenAbi, functionName: "allowance", args: address ? [address, USTETU_ESCROW_ADDRESS] : undefined, query: { enabled: !!address } });
  const pendingWalletQuery = useReadContract({ address: USTETU_SELLER_REGISTRY_ADDRESS, abi: sellerRegistryAbi, functionName: "getPendingWithdrawalWallet", args: address ? [address] : undefined, query: { enabled: !!address && !!registeredQuery.data } });

  const listing = listingQuery.data;
  const seller = sellerQuery.data;
  const isOwner = !!address && !!listing?.seller && listing.seller.toLowerCase() === address.toLowerCase();
  const status = listing ? Number(listing.status) : -1;
  const available = listing ? listing.inventoryDeposited - listing.inventoryLocked : 0n;
  const claimable = claimableQuery.data ?? 0n;
  const tokenBalance = balanceQuery.data ?? 0n;
  const allowance = allowanceQuery.data ?? 0n;
  const pendingWallet = pendingWalletQuery.data as `0x${string}` | undefined;
  const effectiveAt = seller?.withdrawalWalletChangeEffectiveAt ? Number(seller.withdrawalWalletChangeEffectiveAt) : 0;
  const pendingActive = !!pendingWallet && pendingWallet !== ZERO;
  const canActivate = pendingActive && effectiveAt > 0 && Date.now() >= effectiveAt * 1000;
  const statusLabel = status === 1 ? "ACTIVE" : status === 2 ? "PAUSED" : status === 3 ? "CLOSED" : status === 4 ? "SUSPENDED" : "—";

  useEffect(() => {
    if (seller?.withdrawalWallet) setWithdrawalWallet(seller.withdrawalWallet);
  }, [seller?.withdrawalWallet]);

  const refresh = () => {
    void listingQuery.refetch(); void sellerQuery.refetch(); void registeredQuery.refetch(); void verifiedQuery.refetch();
    void claimableQuery.refetch(); void balanceQuery.refetch(); void allowanceQuery.refetch(); void pendingWalletQuery.refetch();
  };

  const ensureSeller = async () => {
    if (!address) throw new Error("Connect wallet terlebih dahulu.");
    if (!isOwner) throw new Error(`Wallet aktif bukan owner Listing #${LISTING_ID.toString()}.`);
    if (chainId !== baseSepolia.id) await switchChainAsync({ chainId: baseSepolia.id });
  };

  const transact = async (label: string, fn: () => Promise<`0x${string}`>) => {
    setBusy(label); setError(""); setMessage("");
    try {
      const hash = await fn();
      setMessage(`${label} terkirim: ${short(hash)}`);
      if (publicClient) {
        try {
          await publicClient.waitForTransactionReceipt({ hash });
          setMessage(`${label} berhasil: ${short(hash)}`);
          refresh();
        } catch {
          setMessage(`${label} sudah dikirim: ${short(hash)}. Receipt RPC belum terbaca; data dapat direfresh.`);
        }
      }
      return hash;
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(text.length > 260 ? `${text.slice(0, 260)}…` : text);
      throw e;
    } finally { setBusy(""); }
  };

  const addInventory = async () => {
    try { await ensureSeller(); const raw = parseUnits(amount || "0", TOKEN_DECIMALS); if (raw <= 0n) throw new Error("Jumlah inventory harus lebih dari 0.");
      if (allowance < raw) await transact("Approve USTETU", () => writeContractAsync({ address: USTETU_TOKEN_ADDRESS, abi: tokenAbi, functionName: "approve", args: [USTETU_ESCROW_ADDRESS, raw] }));
      await transact("Add inventory", () => writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "addListingInventory", args: [LISTING_ID, raw] }));
    } catch {}
  };

  const withdrawInventory = async () => {
    try { await ensureSeller(); const raw = parseUnits(amount || "0", TOKEN_DECIMALS); if (raw <= 0n || raw > available) throw new Error("Jumlah withdrawal melebihi inventory tersedia.");
      await transact("Withdraw inventory", () => writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "withdrawListingInventory", args: [LISTING_ID, raw] }));
    } catch {}
  };

  const updatePrice = async () => {
    try { await ensureSeller(); const raw = parseUnits(newPrice || "0", USDC_DECIMALS); if (raw <= 0n) throw new Error("Harga harus lebih dari 0.");
      await transact("Update price", () => writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "updateListingPrice", args: [LISTING_ID, raw] }));
    } catch {}
  };

  const updateLimits = async () => {
    try { await ensureSeller(); const min = parseUnits(minOrder || "0", TOKEN_DECIMALS); const max = parseUnits(maxOrder || "0", TOKEN_DECIMALS); if (min <= 0n || max < min) throw new Error("Limit order tidak valid.");
      await transact("Update limits", () => writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "updateListingOrderLimits", args: [LISTING_ID, min, max] }));
    } catch {}
  };

  const listingAction = async (label: string, functionName: "pauseListing" | "resumeListing" | "closeListing") => {
    try { await ensureSeller(); await transact(label, () => writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName, args: [LISTING_ID] })); } catch {}
  };

  const withdrawEarnings = async () => {
    try { await ensureSeller(); if (claimable === 0n) throw new Error("Tidak ada USDC claimable.");
      await transact("Withdraw earnings", () => writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "withdrawClaimable", args: [USDC_BASE_SEPOLIA_ADDRESS] }));
    } catch {}
  };

  const register = async () => {
    if (!address) return;
    try { await transact("Register seller", () => writeContractAsync({ address: USTETU_SELLER_REGISTRY_ADDRESS, abi: sellerRegistryAbi, functionName: "registerSeller", args: [address] })); } catch {}
  };

  const requestWallet = async () => {
    try { await ensureSeller(); if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawalWallet)) throw new Error("Withdrawal wallet harus berupa address EVM yang valid.");
      await transact("Request wallet change", () => writeContractAsync({ address: USTETU_SELLER_REGISTRY_ADDRESS, abi: sellerRegistryAbi, functionName: "requestWithdrawalWalletChange", args: [withdrawalWallet as `0x${string}`] }));
    } catch {}
  };

  const activateWallet = async () => {
    try { await ensureSeller(); await transact("Activate withdrawal wallet", () => writeContractAsync({ address: USTETU_SELLER_REGISTRY_ADDRESS, abi: sellerRegistryAbi, functionName: "activateWithdrawalWalletChange" })); } catch {}
  };

  const disabled = !!busy;

  return (
    <section className="seller-dashboard">
      <style jsx global>{`
        .seller-dashboard{max-width:1180px;margin:0 auto;padding:34px 22px 70px;color:var(--text,#f5f7ff)}
        .seller-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:24px}.seller-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.65}.seller-head h1{margin:7px 0 5px;font-size:34px}.seller-head p{margin:0;opacity:.62}.seller-wallet,.seller-diagnostic{font-family:ui-monospace,monospace;font-size:11px;opacity:.7}
        .seller-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}.seller-card{border:1px solid rgba(255,255,255,.1);background:rgba(10,14,25,.72);backdrop-filter:blur(14px);border-radius:18px;padding:18px;box-shadow:0 10px 35px rgba(0,0,0,.18)}.seller-card label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.12em;opacity:.55}.seller-value{font-size:24px;font-weight:750;margin-top:8px}.seller-sub{font-size:12px;opacity:.55;margin-top:4px}.seller-ok{color:#75f7ae}.seller-warn{color:#ffd166}
        .seller-two{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.seller-section{margin-bottom:16px}.seller-section h2{font-size:15px;margin:0 0 12px}.seller-listing-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.seller-token{display:flex;align-items:center;gap:12px}.seller-token-mark{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-weight:900;font-size:20px;background:linear-gradient(135deg,#1e2745,#7c5cff)}.seller-status{font-size:11px;border:1px solid rgba(117,247,174,.28);padding:7px 10px;border-radius:999px;color:#75f7ae}.seller-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.seller-stat{background:rgba(255,255,255,.035);border-radius:12px;padding:12px}.seller-stat span{display:block;font-size:10px;opacity:.5;text-transform:uppercase}.seller-stat strong{display:block;margin-top:5px}.seller-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.seller-actions button,.seller-form button,.seller-card>button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;border-radius:10px;padding:10px 13px;cursor:pointer}.seller-actions button:hover,.seller-form button:hover,.seller-card>button:hover{background:rgba(255,255,255,.1)}.seller-actions button:disabled,.seller-form button:disabled,.seller-card>button:disabled{opacity:.45;cursor:not-allowed}.danger{border-color:rgba(255,100,100,.3)!important}.primary{border-color:rgba(117,247,174,.3)!important}
        .seller-form{display:grid;gap:9px}.seller-form label{font-size:11px;opacity:.55}.seller-form input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.18);color:inherit;border-radius:10px;padding:11px 12px;outline:none}.seller-inline{display:grid;grid-template-columns:1fr 1fr;gap:9px}.seller-note{font-size:11px;line-height:1.55;opacity:.52}.seller-message{margin:12px 0;padding:11px 13px;border-radius:10px;background:rgba(117,247,174,.08);border:1px solid rgba(117,247,174,.18);font-size:12px}.seller-error{margin:12px 0;padding:11px 13px;border-radius:10px;background:rgba(255,80,100,.08);border:1px solid rgba(255,80,100,.18);font-size:12px;word-break:break-word}.seller-address{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all}
        @media(max-width:850px){.seller-grid,.seller-two{grid-template-columns:1fr}.seller-stats{grid-template-columns:repeat(2,1fr)}.seller-head{align-items:flex-start;flex-direction:column}}
      `}</style>

      {!isConnected ? <div className="seller-card"><h2>Seller Center</h2><p className="seller-note">Connect wallet untuk membuka dashboard Seller.</p></div> : !registeredQuery.data ? (
        <div className="seller-card"><h2>Seller Registration</h2><p className="seller-note">Wallet ini belum terdaftar di UStetuSellerRegistry.</p><button onClick={() => void register} disabled={disabled}>{busy || "Register Seller"}</button>{error && <div className="seller-error">{error}</div>}</div>
      ) : (
        <>
          <div className="seller-head"><div><div className="seller-eyebrow">USTETU Seller Center</div><h1>Seller Dashboard</h1><p>Kelola listing, inventory, penjualan, dan hasil settlement.</p></div><div className="seller-wallet">{short(address)}</div></div>
          <div className="seller-grid">
            <div className="seller-card"><label>Verification</label><div className={`seller-value ${verifiedQuery.data ? "seller-ok" : "seller-warn"}`}>{verifiedQuery.data ? "VERIFIED" : "PENDING"}</div><div className="seller-sub">Status dari SellerRegistry</div></div>
            <div className="seller-card"><label>Completed Orders</label><div className="seller-value">{seller?.totalCompletedOrders?.toString() ?? "—"}</div><div className="seller-sub">On-chain seller statistic</div></div>
            <div className="seller-card"><label>Claimable</label><div className="seller-value">{formatUnits(claimable, USDC_DECIMALS)} USDC</div><div className="seller-sub">Seller proceeds setelah settlement</div></div>
          </div>

          <div className="seller-two">
            <div>
              <div className="seller-card seller-section">
                <div className="seller-listing-top"><div className="seller-token"><div className="seller-token-mark">U</div><div><strong>USTETU / USDC</strong><div className="seller-sub">Listing #{LISTING_ID.toString()} • Base Sepolia</div></div></div><span className="seller-status">● {statusLabel}</span></div>
                <div className="seller-stats"><div className="seller-stat"><span>Price</span><strong>{listing ? formatUnits(listing.price, USDC_DECIMALS) : "—"} USDC</strong></div><div className="seller-stat"><span>Deposited</span><strong>{listing ? formatUnits(listing.inventoryDeposited, TOKEN_DECIMALS) : "—"}</strong></div><div className="seller-stat"><span>Locked</span><strong>{listing ? formatUnits(listing.inventoryLocked, TOKEN_DECIMALS) : "—"}</strong></div><div className="seller-stat"><span>Available</span><strong>{formatUnits(available, TOKEN_DECIMALS)}</strong></div></div>
                {!isOwner && <div className="seller-error">Listing #2 bukan milik wallet yang sedang terhubung.</div>}
                <div className="seller-actions"><button className="primary" disabled={disabled || status !== 1} onClick={() => void listingAction("Pause listing", "pauseListing")}>Pause</button><button disabled={disabled || status !== 2} onClick={() => void listingAction("Resume listing", "resumeListing")}>Resume</button><button className="danger" disabled={disabled || status === 3} onClick={() => void listingAction("Close listing", "closeListing")}>Close</button></div>
                <div className="seller-diagnostic">Owner: {isOwner ? "YES" : "NO"} • Network: {chainId === baseSepolia.id ? "Base Sepolia" : `Chain ${chainId}`}</div>
              </div>

              <div className="seller-card seller-section"><h2>Inventory</h2><div className="seller-form"><label>Amount USTETU</label><input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" /><div className="seller-actions"><button disabled={disabled} onClick={() => void addInventory()}>Add Inventory</button><button disabled={disabled} onClick={() => void withdrawInventory()}>Withdraw Available</button></div><div className="seller-note">Wallet balance: {formatUnits(tokenBalance, TOKEN_DECIMALS)} USTETU. Withdraw hanya menggunakan inventory yang tidak locked.</div></div></div>
            </div>

            <div>
              <div className="seller-card seller-section"><h2>Listing Settings</h2><div className="seller-form"><label>Price (USDC / USTETU)</label><input value={newPrice} onChange={e => setNewPrice(e.target.value)} inputMode="decimal" /><button disabled={disabled} onClick={() => void updatePrice()}>Update Price</button><div className="seller-inline"><div><label>Min Order</label><input value={minOrder} onChange={e => setMinOrder(e.target.value)} inputMode="decimal" /></div><div><label>Max Order</label><input value={maxOrder} onChange={e => setMaxOrder(e.target.value)} inputMode="decimal" /></div></div><button disabled={disabled} onClick={() => void updateLimits()}>Update Limits</button></div></div>
              <div className="seller-card seller-section"><h2>Earnings</h2><div className="seller-value">{formatUnits(claimable, USDC_DECIMALS)} USDC</div><p className="seller-note">Hasil penjualan masuk sebagai claimable setelah order COMPLETED. Withdrawal dikirim ke withdrawal wallet terdaftar.</p><button disabled={disabled || claimable === 0n} onClick={() => void withdrawEarnings()}>Withdraw USDC</button></div>
              <div className="seller-card seller-section"><h2>Withdrawal Wallet</h2><div className="seller-address">{seller?.withdrawalWallet ?? "—"}</div>{pendingActive && <p className="seller-note">Pending: {pendingWallet}<br />Effective at: {effectiveAt ? new Date(effectiveAt * 1000).toLocaleString("id-ID") : "—"}</p>}<div className="seller-form" style={{marginTop:12}}><label>New withdrawal wallet</label><input value={withdrawalWallet} onChange={e => setWithdrawalWallet(e.target.value)} placeholder="0x..." /><button disabled={disabled} onClick={() => void requestWallet()}>Request Change (24h delay)</button>{canActivate && <button disabled={disabled} onClick={() => void activateWallet()}>Activate New Wallet</button>}</div><p className="seller-note">Perubahan withdrawal wallet memiliki delay 24 jam dan diproteksi on-chain.</p></div>
              {message && <div className="seller-message">{message}</div>}{error && <div className="seller-error">{error}</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
