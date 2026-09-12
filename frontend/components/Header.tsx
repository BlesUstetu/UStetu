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
        <a href="/UStetu/" className="home-nav-link" aria-label="Kembali ke halaman utama" title="Home">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V21h13V9.5" />
            <path d="M9.5 21v-6h5v6" />
          </svg>
        </a>
        <a href="/UStetu/seller/" className="seller-nav-link">Seller Center</a>
        <span className="network-pill">Base Sepolia</span>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
      <style jsx global>{`
        .home-nav-link{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;color:inherit;text-decoration:none;opacity:.82;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.035);transition:.2s}
        .home-nav-link svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .home-nav-link:hover{opacity:1;background:rgba(255,255,255,.08);transform:translateY(-1px)}
        .seller-nav-link{font-size:12px;text-decoration:none;color:inherit;opacity:.78;border:1px solid rgba(255,255,255,.1);padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.035);transition:.2s}
        .seller-nav-link:hover{opacity:1;background:rgba(255,255,255,.08)}
      `}</style>
    </header>
  );
}
