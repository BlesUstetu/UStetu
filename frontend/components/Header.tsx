"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import ThemeLanguageControls from "@/components/ThemeLanguageControls";
import SystemInfo from "@/components/SystemInfo";

export default function Header() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <ThemeLanguageControls />
        <SystemInfo />
      </div>

      <div
        className="brand-block brand-center"
        style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}
      >
        <div className="brand">USTETU</div>
        <div className="tagline">Own What’s Next.</div>
      </div>

      <div className="topbar-right">
        <a href="/UStetu/seller/" className="seller-nav-link">Seller Center</a>
        <span className="network-pill">Base Sepolia</span>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
      <style jsx global>{`
        .seller-nav-link{font-size:12px;text-decoration:none;color:inherit;opacity:.78;border:1px solid rgba(255,255,255,.1);padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.035);transition:.2s}
        .seller-nav-link:hover{opacity:1;background:rgba(255,255,255,.08)}
      `}</style>
    </header>
  );
}
