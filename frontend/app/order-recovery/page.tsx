"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import { escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

const LISTING_ID = 2n;
const TOKEN_DECIMALS = 18;
const PAYMENT_PENDING = 0;
const EXPIRED = 3;

const STATE_NAMES: Record<number, string> = { 0: "PAYMENT_PENDING", 1: "PAID", 2: "COMPLETED", 3: "EXPIRED" };

export default function OrderRecoveryPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [orderId, setOrderId] = useState<bigint>(3n);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("order");
    if (!value) return;
    try { const parsed = BigInt(value); if (parsed > 0n) setOrderId(parsed); } catch {}
  }, []);

  const listingQuery = useReadContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getListing", args: [LISTING_ID], query: { enabled: chainId === base.id } });
  const orderQuery = useReadContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [orderId], query: { enabled: chainId === base.id && orderId > 0n } });
  const listing = listingQuery.data;
  const order = orderQuery.data;
  const status = listing ? Number(listing.status) : null;
  const orderState = order ? Number(order.state) : null;
  const available = listing ? listing.inventoryDeposited - listing.inventoryLocked : 0n;
  const expired = !!order && orderState === PAYMENT_PENDING && BigInt(Math.floor(Date.now() / 1000)) >= order.expiresAt;
  const canExpire = isConnected && chainId === baseSepolia.id && expired && !busy;

  const refresh = async () => { await Promise.all([listingQuery.refetch(), orderQuery.refetch()]); };

  const expire = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!address) throw new Error("Hubungkan wallet terlebih dahulu.");
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      if (!order || orderState !== PAYMENT_PENDING) throw new Error(`Order #${orderId} bukan PAYMENT_PENDING.`);
      if (!expired) throw new Error(`Order #${orderId} belum melewati expiry.`);
      const hash = await writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "expireOrder", args: [orderId] });
      setMessage(`expireOrder(${orderId}) terkirim: ${hash.slice(0, 10)}…${hash.slice(-8)}`);
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("expireOrder gagal atau di-revert.");
      }
      await refresh();
      setMessage(`Order #${orderId} berhasil di-expire. Inventory ${formatUnits(order.tokenAmount, TOKEN_DECIMALS)} USTETU dilepas kembali ke Listing #${LISTING_ID}.`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const stateLabel = useMemo(() => orderState === null ? "Loading…" : `${STATE_NAMES[orderState] ?? `STATE ${orderState}`} (${orderState})`, [orderState]);

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#070a12", color: "#eef2ff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}><div style={{ fontSize: 12, letterSpacing: 2, opacity: .65 }}>USTETU ORDER RECOVERY</div><h1 style={{ margin: "8px 0 4px", fontSize: 30 }}>Release Expired Order #{orderId.toString()}</h1><p style={{ margin: 0, opacity: .7 }}>Recovery on-chain untuk mengembalikan inventory yang masih terkunci pada Listing #2.</p></div>
        {!isConnected && <Notice text="Hubungkan wallet terlebih dahulu." />}
        {chainId !== base.id && <Notice text="Wallet harus berada di Base Mainnet (chain ID 8453)." />}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 16 }}>
          <Card label="LISTING #2" value={status === null ? "Loading…" : status === 1 ? "ACTIVE" : status === 2 ? "PAUSED" : `STATE ${status}`} />
          <Card label="DEPOSITED" value={listing ? `${formatUnits(listing.inventoryDeposited, TOKEN_DECIMALS)} USTETU` : "—"} />
          <Card label="LOCKED" value={listing ? `${formatUnits(listing.inventoryLocked, TOKEN_DECIMALS)} USTETU` : "—"} />
          <Card label="AVAILABLE" value={listing ? `${formatUnits(available, TOKEN_DECIMALS)} USTETU` : "—"} />
        </section>
        <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b", marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Order #{orderId.toString()}</h2>
          <Row label="State" value={stateLabel} />
          <Row label="Amount" value={order ? `${formatUnits(order.tokenAmount, TOKEN_DECIMALS)} USTETU` : "—"} />
          <Row label="Expires at" value={order ? new Date(Number(order.expiresAt) * 1000).toLocaleString("id-ID") : "—"} />
          <Row label="Expiry check" value={expired ? "EXPIRED — inventory siap dilepas" : "BELUM EXPIRED / tidak dapat di-expire"} />
        </section>
        {canExpire && <button onClick={expire} disabled={busy} style={{ width: "100%", border: 0, borderRadius: 12, padding: "14px 18px", cursor: busy ? "wait" : "pointer", background: "#e55353", color: "white", fontWeight: 800 }}>{busy ? "Memproses…" : `RELEASE ${formatUnits(order!.tokenAmount, TOKEN_DECIMALS)} USTETU`}</button>}
        {orderState === EXPIRED && <Notice text={`Order #${orderId.toString()} sudah EXPIRED dan inventory sudah dilepas dari lock.`} />}
        {message && <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#10251b", color: "#75f7ae" }}>{message}</div>}
        {error && <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#29151a", color: "#ff8b8b", whiteSpace: "pre-wrap" }}>{error}</div>}
        <p style={{ marginTop: 18, fontSize: 12, opacity: .55 }}>Escrow: {USTETU_ESCROW_ADDRESS}</p>
      </div>
    </main>
  );
}
function Card({ label, value }: { label: string; value: string }) { return <div style={{ padding: 18, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}><div style={{ fontSize: 11, letterSpacing: 1.4, opacity: .55 }}>{label}</div><div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid #1b2232" }}><span style={{ opacity: .6 }}>{label}</span><strong style={{ textAlign: "right" }}>{value}</strong></div>; }
function Notice({ text }: { text: string }) { return <div style={{ padding: 16, borderRadius: 14, background: "#24151a", marginBottom: 16, color: "#ffb4b4" }}>{text}</div>; }
