"use client";

import { useEffect, useState } from "react";
import { decodeEventLog, type PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import BuyModal from "@/components/BuyModal";
import { escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";
import "./BuyModalFlow.css";

type Props = React.ComponentProps<typeof BuyModal>;
type FlowState = "normal" | "expired" | "released";
const PAYMENT_PENDING = 1;
const EXPIRED = 9;
const SCAN_BLOCKS = 5000n;
const POLL_MS = 5000;

type FoundOrder = {
  orderId: bigint;
  order: {
    state: number;
    tokenAmount: bigint;
    expiresAt: bigint;
  };
};

async function findLatestOrder(client: PublicClient, listingId: bigint, buyer: `0x${string}`): Promise<FoundOrder | null> {
  const latest = await client.getBlockNumber();
  const fromBlock = latest > SCAN_BLOCKS ? latest - SCAN_BLOCKS : 0n;
  const logs = await client.getLogs({ address: USTETU_ESCROW_ADDRESS, fromBlock, toBlock: latest });
  let latestId: bigint | null = null;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics, eventName: "OrderCreated" });
      const args = decoded.args;
      if (args.listingId !== listingId || args.buyer.toLowerCase() !== buyer.toLowerCase()) continue;
      if (latestId === null || args.orderId > latestId) latestId = args.orderId;
    } catch {}
  }
  if (latestId === null) return null;
  const raw = await client.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [latestId] });
  return {
    orderId: latestId,
    order: {
      state: Number(raw.state),
      tokenAmount: raw.tokenAmount,
      expiresAt: raw.expiresAt,
    },
  };
}

export default function BuyModalFlow(props: Props) {
  const { open } = props;
  const { address } = useAccount();
  const client = usePublicClient();
  const [flow, setFlow] = useState<FlowState>("normal");
  const [orderId, setOrderId] = useState<bigint | null>(null);
  const [orderState, setOrderState] = useState<number | null>(null);
  const [orderExpiresAt, setOrderExpiresAt] = useState<bigint | null>(null);
  const [now, setNow] = useState(0n);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (!open || !client || !address) return;
      try {
        const block = await client.getBlock({ blockTag: "latest" });
        const chainNow = block.timestamp;
        const found = await findLatestOrder(client, props.listingId, address);
        if (cancelled) return;
        setNow(chainNow);
        if (!found) {
          setFlow("normal");
          setOrderState(null);
          setOrderId(null);
          setOrderExpiresAt(null);
          return;
        }

        const { orderId: foundOrderId, order } = found;
        setOrderId(foundOrderId);
        setOrderState(order.state);
        setOrderExpiresAt(order.expiresAt);

        if (order.state === EXPIRED) {
          setFlow("released");
          return;
        }
        if (order.state === PAYMENT_PENDING) {
          setFlow(order.expiresAt <= chainNow ? "expired" : "normal");
          return;
        }
        setFlow("normal");
      } catch {}
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, client, address, props.listingId]);

  const remaining = orderExpiresAt && orderExpiresAt > now ? Number(orderExpiresAt - now) : 0;
  const remainingText = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;

  return (
    <>
      {/* The BuyModal remains available throughout the lifecycle. Expiry is a system event,
          not a buyer action, so it must never replace the Buy UI with a RELEASE screen. */}
      {open && <BuyModal {...props} />}

      {open && flow === "normal" && orderState === PAYMENT_PENDING && orderId !== null && orderExpiresAt && orderExpiresAt > now && (
        <div className="buy-expiry-countdown" role="status" aria-live="polite">
          <span>Payment deadline · Order #{orderId.toString()}</span>
          <strong>{remainingText}</strong>
        </div>
      )}

      {open && flow === "expired" && (
        <div className="buy-expiry-state" role="status" aria-live="polite">
          <span>Payment expired · waiting for automatic inventory release.</span>
        </div>
      )}

      {open && flow === "released" && (
        <div className="buy-expiry-state buy-expiry-state--released" role="status" aria-live="polite">
          <span>Previous order expired. Inventory has been released. You can create a new order.</span>
        </div>
      )}
    </>
  );
}
