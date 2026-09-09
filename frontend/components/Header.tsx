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

      <div className="brand-block brand-center">
        <div className="brand">USTETU</div>
        <div className="tagline">Own What’s Next.</div>
      </div>

      <div className="topbar-right">
        <span className="network-pill">Base Sepolia</span>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
    </header>
  );
}
