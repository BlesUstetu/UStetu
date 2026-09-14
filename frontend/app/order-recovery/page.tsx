"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

const LISTING_ID = 2n;
const ORDER_ID = 1n;
const TOKEN_DECIMALS = 18;

const STATE_NAMES: Record<number, string> = {
  0: "UNKNOWN",
  1: "PAYMENT_PENDING",
  2: "PAID",
  3: "EXPIRED",
  4: "CANCELLED",
  5: "COMPLETED",
};

export default function OrderRecoveryPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const listingQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getListing",
    args: [LISTING_ID],
    query: { enabled: chainId === baseSepolia.id },
  });

  const orderQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getOrder",
    args: [ORDER_ID],
    query: { enabled: chainId === baseSepolia.id },
  });

  const listing = listingQuery.data;
  const order = orderQuery.data;
  const status = listing ? Number(listing.status) : null;
  const orderState = order ? Number(order.state) : null;
  const available = listing ? listing.inventoryDeposited - listing.inventoryLocked : 0n;
  const expired = !!order && orderState === 1 && BigInt(Math.floor(Date.now() / 1000)) >= order.expiresAt;
  const sellerOwner = !!address && !!listing?.seller && listing.seller.toLowerCase() === address.toLowerCase();
  const canExpire = isConnected && chainId === baseSepolia.id && sellerOwner && expired && !busy;

  const refresh = () => {
    void listingQuery.refetch();
    void orderQuery.refetch();
  };

  const expire = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!address) throw new Error("Hubungkan wallet Seller terlebih dahulu.");
      if (chainId !== baseSepolia.id) {
        await switchChainAsync({ chainId: baseSepolia.id });
      }
      if (!sellerOwner) throw new Error("Wallet aktif bukan owner Listing #2.");
      if (!order || orderState !== 1) throw new Error("Order #1 bukan PAYMENT_PENDING.");
      if (!expired) throw new Error("Order #1 belum melewati expiry.");

      const hash = await writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "expireOrder",
        args: [ORDER_ID],
      });

      setMessage(`expireOrder(1) terkirim: ${hash.slice(0, 10)}…${hash.slice(-8)}`);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        setMessage(`Order #1 berhasil di-expire: ${hash.slice(0, 10)}…${hash.slice(-8)}`);
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#070a12", color: "#eef2ff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.65 }}>USTETU ORDER RECOVERY</div>
          <h1 style={{ margin: "8px 0 4px", fontSize: 30 }}>Expire Order #1</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>Read-only sampai tombol expire dikonfirmasi. Khusus Listing #2.</p>
        </div>

        {!isConnected && <Notice text="Hubungkan wallet Seller terlebih dahulu." />}
        {chainId !== baseSepolia.id && <Notice text="Wallet harus berada di Base Sepolia (chain ID 84532)." />}
        {isConnected && !sellerOwner && <Notice text="Wallet aktif bukan owner Listing #2. Jangan kirim transaksi." />}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 16 }}>
          <Card label="LISTING #2" value={status === null ? "Loading…" : status === 1 ? "ACTIVE" : status === 2 ? "PAUSED" : `STATE ${status}`} />
          <Card label="DEPOSITED" value={listing ? `${formatUnits(listing.inventoryDeposited, TOKEN_DECIMALS)} USTETU` : "—"} />
          <Card label="LOCKED" value={listing ? `${formatUnits(listing.inventoryLocked, TOKEN_DECIMALS)} USTETU` : "—"} />
          <Card label="AVAILABLE" value={listing ? `${formatUnits(available, TOKEN_DECIMALS)} USTETU` : "—"} />
        </section>

        <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b", marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Order #1</h2>
          <Row label="State" value={orderState === null ? "Loading…" : `${STATE_NAMES[orderState] ?? `STATE ${orderState}`} (${orderState})`} />
          <Row label="Amount" value={order ? `${formatUnits(order.tokenAmount, TOKEN_DECIMALS)} USTETU` : "—"} />
          <Row label="Expires at" value={order ? new Date(Number(order.expiresAt) * 1000).toLocaleString("id-ID") : "—"} />
          <Row label="Expiry check" value={expired ? "EXPIRED — siap di-expire" : "BELUM EXPIRED / tidak dapat di-expire"} />
        </section>

        {canExpire && (
          <button onClick={expire} disabled={busy} style={{ width: "100%", border: 0, borderRadius: 12, padding: "14px 18px", cursor: busy ? "wait" : "pointer", background: "#e55353", color: "white", fontWeight: 800 }}>
            {busy ? "Memproses…" : "EXPIRE ORDER #1"}
          </button>
        )}

        {message && <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#10251b", color: "#75f7ae" }}>{message}</div>}
        {error && <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#29151a", color: "#ff8b8b", whiteSpace: "pre-wrap" }}>{error}</div>}

        <p style={{ marginTop: 18, fontSize: 12, opacity: 0.55 }}>Escrow: {USTETU_ESCROW_ADDRESS}</p>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 18, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}><div style={{ fontSize: 11, letterSpacing: 1.4, opacity: 0.55 }}>{label}</div><div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>{value}</div></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid #1b2232" }}><span style={{ opacity: 0.6 }}>{label}</span><strong style={{ textAlign: "right" }}>{value}</strong></div>;
}

function Notice({ text }: { text: string }) {
  return <div style={{ padding: 16, borderRadius: 14, background: "#24151a", marginBottom: 16, color: "#ffb4b4" }}>{text}</div>;
}
