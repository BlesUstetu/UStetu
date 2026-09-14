"use client";

import { useEffect, useState } from "react";
import { decodeEventLog, type PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import BuyModal from "@/components/BuyModal";
import { escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

type Props = React.ComponentProps<typeof BuyModal>;

/**
 * Recovery bridge for wallet/RPC connectors that keep writeContractAsync
 * pending even after createOrder has already been mined.
 *
 * We never submit a second transaction. We watch the OrderCreated event and
 * remount BuyModal so its existing on-chain resume logic can pick up the
 * confirmed PAYMENT_PENDING order and expose its transaction hash.
 */
async function findLatestCreated(
  client: PublicClient,
  listingId: bigint,
  buyer: `0x${string}`,
): Promise<{ orderId: bigint; txHash?: `0x${string}` } | null> {
  const latest = await client.getBlockNumber();
  const from = latest > 80n ? latest - 80n : 0n;
  const logs = await client.getLogs({ address: USTETU_ESCROW_ADDRESS, fromBlock: from, toBlock: latest });
  let found: { orderId: bigint; txHash?: `0x${string}` } | null = null;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics, eventName: "OrderCreated" });
      if (decoded.eventName !== "OrderCreated") continue;
      if (decoded.args.listingId !== listingId) continue;
      if (decoded.args.buyer.toLowerCase() !== buyer.toLowerCase()) continue;
      if (!found || decoded.args.orderId > found.orderId) {
        found = { orderId: decoded.args.orderId, txHash: log.transactionHash ?? undefined };
      }
    } catch {}
  }
  return found;
}

export default function BuyModalFlow(props: Props) {
  const client = usePublicClient();
  const { address } = useAccount();
  const [recoveryKey, setRecoveryKey] = useState(0);
  const [recoveredOrderId, setRecoveredOrderId] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function recover() {
      if (cancelled || !props.open || !client || !address) return;
      try {
        const found = await findLatestCreated(client, props.listingId, address);
        if (!found || cancelled) return;
        if (recoveredOrderId !== found.orderId) {
          setRecoveredOrderId(found.orderId);
          setRecoveryKey((value) => value + 1);
        }
      } catch {}
    }

    void recover();
    timer = setInterval(() => void recover(), 1500);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [props.open, props.listingId, client, address, recoveredOrderId]);

  return <BuyModal key={recoveryKey} {...props} />;
}
