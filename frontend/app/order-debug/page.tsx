"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, useReadContract, useSimulateContract } from "wagmi";
import { base } from "wagmi/chains";
import {
  erc20PaymentAbi,
  escrowAbi,
  BASE_MAINNET_USDC_ADDRESS,
  USTETU_ESCROW_ADDRESS,
} from "@/lib/contracts";

const STATE_NAMES: Record<number, string> = {
  0: "PAYMENT_PENDING",
  1: "PAID",
  2: "COMPLETED",
  3: "EXPIRED",
};

const LISTING_STATUS_NAMES: Record<number, string> = {
  0: "NONE",
  1: "ACTIVE",
  2: "PAUSED",
  3: "CLOSED",
  
};

function shortAddress(value?: string) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatDate(timestamp?: bigint) {
  if (!timestamp || timestamp === 0n) return "—";
  return new Date(Number(timestamp) * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

export default function OrderDebugPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const enabled = chainId === base.id;

  const order = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getOrder",
    args: [1n],
    query: { enabled },
  });

  const listing = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getListing",
    args: [2n],
    query: { enabled },
  });

  // READ-ONLY preflight: eth_call only. It does NOT create an order.
  // If this fails, the returned error is the exact createOrder revert path.
  const createOrderSimulation = useSimulateContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "createOrder",
    args: [2n, 1_000_000_000_000_000_000n],
    account: address,
    query: { enabled: Boolean(address) && enabled },
  });

  const allowance = useReadContract({
    address: BASE_MAINNET_USDC_ADDRESS,
    abi: erc20PaymentAbi,
    functionName: "allowance",
    args: address ? [address, USTETU_ESCROW_ADDRESS] : undefined,
    query: { enabled: Boolean(address) && enabled },
  });

  const balance = useReadContract({
    address: BASE_MAINNET_USDC_ADDRESS,
    abi: erc20PaymentAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && enabled },
  });

  const data = order.data;
  const listingData = listing.data;
  const state = data ? Number(data.state) : null;
  const listingStatus = listingData ? Number(listingData.status) : null;
  const gross = data?.grossPayment ?? 0n;
  const allowanceValue = allowance.data ?? 0n;
  const balanceValue = balance.data ?? 0n;
  const allowanceEnough = allowanceValue >= gross;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const orderExpired = Boolean(data && Number(data.expiresAt) <= nowSeconds);

  const orderRaw = useMemo(() => {
    if (!data) return "—";
    return JSON.stringify(data, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2);
  }, [data]);

  const listingRaw = useMemo(() => {
    if (!listingData) return "—";
    return JSON.stringify(listingData, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2);
  }, [listingData]);

  const simulationError = createOrderSimulation.error?.message ?? "";

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#070a12", color: "#eef2ff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.65 }}>USTETU DIAGNOSTIC</div>
          <h1 style={{ margin: "8px 0 4px", fontSize: 30 }}>Listing #2 + Order #1 — Live On-Chain Preflight</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>Read-only. Tidak mengirim transaksi, tidak approve, dan tidak membuat order baru.</p>
        </div>

        {!isConnected && (
          <div style={{ padding: 16, borderRadius: 14, background: "#24151a", marginBottom: 16 }}>
            Hubungkan wallet terlebih dahulu agar simulasi createOrder menggunakan address buyer.
          </div>
        )}

        {chainId !== base.id && (
          <div style={{ padding: 16, borderRadius: 14, background: "#2a2111", marginBottom: 16 }}>
            Wallet harus berada di Base Mainnet (chain ID 8453).
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 16 }}>
          <Card label="LISTING" value="#2" />
          <Card label="LISTING STATUS" value={listingStatus === null ? "Loading…" : `${LISTING_STATUS_NAMES[listingStatus] ?? `STATUS ${listingStatus}`} (${listingStatus})`} />
          <Card label="INVENTORY DEPOSITED" value={listingData ? `${formatUnits(listingData.inventoryDeposited, 18)} USTETU` : "—"} />
          <Card label="INVENTORY LOCKED" value={listingData ? `${formatUnits(listingData.inventoryLocked, 18)} USTETU` : "—"} />
          <Card label="AVAILABLE" value={listingData ? `${formatUnits(listingData.inventoryDeposited - listingData.inventoryLocked, 18)} USTETU` : "—"} />
          <Card label="MIN / MAX" value={listingData ? `${formatUnits(listingData.minOrderAmount, 18)} / ${formatUnits(listingData.maxOrderAmount, 18)} USTETU` : "—"} />
          <Card label="PRICE" value={listingData ? `${formatUnits(listingData.price, 6)} USDC` : "—"} />
          <Card label="TOKEN ID" value={listingData ? `0x${listingData.tokenId.toString(16).padStart(64, "0")}` : "—"} />
        </section>

        <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b", marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Create Order #2 preflight — 1 USTETU</h2>
          <Row label="Simulation" value={createOrderSimulation.isLoading ? "Simulating…" : createOrderSimulation.isSuccess ? "SUCCESS — createOrder(2, 1 USTETU) dapat dijalankan" : "REVERT"} />
          <Row label="Simulation error" value={simulationError || "Tidak ada error"} />
          <p style={{ marginBottom: 0, fontSize: 12, opacity: 0.55 }}>
            Simulasi memakai eth_call sehingga tidak mengubah blockchain. Jika bagian ini REVERT, jangan klik Buy; error di sini adalah petunjuk utama penyebab transaksi Create Order gagal.
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 16 }}>
          <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}>
            <h2 style={{ marginTop: 0 }}>Order #1</h2>
            <Row label="State" value={state === null ? "Loading…" : `${STATE_NAMES[state] ?? `STATE ${state}`} (${state})`} />
            <Row label="Expired" value={data ? (orderExpired ? "YES" : "NO") : "—"} />
            <Row label="Expires" value={data ? formatDate(data.expiresAt) : "—"} />
            <Row label="Token amount" value={data ? `${formatUnits(data.tokenAmount, 18)} USTETU` : "—"} />
            <Row label="Unit price" value={data ? `${formatUnits(data.unitPrice, 6)} USDC` : "—"} />
            <Row label="Gross payment" value={data ? `${formatUnits(gross, 6)} USDC` : "—"} />
            <Row label="Buyer" value={data?.buyer ? shortAddress(data.buyer) : "—"} />
          </section>

          <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}>
            <h2 style={{ marginTop: 0 }}>Payment readiness</h2>
            <Row label="USDC balance" value={`${formatUnits(balanceValue, 6)} USDC`} />
            <Row label="Escrow allowance" value={`${formatUnits(allowanceValue, 6)} USDC`} />
            <Row label="Required for Order #1" value={`${formatUnits(gross, 6)} USDC`} />
            <Row label="Allowance check" value={gross === 0n ? "Order belum terbaca" : allowanceEnough ? "SUFFICIENT" : "INSUFFICIENT"} />
            <Row label="Payment token" value={data?.paymentToken ? shortAddress(data.paymentToken) : "—"} />
          </section>
        </section>

        <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b", marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Raw getListing(2)</h2>
          <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.85, fontSize: 12, lineHeight: 1.55 }}>{listingRaw}</pre>
        </section>

        <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}>
          <h2 style={{ marginTop: 0 }}>Raw getOrder(1)</h2>
          <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.85, fontSize: 12, lineHeight: 1.55 }}>{orderRaw}</pre>
        </section>

        <p style={{ marginTop: 18, fontSize: 12, opacity: 0.55 }}>
          Escrow: {USTETU_ESCROW_ADDRESS} · USDC: {BASE_MAINNET_USDC_ADDRESS}
        </p>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 18, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}>
      <div style={{ fontSize: 11, letterSpacing: 1.4, opacity: 0.55 }}>{label}</div>
      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid #1b2232" }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <strong style={{ textAlign: "right", wordBreak: "break-word" }}>{value}</strong>
    </div>
  );
}
