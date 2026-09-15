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
  1: "PAYMENT_PENDING",
  2: "PAID",
  3: "EXPIRED",
  4: "CANCELLED",
  5: "COMPLETED",
};

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
  const owner = !!address && !!listing?.seller && listing.seller.toLowerCase() === address.toLowerCase();
  const canExpire = isConnected && chainId === baseSepolia.id && owner && expired && !busy;

  const refresh = () => {
    void listingQuery.refetch();
    void orderQuery.refetch();
  };

  const expire = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (!address) throw new Error("Hubungkan wallet Seller terlebih dahulu.");
      if (chainId !== baseSepolia.id) {
        await switchChainAsync({ chainId: baseSepolia.id });
      }
      if (!owner) throw new Error("Wallet aktif bukan owner Listing #2.");
      if (!order || orderState !== 1) throw new Error("Order #1 bukan PAYMENT_PENDING.");
      if (!expired) throw new Error("Order #1 belum melewati expiry.");

      const hash = await writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "expireOrder",
        args: [ORDER_ID],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setMessage(`Order #1 berhasil di-expire: ${hash.slice(0, 10)}…${hash.slice(-8)}`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!isConnected || chainId !== baseSepolia.id || !listing || !order) return null;
  if (!owner) return null;
  if (orderState !== 1 || !expired) return null;

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
            {busy ? "Memproses…" : "EXPIRE ORDER #1"}
          </button>
        </div>
        {message && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(20,80,45,.35)", color: "#75f7ae", fontSize: 13 }}>{message}</div>}
        {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(90,20,25,.45)", color: "#ff9b9b", fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div>}
      </div>
    </section>
  );
}
