"use client";

import Header from "@/components/Header";
import SellerOrders from "@/components/SellerOrders";

export default function SellerOrdersPage() {
  return (
    <main className="app-shell">
      <Header />
      <div className="ambient-glow ambient-glow-one" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-two" aria-hidden="true" />
      <SellerOrders />
    </main>
  );
}
