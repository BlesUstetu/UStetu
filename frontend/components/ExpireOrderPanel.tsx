"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import { escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

const LISTING_ID = 2n;
const ORDER_ID = 1n;
const TOKEN_DECIMALS = 18;

const STATE_NAMES: Record<number, string> = { 0: "PAYMENT_PENDING", 1: "PAID", 2: "COMPLETED", 3: "EXPIRED" };

export default function ExpireOrderPanel() {
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
    query: { enabled: chainId === base.id },
  });

  const orderQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getOrder",
    args: [ORDER_ID],
    query: { enabled: chainId === base.id },
  });

  const listing = listingQuery.data;
  const order = orderQuery.data;
  const orderState = order ? Number(order.state) : null;
  const available = listing ? listing.inventoryDeposited - listing.inventoryLocked : 0n;
  const expired = !!order && orderState === 0 && BigInt(Math.floor(Date.now() / 1000)) >= order.expiresAt;
  const canExpire = isConnected && chainId === base.id && expired && !busy;

  const refresh = () => {
    void listingQuery.refetch();
    void orderQuery.refetch();
  };

  const expire = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (!address) throw new Error("Connect the Seller wallet first.");
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }
      if (!order || orderState !== 0) throw new Error("Order #1 is not in PAYMENT_PENDING state.");
      if (!expired) throw new Error("Order #1 has not reached its expiry time.");

      const hash = await writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "expireOrder",
        args: [ORDER_ID],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setMessage(`Order #1 expired successfully: ${hash.slice(0, 10)}…${hash.slice(-8)}`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!isConnected || chainId !== base.id || !listing || !order) return null;
  if (orderState !== 0 || !expired) return null;

  return (
    <section className="expire-order-panel" style={{ margin: "0 auto 24px", maxWidth: 1180, padding: "0 22px" }}>
      <div className="expire-order-card" style={{ border: "1px solid rgba(255,100,100,.25)", background: "rgba(35,12,18,.78)", borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", opacity: .65 }}>ORDER RECOVERY</div>
            <h2 style={{ margin: "6px 0 5px", fontSize: 19 }}>Order #1 — Expired</h2>
            <p style={{ margin: 0, opacity: .72, fontSize: 13 }}>
              Listing #2 · {formatUnits(order.tokenAmount, TOKEN_DECIMALS)} USTETU · {STATE_NAMES[orderState]}
            </p>
            <p style={{ margin: "5px 0 0", opacity: .58, fontSize: 12 }}>
              Inventory locked: {formatUnits(listing.inventoryLocked, TOKEN_DECIMALS)} USTETU · Available: {formatUnits(available, TOKEN_DECIMALS)} USTETU
            </p>
          </div>
          <button onClick={expire} disabled={!canExpire} style={{ border: 0, borderRadius: 11, padding: "12px 17px", cursor: busy ? "wait" : "pointer", background: "#e55353", color: "white", fontWeight: 800 }}>
            {busy ? "Processing…" : "EXPIRE ORDER #1"}
          </button>
        </div>
        {message && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(20,80,45,.35)", color: "#75f7ae", fontSize: 13 }}>{message}</div>}
        {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(90,20,25,.45)", color: "#ff9b9b", fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div>}
      </div>
    </section>
  );
}
