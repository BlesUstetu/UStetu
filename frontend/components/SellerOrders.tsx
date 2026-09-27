"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

const USDC_DECIMALS = 6;
const MAX_ORDER_ID_SCAN = 1000;
const ORDER_BATCH_SIZE = 50;

const tokenMetadataAbi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

const short = (v?: string) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : "—");

const stateLabel: Record<number, string> = { 0: "PAYMENT PENDING", 1: "PAID", 2: "COMPLETED", 3: "EXPIRED" };

const stateClass = (state: number) => {
  if (state === 2) return "ok";
  if (state === 0 || state === 1) return "pending";
  if (state === 3) return "bad";
  return "neutral";
};

type OrderFilter = "ALL" | "PENDING" | "PAID" | "COMPLETED" | "EXPIRED";

const filterLabels: Record<OrderFilter, string> = {
  ALL: "All",
  PENDING: "Pending",
  PAID: "Paid",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

type SellerOrder = {
  id: bigint;
  listingId: bigint;
  buyer: string;
  tokenAmount: bigint;
  grossPayment: bigint;
  sellerProceeds: bigint;
  marketplaceFee: bigint;
  state: number;
  createdAt: bigint;
  paidAt: bigint;
  completedAt: bigint;
  expiresAt: bigint;
  tokenSymbol: string;
  tokenDecimals: number;
};

const orderAbi = [{
  type: "function",
  name: "getOrder",
  stateMutability: "view",
  inputs: [{ name: "orderId", type: "uint256" }],
  outputs: [{ name: "order", type: "tuple", components: [
    { name: "listingId", type: "uint256" }, { name: "buyer", type: "address" }, { name: "seller", type: "address" },
    { name: "recipient", type: "address" }, { name: "token", type: "address" }, { name: "paymentToken", type: "address" },
    { name: "tokenAmount", type: "uint256" }, { name: "unitPrice", type: "uint256" }, { name: "grossPayment", type: "uint256" },
    { name: "marketplaceFee", type: "uint256" }, { name: "sellerProceeds", type: "uint256" }, { name: "state", type: "uint8" },
    { name: "createdAt", type: "uint64" }, { name: "paidAt", type: "uint64" }, { name: "completedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ] }],
}] as const;

export default function SellerOrders() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("ALL");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!address || !publicClient) {
        setOrders([]);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const sellerOrders: SellerOrder[] = [];

        // Avoid eth_getLogs: some Base RPC endpoints require an archive token
        // for historical log scans. Read order state directly in multicall batches.
        for (let startId = 1; startId <= MAX_ORDER_ID_SCAN; startId += ORDER_BATCH_SIZE) {
          if (cancelled) return;

          const ids = Array.from(
            { length: Math.min(ORDER_BATCH_SIZE, MAX_ORDER_ID_SCAN - startId + 1) },
            (_, index) => BigInt(startId + index)
          );

          const results = await publicClient.multicall({
            contracts: ids.map((orderId) => ({
              address: USTETU_ESCROW_ADDRESS,
              abi: orderAbi,
              functionName: "getOrder" as const,
              args: [orderId],
            })),
            allowFailure: true,
          });

          for (let index = 0; index < results.length; index += 1) {
            const result = results[index];
            if (result.status !== "success" || !result.result) continue;

            const order = result.result;
            if (order.seller.toLowerCase() !== address.toLowerCase() || order.tokenAmount === 0n) continue;

            let tokenSymbol = "TOKEN";
            let tokenDecimals = 18;
            try {
              const [symbol, decimals] = await Promise.all([
                publicClient.readContract({ address: order.token, abi: tokenMetadataAbi, functionName: "symbol" }),
                publicClient.readContract({ address: order.token, abi: tokenMetadataAbi, functionName: "decimals" }),
              ]);
              tokenSymbol = symbol || tokenSymbol;
              tokenDecimals = Number(decimals);
            } catch {
              // Keep a safe fallback for non-standard ERC-20 metadata.
            }

            sellerOrders.push({
              id: ids[index],
              listingId: order.listingId,
              buyer: order.buyer,
              tokenAmount: order.tokenAmount,
              grossPayment: order.grossPayment,
              sellerProceeds: order.sellerProceeds,
              marketplaceFee: order.marketplaceFee,
              state: Number(order.state),
              createdAt: order.createdAt,
              paidAt: order.paidAt,
              completedAt: order.completedAt,
              expiresAt: order.expiresAt,
              tokenSymbol,
              tokenDecimals,
            });
          }
        }

        sellerOrders.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
        if (!cancelled) {
          setOrders(sellerOrders);
          setLastScan(`Order #1 → #${MAX_ORDER_ID_SCAN}`);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [address, publicClient]);

  const completed = orders.filter((o) => o.state === 2);
  const gross = completed.reduce((sum, o) => sum + o.grossPayment, 0n);
  const proceeds = completed.reduce((sum, o) => sum + o.sellerProceeds, 0n);
  const filterCounts: Record<OrderFilter, number> = {
    ALL: orders.length,
    PENDING: orders.filter((o) => o.state === 0).length,
    PAID: orders.filter((o) => o.state === 1).length,
    COMPLETED: completed.length,
    EXPIRED: orders.filter((o) => o.state === 3).length,
  };
  const filteredOrders = filter === "ALL"
    ? orders
    : orders.filter((o) => {
        if (filter === "PENDING") return o.state === 0;
        if (filter === "PAID") return o.state === 1;
        if (filter === "COMPLETED") return o.state === 2;
        return o.state === 3;
      });

  const downloadOrders = () => {
    if (!orders.length) return;

    const headers = [
      "Order ID", "Listing ID", "Buyer", "Token Amount", "Gross Payment",
      "Seller Proceeds", "Marketplace Fee", "Status", "Created At", "Paid At", "Completed At", "Expires At",
    ];
    const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = orders.map((o) => [
      o.id.toString(),
      o.listingId.toString(),
      o.buyer,
      `${formatUnits(o.tokenAmount, o.tokenDecimals)} ${o.tokenSymbol}`,
      `${formatUnits(o.grossPayment, USDC_DECIMALS)} USDC`,
      `${formatUnits(o.sellerProceeds, USDC_DECIMALS)} USDC`,
      `${formatUnits(o.marketplaceFee, USDC_DECIMALS)} USDC`,
      stateLabel[o.state] ?? `STATE ${o.state}`,
      o.createdAt.toString(),
      o.paidAt.toString(),
      o.completedAt.toString(),
      o.expiresAt.toString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ustetu-seller-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!isConnected) {
    return <section className="seller-orders"><div className="orders-empty"><strong>Connect wallet</strong><span>Hubungkan wallet seller untuk melihat order.</span></div></section>;
  }

  return (
    <section className="seller-orders">
      <style jsx global>{`
        .seller-orders{max-width:1180px;margin:0 auto;padding:28px 22px 70px;color:var(--text,#f5f7ff)}
        .orders-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:18px}.orders-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.55}.orders-head h1{margin:7px 0 4px;font-size:30px}.orders-head p{margin:0;opacity:.58}.orders-wallet{font:11px ui-monospace,monospace;opacity:.65}
        .orders-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.orders-card{position:relative;overflow:hidden;border:1px solid transparent;background:linear-gradient(145deg,rgba(8,16,32,.96),rgba(7,11,22,.98)) padding-box,linear-gradient(120deg,rgba(72,210,255,.28),rgba(105,92,255,.30),rgba(235,86,255,.18)) border-box;border-radius:18px;padding:17px;box-shadow:0 16px 48px rgba(0,0,0,.28),0 0 22px rgba(54,130,255,.05),inset 0 1px rgba(255,255,255,.07)}.orders-card:before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.16),transparent 70%)}.orders-card label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;opacity:.5}.orders-card strong{display:block;font-size:22px;margin-top:7px}.orders-card small{display:block;margin-top:4px;opacity:.5}
        .orders-panel{border:1px solid transparent;background:linear-gradient(145deg,rgba(7,14,29,.95),rgba(7,10,20,.98)) padding-box,linear-gradient(115deg,rgba(48,190,255,.30),rgba(105,92,255,.28),rgba(235,86,255,.16)) border-box;border-radius:20px;overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.30),0 0 26px rgba(54,130,255,.06),inset 0 1px rgba(255,255,255,.07)}.orders-toolbar{background:linear-gradient(90deg,rgba(72,210,255,.035),transparent 45%,rgba(105,92,255,.045));display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px 12px 18px;border-bottom:1px solid rgba(255,255,255,.08);font-size:12px}.orders-toolbar-info{display:flex;align-items:center;gap:12px;min-width:0}.orders-toolbar-scan{opacity:.55;text-align:right}.orders-filters{display:flex;gap:7px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.07);overflow-x:auto;background:rgba(255,255,255,.012)}.orders-filter{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:7px 10px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.025);color:inherit;font:inherit;font-size:10px;letter-spacing:.04em;cursor:pointer;opacity:.62;transition:.2s}.orders-filter:hover{opacity:.9;background:rgba(255,255,255,.06)}.orders-filter.active{opacity:1;border-color:rgba(72,210,255,.38);background:linear-gradient(145deg,rgba(72,210,255,.10),rgba(105,92,255,.08));box-shadow:0 0 14px rgba(72,168,255,.06)}.orders-filter-count{font-family:ui-monospace,monospace;opacity:.65}.orders-download{display:inline-flex;align-items:center;justify-content:center;flex:0 0 34px;width:34px;height:34px;padding:0;border:1px solid transparent;border-radius:10px;background:linear-gradient(145deg,rgba(10,20,38,.92),rgba(8,12,25,.96)) padding-box,linear-gradient(135deg,rgba(72,210,255,.28),rgba(105,92,255,.28),rgba(235,86,255,.16)) border-box;color:inherit;cursor:pointer;opacity:.82;transition:.2s}.orders-download:hover:not(:disabled){opacity:1;background:linear-gradient(145deg,rgba(12,25,48,.98),rgba(10,14,31,.98)) padding-box,linear-gradient(135deg,rgba(72,210,255,.68),rgba(105,92,255,.56),rgba(235,86,255,.38)) border-box;transform:translateY(-1px);box-shadow:0 0 18px rgba(72,168,255,.10)}.orders-download:disabled{opacity:.28;cursor:not-allowed}.orders-download svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .orders-table{width:100%;border-collapse:collapse}.orders-table th,.orders-table td{padding:13px 15px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);font-size:12px}.orders-table th{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#91b6d8;opacity:.85}.orders-table tr:last-child td{border-bottom:0}.mono{font-family:ui-monospace,monospace}.state{display:inline-flex;padding:5px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.1);font-size:10px}.state.ok{color:#75f7ae;border-color:rgba(117,247,174,.25)}.state.pending{color:#ffd166;border-color:rgba(255,209,102,.25)}.state.bad{color:#ff7777;border-color:rgba(255,119,119,.25)}.state.neutral{opacity:.7}.orders-empty{border:1px dashed rgba(72,168,255,.22);background:linear-gradient(145deg,rgba(72,210,255,.025),rgba(105,92,255,.018));border-radius:16px;padding:45px 20px;text-align:center;display:grid;gap:7px}.orders-empty span{opacity:.55;font-size:13px}.orders-error{margin:14px 0;padding:12px;border:1px solid rgba(255,119,119,.25);border-radius:12px;color:#ff9999;font-size:12px;word-break:break-word}
        @media(max-width:800px){.orders-summary{grid-template-columns:1fr}.orders-head{display:block}.orders-wallet{margin-top:10px}.orders-toolbar{align-items:flex-start}.orders-toolbar-info{flex:1}.orders-toolbar-scan{max-width:45%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.orders-panel{overflow:auto}.orders-table{min-width:760px}}
      `}</style>

      <div className="orders-summary">
        <div className="orders-card"><label>Completed Orders</label><strong>{completed.length}</strong><small>Order selesai</small></div>
        <div className="orders-card"><label>Gross Sales</label><strong>{formatUnits(gross, USDC_DECIMALS)} USDC</strong><small>Total pembayaran order completed</small></div>
        <div className="orders-card"><label>Completed Proceeds</label><strong>{formatUnits(proceeds, USDC_DECIMALS)} USDC</strong><small>Setelah marketplace fee</small></div>
      </div>

      {error && <div className="orders-error">{error}</div>}

      <div className="orders-panel">
        <div className="orders-toolbar">
          <div className="orders-toolbar-info"><span>{loading ? "Memuat order dari blockchain…" : `${filteredOrders.length} order tampil`}</span><span className="orders-toolbar-scan">{lastScan || `Escrow: ${short(USTETU_ESCROW_ADDRESS)}`}</span></div>
          <button className="orders-download" type="button" onClick={downloadOrders} disabled={!orders.length || loading} aria-label="Download file orders" title="Download Orders CSV">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v11" />
              <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
              <path d="M5 20h14" />
              <path d="M5 17v3" />
              <path d="M19 17v3" />
            </svg>
          </button>
        </div>
        <div className="orders-filters" role="tablist" aria-label="Filter order berdasarkan status">
          {(Object.keys(filterLabels) as OrderFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`orders-filter${filter === key ? " active" : ""}`}
              onClick={() => setFilter(key)}
              role="tab"
              aria-selected={filter === key}
            >
              <span>{filterLabels[key]}</span>
              <span className="orders-filter-count">{filterCounts[key]}</span>
            </button>
          ))}
        </div>
        {orders.length === 0 && !loading ? (
          <div className="orders-empty"><strong>Belum ada order seller</strong><span>Order yang dibuat buyer pada Escrow aktif akan muncul di sini.</span></div>
        ) : filteredOrders.length === 0 ? (
          <div className="orders-empty"><strong>Tidak ada order {filterLabels[filter].toLowerCase()}</strong><span>Belum ada order dengan status ini.</span></div>
        ) : (
          <table className="orders-table">
            <thead><tr><th>Order</th><th>Listing</th><th>Buyer</th><th>Token Amount</th><th>Gross</th><th>Proceeds</th><th>Fee</th><th>Status</th></tr></thead>
            <tbody>{filteredOrders.map((o) => <tr key={o.id.toString()}>
              <td className="mono">#{o.id.toString()}</td>
              <td className="mono">#{o.listingId.toString()}</td>
              <td className="mono">{short(o.buyer)}</td>
              <td>{formatUnits(o.tokenAmount, o.tokenDecimals)} {o.tokenSymbol}</td>
              <td>{formatUnits(o.grossPayment, USDC_DECIMALS)} USDC</td>
              <td>{formatUnits(o.sellerProceeds, USDC_DECIMALS)} USDC</td>
              <td>{formatUnits(o.marketplaceFee, USDC_DECIMALS)} USDC</td>
              <td><span className={`state ${stateClass(o.state)}`}>{stateLabel[o.state] ?? `STATE ${o.state}`}</span></td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
