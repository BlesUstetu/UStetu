"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { decodeEventLog, encodeFunctionData, type PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import BuyModal from "@/components/BuyModal";
import { escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

type Props = React.ComponentProps<typeof BuyModal>;
type OrderRef = { orderId: bigint; blockNumber: bigint; txHash?: `0x${string}` };
type Completed = { orderId: bigint; txHash?: `0x${string}` };

const PAYMENT_PENDING = 0;
const PAID = 1;
const COMPLETED = 2;
const BASESCAN_TX = "https://basescan.org/tx/";

async function scanCreated(client: PublicClient, fromBlock: bigint, toBlock: bigint, listingId: bigint, buyer: `0x${string}`): Promise<OrderRef | null> {
  if (toBlock < fromBlock) return null;
  const logs = await client.getLogs({ address: USTETU_ESCROW_ADDRESS, fromBlock, toBlock });
  let found: OrderRef | null = null;
  for (const log of logs) {
    try {
      const d = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics, eventName: "OrderCreated" });
      if (d.eventName !== "OrderCreated") continue;
      if (d.args.listingId !== listingId || d.args.buyer.toLowerCase() !== buyer.toLowerCase()) continue;
      const candidate = { orderId: d.args.orderId, blockNumber: log.blockNumber, txHash: log.transactionHash ?? undefined };
      if (!found || candidate.orderId > found.orderId) found = candidate;
    } catch {}
  }
  return found;
}

async function readState(client: PublicClient, orderId: bigint) {
  try { return await client.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [orderId] }); }
  catch { return null; }
}

async function findCompleteTx(client: PublicClient, orderId: bigint, buyer: `0x${string}`, fromBlock: bigint) {
  const latest = await client.getBlockNumber();
  const start = latest > fromBlock + 160n ? latest - 160n : fromBlock;
  const input = encodeFunctionData({ abi: escrowAbi, functionName: "completeOrder", args: [orderId] }).toLowerCase();
  for (let n = latest; n >= start; n--) {
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

export default function BuyModalFlow(props: Props) {
  const client = usePublicClient();
  const { address } = useAccount();
  const [recoveryKey, setRecoveryKey] = useState(0);
  const [completed, setCompleted] = useState<Completed | null>(null);
  const baselineBlockRef = useRef<bigint | null>(null);
  const seenOrderRef = useRef<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const resetForOpen = async () => {
      if (!props.open || !client || !address) return;
      const latest = await client.getBlockNumber();
      baselineBlockRef.current = latest;
      seenOrderRef.current = null;
      setCompleted(null);
      if (cancelled) return;

      const existing = await scanCreated(client, latest > 100n ? latest - 100n : 0n, latest, props.listingId, address);
      if (!existing || cancelled) return;
      const state = await readState(client, existing.orderId);
      if (!state || cancelled) return;
      const n = Number(state.state);
      if (n === PAYMENT_PENDING || n === PAID) seenOrderRef.current = existing.orderId;
    };

    const recover = async () => {
      if (cancelled || !props.open || !client || !address || baselineBlockRef.current === null) return;
      try {
        const latest = await client.getBlockNumber();
        const from = baselineBlockRef.current + 1n;
        const created = await scanCreated(client, from, latest, props.listingId, address);
        if (!created || cancelled || seenOrderRef.current === created.orderId) return;
        seenOrderRef.current = created.orderId;
        const state = await readState(client, created.orderId);
        if (!state || cancelled) return;
        const n = Number(state.state);
        if (n === COMPLETED) {
          const txHash = await findCompleteTx(client, created.orderId, address, created.blockNumber);
          if (!cancelled) setCompleted({ orderId: created.orderId, txHash });
        } else if (n === PAYMENT_PENDING || n === PAID) {
          setRecoveryKey(v => v + 1);
        }
      } catch {}
    };

    void resetForOpen().then(() => {
      if (!cancelled) timer = window.setInterval(() => void recover(), 5000);
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      baselineBlockRef.current = null;
      seenOrderRef.current = null;
    };
  }, [props.open, props.listingId, client, address]);

  if (completed && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-400/40 bg-[#0b1424] p-6 text-white shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-400/10 text-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.35)]" aria-label="Success">
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5 9.2 17 19 7" />
              </svg>
            </div>
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Success</div>
            <h2 className="mt-1 text-2xl font-semibold">USTETU Purchased</h2>
            <p className="mt-3 text-sm text-slate-300">Order #{completed.orderId} sudah COMPLETED on-chain.</p>
          </div>
          <div className="mt-5 rounded-xl border border-emerald-400/20 bg-slate-900/60 p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-emerald-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15">✓</span>
              Transaksi Complete berhasil
            </div>
            {completed.txHash ? <a className="mt-2 block break-all text-cyan-300 underline" href={`${BASESCAN_TX}${completed.txHash}`} target="_blank" rel="noreferrer">{completed.txHash.slice(0, 10)}…{completed.txHash.slice(-8)} ↗</a> : <div className="mt-2 text-slate-400">Confirmed. Hash sedang dicari…</div>}
          </div>
          <button type="button" className="mt-4 w-full rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200" onClick={props.onCompleted}>Selesai</button>
        </div>
      </div>,
      document.body
    );
  }

  return <BuyModal key={recoveryKey} {...props} />;
}
