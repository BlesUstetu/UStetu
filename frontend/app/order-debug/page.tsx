"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  erc20PaymentAbi,
  escrowAbi,
  USDC_BASE_SEPOLIA_ADDRESS,
  USTETU_ESCROW_ADDRESS,
} from "@/lib/contracts";

const STATE_NAMES: Record<number, string> = {
  0: "UNKNOWN / NONE",
  1: "PAYMENT_PENDING",
  2: "PAID",
  3: "EXPIRED",
  4: "CANCELLED",
  5: "COMPLETED",
};

function shortAddress(value?: string) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default function OrderDebugPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const order = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getOrder",
    args: [1n],
    query: { enabled: chainId === baseSepolia.id },
  });

  const allowance = useReadContract({
    address: USDC_BASE_SEPOLIA_ADDRESS,
    abi: erc20PaymentAbi,
    functionName: "allowance",
    args: address ? [address, USTETU_ESCROW_ADDRESS] : undefined,
    query: { enabled: Boolean(address) && chainId === baseSepolia.id },
  });

  const balance = useReadContract({
    address: USDC_BASE_SEPOLIA_ADDRESS,
    abi: erc20PaymentAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && chainId === baseSepolia.id },
  });

  const data = order.data;
  const state = data ? Number(data.state) : null;
  const gross = data?.grossPayment ?? 0n;
  const allowanceValue = allowance.data ?? 0n;
  const balanceValue = balance.data ?? 0n;
  const allowanceEnough = allowanceValue >= gross;

  const raw = useMemo(() => {
    if (!data) return "—";
    return JSON.stringify(data, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2);
  }, [data]);

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#070a12", color: "#eef2ff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.65 }}>USTETU DIAGNOSTIC</div>
          <h1 style={{ margin: "8px 0 4px", fontSize: 30 }}>Order #1 — Live On-Chain State</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>Read-only. Tidak mengirim transaksi dan tidak membuat order baru.</p>
        </div>

        {!isConnected && (
          <div style={{ padding: 16, borderRadius: 14, background: "#24151a", marginBottom: 16 }}>
            Hubungkan wallet terlebih dahulu untuk membaca balance dan allowance.
          </div>
        )}

        {chainId !== baseSepolia.id && (
          <div style={{ padding: 16, borderRadius: 14, background: "#2a2111", marginBottom: 16 }}>
            Wallet harus berada di Base Sepolia (chain ID 84532).
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 16 }}>
          <Card label="ORDER" value="#1" />
          <Card label="LISTING" value={data ? `#${data.listingId.toString()}` : "—"} />
          <Card label="STATE" value={state === null ? "Loading…" : `${STATE_NAMES[state] ?? `STATE ${state}`} (${state})`} />
          <Card label="TOKEN AMOUNT" value={data ? `${formatUnits(data.tokenAmount, 18)} USTETU` : "—"} />
          <Card label="UNIT PRICE" value={data ? `${formatUnits(data.unitPrice, 6)} USDC` : "—"} />
          <Card label="GROSS PAYMENT" value={data ? `${formatUnits(gross, 6)} USDC` : "—"} />
        </section>

        <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b", marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Payment readiness</h2>
          <Row label="Buyer" value={data?.buyer ? shortAddress(data.buyer) : "—"} />
          <Row label="Payment token" value={data?.paymentToken ? shortAddress(data.paymentToken) : "—"} />
          <Row label="USDC balance" value={`${formatUnits(balanceValue, 6)} USDC`} />
          <Row label="Escrow allowance" value={`${formatUnits(allowanceValue, 6)} USDC`} />
          <Row label="Required for Order #1" value={`${formatUnits(gross, 6)} USDC`} />
          <Row
            label="Allowance check"
            value={gross === 0n ? "Order belum terbaca" : allowanceEnough ? "SUFFICIENT — approval dilewati" : "INSUFFICIENT — perlu APPROVE"}
          />
        </section>

        <section style={{ padding: 20, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}>
          <h2 style={{ marginTop: 0 }}>Raw getOrder(1)</h2>
          <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.85, fontSize: 12, lineHeight: 1.55 }}>{raw}</pre>
        </section>

        <p style={{ marginTop: 18, fontSize: 12, opacity: 0.55 }}>
          Escrow: {USTETU_ESCROW_ADDRESS} · USDC: {USDC_BASE_SEPOLIA_ADDRESS}
        </p>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 18, borderRadius: 16, background: "#0d1220", border: "1px solid #20283b" }}>
      <div style={{ fontSize: 11, letterSpacing: 1.4, opacity: 0.55 }}>{label}</div>
      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid #1b2232" }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <strong style={{ textAlign: "right" }}>{value}</strong>
    </div>
  );
}
