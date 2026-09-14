"use client";

import Header from "@/components/Header";
import SellerDashboard from "@/components/SellerDashboard";
import ExpireOrderPanel from "@/components/ExpireOrderPanel";

export default function SellerPage() {
  return (
    <main className="app-shell">
      <Header showSellerOrders />
      <div className="ambient-glow ambient-glow-one" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-two" aria-hidden="true" />
      <SellerDashboard />
      <ExpireOrderPanel />
    </main>
  );
}
