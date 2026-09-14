"use client";

import BuyModal from "@/components/BuyModal";

type Props = React.ComponentProps<typeof BuyModal>;

/**
 * BuyModalFlow is intentionally a presentation-free wrapper.
 *
 * Order expiry is a protocol/system event. It must not create a second
 * overlay, release screen, recovery button, or bottom notification over
 * the normal BuyModal. BuyModal remains the single buyer-facing UI.
 *
 * The actual order/expiry handling stays in BuyModal and on-chain in the
 * escrow contract/keeper flow.
 */
export default function BuyModalFlow(props: Props) {
  return <BuyModal {...props} />;
}
