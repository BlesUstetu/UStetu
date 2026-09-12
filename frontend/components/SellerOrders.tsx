"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

const TOKEN_DECIMALS = 18;
const USDC_DECIMALS = 6;
const ORDER_SCAN_BLOCKS = 100_000n;
const RPC_LOG_CHUNK = 40_000n;

const orderCreatedEvent = parseAbiItem(
  "event OrderCreated(uint256 indexed orderId,uint256 indexed listingId,address indexed buyer,address seller,address recipient,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,address paymentToken)"
);

const short = (v?: string) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : "—");

const stateLabel: Record<number, string> = {
  0: "CREATED",
  1: "PAYMENT PENDING",
  2: "PAID",
  3: "ESCROWED",
  4: "RELEASABLE",
  5: "COMPLETED",
  6: "REFUNDED",
  7: "CANCELLED",
  8: "DISPUTED",
  9: "EXPIRED",
};

const stateClass = (state: number) => {
  if (state === 5) return "ok";
  if (state === 1 || state === 2 || state === 3 || state === 4) return "pending";
  if (state === 6 || state === 7 || state === 9) return "bad";
  return "neutral";
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
    { name: "refundedAt", type: "uint64" }, { name: "expiresAt", type: "uint64" }, { name: "disputeId", type: "uint256" },
  ] }],
}] as const;

