"use client";

import { useEffect, useState } from "react";
import { decodeEventLog, encodeFunctionData, type PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import BuyModal from "@/components/BuyModal";
import { escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

type Props = React.ComponentProps<typeof BuyModal>;
type Completed = { orderId: bigint; txHash?: `0x${string}` };
const COMPLETED = 5;
const BASESCAN_TX = "https://sepolia.basescan.org/tx/";

async function latestOrder(client: PublicClient, listingId: bigint, buyer: `0x${string}`) {
  const latest = await client.getBlockNumber();
  const from = latest > 100n ? latest - 100n : 0n;
  const logs = await client.getLogs({ address: USTETU_ESCROW_ADDRESS, fromBlock: from, toBlock: latest });
  let found: { orderId: bigint; txHash?: `0x${string}` } | null = null;
  for (const log of logs) {
    try {
      const d = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics, eventName: "OrderCreated" });
      if (d.eventName !== "OrderCreated") continue;
      if (d.args.listingId !== listingId || d.args.buyer.toLowerCase() !== buyer.toLowerCase()) continue;
      if (!found || d.args.orderId > found.orderId) found = { orderId: d.args.orderId, txHash: log.transactionHash ?? undefined };
    } catch {}
  }
  return found;
}

async function getCompleteTx(client: PublicClient, orderId: bigint, buyer: `0x${string}`) {
  const latest = await client.getBlockNumber();
  const from = latest > 160n ? latest - 160n : 0n;
  const input = encodeFunctionData({ abi: escrowAbi, functionName: "completeOrder", args: [orderId] }).toLowerCase();
  for (let n = latest; n >= from; n--) {
    try {
      const block = await client.getBlock({ blockNumber: n, includeTransactions: true });
      for (const tx of block.transactions) {
        if (typeof tx === "string") continue;
        if (tx.to?.toLowerCase() !== USTETU_ESCROW_ADDRESS.toLowerCase()) continue;
        if (tx.from.toLowerCase() !== buyer.toLowerCase()) continue;
        if (tx.input.toLowerCase() === input) return tx.hash;
      }
    } catch {}
  }
  return undefined;
}

async function getState(client: PublicClient, orderId: bigint) {
  try { return await client.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [orderId] }); }
  catch { return null; }
}

export default function BuyModalFlow(props: Props) {
  const client = usePublicClient();
  const { address } = useAccount();
  const [recoveryKey, setRecoveryKey] = useState(0);
  const [seenOrder, setSeenOrder] = useState<bigint | null>(null);
  const [completed, setCompleted] = useState<Completed | null>(null);

  useEffect(() => {
    let cancelled = false;
    const recover = async () => {
      if (!props.open || !client || !address || cancelled) return;
      try {
        const found = await latestOrder(client, props.listingId, address);
        if (!found || cancelled) return;
        const order = await getState(client, found.orderId);
        if (!order || cancelled) return;
        if (Number(order.state) === COMPLETED) {
          const txHash = await getCompleteTx(client, found.orderId, address);
          if (!cancelled) setCompleted({ orderId: found.orderId, txHash });
          return;
        }
        if (seenOrder !== found.orderId && !cancelled) {
          setSeenOrder(found.orderId);
          setRecoveryKey(v => v + 1);
        }
      } catch {}
    };
    void recover();
    const timer = window.setInterval(() => void recover(), 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [props.open, props.listingId, client, address, seenOrder]);

  if (completed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0b1424] p-5 text-white shadow-2xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Purchase complete</div>
          <h2 className="mt-1 text-2xl font-semibold">USTETU Purchased</h2>
          <p className="mt-3 text-sm text-slate-300">Order #{completed.orderId} sudah COMPLETED on-chain.</p>
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs">
            <div className="text-slate-400">Transaksi Complete</div>
            {completed.txHash ? <a className="mt-2 block break-all text-cyan-300 underline" href={`${BASESCAN_TX}${completed.txHash}`} target="_blank" rel="noreferrer">{completed.txHash.slice(0, 10)}…{completed.txHash.slice(-8)} ↗</a> : <div className="mt-2 text-slate-400">Confirmed. Hash sedang dicari…</div>}
          </div>
          <button type="button" className="mt-4 w-full rounded-xl border border-cyan-400/50 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200" onClick={props.onCompleted}>Selesai</button>
        </div>
      </div>
    );
  }

  return <BuyModal key={recoveryKey} {...props} />;
}
