"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import ThemeLanguageControls from "@/components/ThemeLanguageControls";
import SystemInfo from "@/components/SystemInfo";

export default function Header({ showSellerOrders = false }: { showSellerOrders?: boolean }) {
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
        {showSellerOrders && (
          <a href="/UStetu/seller/orders/" className="seller-orders-link" aria-label="Orders" title="Orders">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 3.5h6" />
              <path d="m8.5 9 1.5 1.5L12.5 8" />
              <path d="M13.5 9H16" />
              <path d="m8.5 14 1.5 1.5 2.5-2.5" />
              <path d="M13.5 14H16" />
            </svg>
          </a>
        )}
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
      <style jsx global>{`
        .home-nav-link,.seller-orders-link{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;color:inherit;text-decoration:none;opacity:.82;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.035);transition:.2s}
        .home-nav-link svg,.seller-orders-link svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .home-nav-link:hover,.seller-orders-link:hover{opacity:1;background:rgba(255,255,255,.08);transform:translateY(-1px)}
        .seller-nav-link{font-size:12px;text-decoration:none;color:inherit;opacity:.78;border:1px solid rgba(255,255,255,.1);padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.035);transition:.2s}
        .seller-nav-link:hover{opacity:1;background:rgba(255,255,255,.08)}
        @media(max-width:760px){
          .seller-nav-link{font-size:11px;padding:7px 9px}
          .home-nav-link,.seller-orders-link{width:32px;height:32px}
          .home-nav-link svg,.seller-orders-link svg{width:16px;height:16px}
        }
      `}</style>
    </header>
  );
}