export default function SellerOrders() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastScan, setLastScan] = useState("");

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
        const latest = await publicClient.getBlockNumber();
        const fromBlock = latest > ORDER_SCAN_BLOCKS ? latest - ORDER_SCAN_BLOCKS : 0n;
        const allLogs = [] as Awaited<ReturnType<typeof publicClient.getLogs<typeof orderCreatedEvent>>>;

        // Base Sepolia RPC limits eth_getLogs to 50,000 blocks.
        // Keep a lower safety margin and scan the same 100k window in chunks.
        for (let start = fromBlock; start <= latest; start += RPC_LOG_CHUNK) {
          if (cancelled) return;
          const end = start + RPC_LOG_CHUNK - 1n > latest ? latest : start + RPC_LOG_CHUNK - 1n;
          const chunkLogs = await publicClient.getLogs({
            address: USTETU_ESCROW_ADDRESS,
            event: orderCreatedEvent,
            fromBlock: start,
            toBlock: end,
          });
          allLogs.push(...chunkLogs);
        }

        const sellerOrders: SellerOrder[] = [];
        for (const log of allLogs) {
          if (!log.args.orderId) continue;
          const order = await publicClient.readContract({
            address: USTETU_ESCROW_ADDRESS,
            abi: orderAbi,
            functionName: "getOrder",
            args: [log.args.orderId],
          });

          if (order.seller.toLowerCase() !== address.toLowerCase()) continue;
          sellerOrders.push({
            id: log.args.orderId,
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
          });
        }

        sellerOrders.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
        if (!cancelled) {
          setOrders(sellerOrders);
          setLastScan(`Block ${fromBlock.toString()} → ${latest.toString()}`);
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

  const completed = orders.filter((o) => o.state === 5);
  const gross = completed.reduce((sum, o) => sum + o.grossPayment, 0n);
  const proceeds = completed.reduce((sum, o) => sum + o.sellerProceeds, 0n);

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
      `${formatUnits(o.tokenAmount, TOKEN_DECIMALS)} USTETU`,
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
        .orders-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}.orders-card{border:1px solid rgba(255,255,255,.1);background:rgba(10,14,25,.72);backdrop-filter:blur(14px);border-radius:16px;padding:16px}.orders-card label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;opacity:.5}.orders-card strong{display:block;font-size:22px;margin-top:7px}.orders-card small{display:block;margin-top:4px;opacity:.5}
        .orders-panel{border:1px solid rgba(255,255,255,.1);background:rgba(10,14,25,.72);border-radius:18px;overflow:hidden}.orders-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px 12px 18px;border-bottom:1px solid rgba(255,255,255,.08);font-size:12px}.orders-toolbar-info{display:flex;align-items:center;gap:12px;min-width:0}.orders-toolbar-scan{opacity:.55;text-align:right}.orders-download{display:inline-flex;align-items:center;justify-content:center;flex:0 0 34px;width:34px;height:34px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.035);color:inherit;cursor:pointer;opacity:.82;transition:.2s}.orders-download:hover:not(:disabled){opacity:1;background:rgba(255,255,255,.09);transform:translateY(-1px)}.orders-download:disabled{opacity:.28;cursor:not-allowed}.orders-download svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .orders-table{width:100%;border-collapse:collapse}.orders-table th,.orders-table td{padding:13px 15px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);font-size:12px}.orders-table th{font-size:10px;text-transform:uppercase;letter-spacing:.1em;opacity:.5}.orders-table tr:last-child td{border-bottom:0}.mono{font-family:ui-monospace,monospace}.state{display:inline-flex;padding:5px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.1);font-size:10px}.state.ok{color:#75f7ae;border-color:rgba(117,247,174,.25)}.state.pending{color:#ffd166;border-color:rgba(255,209,102,.25)}.state.bad{color:#ff7777;border-color:rgba(255,119,119,.25)}.state.neutral{opacity:.7}.orders-empty{border:1px dashed rgba(255,255,255,.14);border-radius:16px;padding:45px 20px;text-align:center;display:grid;gap:7px}.orders-empty span{opacity:.55;font-size:13px}.orders-error{margin:14px 0;padding:12px;border:1px solid rgba(255,119,119,.25);border-radius:12px;color:#ff9999;font-size:12px;word-break:break-word}
        @media(max-width:800px){.orders-summary{grid-template-columns:1fr}.orders-head{display:block}.orders-wallet{margin-top:10px}.orders-toolbar{align-items:flex-start}.orders-toolbar-info{flex:1}.orders-toolbar-scan{max-width:45%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.orders-panel{overflow:auto}.orders-table{min-width:760px}}
      `}</style>

      <div className="orders-head">
        <div><div className="orders-eyebrow">Seller Center / Orders</div><h1>My Orders</h1><p>Riwayat order yang masuk ke listing milik wallet seller ini.</p></div>
        <div className="orders-wallet">Seller: {short(address)}</div>
      </div>

      <div className="orders-summary">
        <div className="orders-card"><label>Completed Orders</label><strong>{completed.length}</strong><small>Order selesai</small></div>
        <div className="orders-card"><label>Gross Sales</label><strong>{formatUnits(gross, USDC_DECIMALS)} USDC</strong><small>Total pembayaran order completed</small></div>
        <div className="orders-card"><label>Seller Proceeds</label><strong>{formatUnits(proceeds, USDC_DECIMALS)} USDC</strong><small>Setelah marketplace fee</small></div>
      </div>

      {error && <div className="orders-error">{error}</div>}

      <div className="orders-panel">
        <div className="orders-toolbar">
          <div className="orders-toolbar-info"><span>{loading ? "Memuat order dari blockchain…" : `${orders.length} order ditemukan`}</span><span className="orders-toolbar-scan">{lastScan || `Escrow: ${short(USTETU_ESCROW_ADDRESS)}`}</span></div>
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
        {orders.length === 0 && !loading ? (
          <div className="orders-empty"><strong>Belum ada order seller</strong><span>Order yang dibuat buyer pada Escrow aktif akan muncul di sini.</span></div>
        ) : (
          <table className="orders-table">
            <thead><tr><th>Order</th><th>Listing</th><th>Buyer</th><th>Amount</th><th>Gross</th><th>Proceeds</th><th>Fee</th><th>Status</th></tr></thead>
            <tbody>{orders.map((o) => <tr key={o.id.toString()}>
              <td className="mono">#{o.id.toString()}</td>
              <td className="mono">#{o.listingId.toString()}</td>
              <td className="mono">{short(o.buyer)}</td>
              <td>{formatUnits(o.tokenAmount, TOKEN_DECIMALS)} USTETU</td>
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
