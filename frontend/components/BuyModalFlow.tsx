"use client";

import { useEffect, useState } from "react";
import { decodeEventLog, formatUnits, type PublicClient } from "viem";
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

async function findLatestOrder(client: PublicClient, listingId: bigint, buyer: `0x${string}`) {
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
  return client.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [latestId] });
}

export default function BuyModalFlow(props: Props) {
  const { open, onCompleted } = props;
  const { address } = useAccount();
  const client = usePublicClient();
  const [flow, setFlow] = useState<FlowState>("normal");
  const [orderId, setOrderId] = useState<bigint | null>(null);
  const [orderState, setOrderState] = useState<number | null>(null);
  const [orderAmount, setOrderAmount] = useState<bigint | null>(null);
  const [orderExpiresAt, setOrderExpiresAt] = useState<bigint | null>(null);
  const [now, setNow] = useState(0n);
  const [remount, setRemount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (!open || !client || !address) return;
      try {
        const block = await client.getBlock({ blockTag: "latest" });
        const chainNow = block.timestamp;
        const order = await findLatestOrder(client, props.listingId, address);
        if (cancelled) return;
        setNow(chainNow);
        if (!order) return;
        const state = Number(order.state);
        setOrderId((previous) => previous === null || order.orderId > previous ? order.orderId : previous);
        setOrderState(state);
        setOrderAmount(order.tokenAmount);
        setOrderExpiresAt(order.expiresAt);
        if (state === EXPIRED) { setFlow("released"); return; }
        if (state === PAYMENT_PENDING) { setFlow(order.expiresAt <= chainNow ? "expired" : "normal"); return; }
        setFlow("normal");
      } catch {}
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [open, client, address, props.listingId]);

  const remaining = orderExpiresAt && orderExpiresAt > now ? Number(orderExpiresAt - now) : 0;
  const remainingText = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;

  const createNewOrder = () => {
    setFlow("normal");
    setOrderId(null);
    setOrderState(null);
    setOrderAmount(null);
    setOrderExpiresAt(null);
    setRemount((value) => value + 1);
    onCompleted();
  };

  return (
    <>
      <BuyModal key={remount} {...props} />
      {open && flow === "expired" && (
        <div className="buy-expiry-banner" role="status">
          <strong>Payment expired</strong>
          <span>Order #{orderId?.toString() ?? "—"} melewati batas 15 menit.</span>
          <small>Menunggu sistem otomatis melepas inventory. Buyer tidak perlu melakukan RELEASE.</small>
        </div>
      )}
      {open && flow === "normal" && orderState === PAYMENT_PENDING && orderId !== null && orderExpiresAt && orderExpiresAt > now && (
        <div className="buy-expiry-countdown" role="status">
          <span>Payment deadline · Order #{orderId.toString()}</span><strong>{remainingText}</strong>
        </div>
      )}
      {open && flow === "released" && (
        <div className="buy-expiry-banner buy-expiry-released" role="status">
          <strong>Order #{orderId?.toString() ?? "—"} expired — inventory released</strong>
          <span>{orderAmount !== null ? formatUnits(orderAmount, props.tokenDecimals) : ""} {props.symbol} kembali tersedia di listing.</span>
          <button type="button" onClick={createNewOrder}>Create New Order</button>
        </div>
      )}
    </>
  );
}
