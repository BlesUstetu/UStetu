"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import ThemeLanguageControls from "@/components/ThemeLanguageControls";

export default function Header() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <ThemeLanguageControls />
        <div className="brand-block">
          <div className="brand">USTETU</div>
          <div className="tagline">Own What’s Next.</div>
        </div>
      </div>

      <div className="topbar-right">
        <span className="network-pill">Base Sepolia</span>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
    </header>
  );
}
