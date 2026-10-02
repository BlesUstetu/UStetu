"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ThemeLanguageControls from "@/components/ThemeLanguageControls";
import SystemInfo from "@/components/SystemInfo";

export default function Header({ showSellerOrders = false, showHome = true, showSellerCenter = true }: { showSellerOrders?: boolean; showHome?: boolean; showSellerCenter?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="ustetu-header-brand">
        <a href="/UStetu/" aria-label="USTETU Home" className="ustetu-header-brand-link">
          <img className="ustetu-logo" src="/UStetu/ustetu-logo.svg" alt="USTETU" />
          <div className="brand-copy">
            <div className="brand"><span className="brand-ust">UST</span><span className="brand-etu">ETU</span></div>
          </div>
        </a>
      </div>

      <div className="ustetu-header-actions">
        <button
          type="button"
          className={`ustetu-menu-button${menuOpen ? " is-open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="wallet-connect-control">
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
                  })}
                >
                  {!connected ? (
                    <button type="button" className="ustetu-wallet-button" onClick={openConnectModal}>
                      <span className="ustetu-wallet-icon" aria-hidden="true">◉</span>
                      <span className="ustetu-wallet-label">CONNECT WALLET</span>
                    </button>
                  ) : chain.unsupported ? (
                    <button type="button" className="ustetu-wallet-button ustetu-wallet-wrong-network" onClick={openChainModal}>
                      <span className="ustetu-wallet-icon" aria-hidden="true">!</span>
                      <span className="ustetu-wallet-label">WRONG NETWORK</span>
                    </button>
                  ) : (
                    <button type="button" className="ustetu-wallet-button ustetu-wallet-connected" onClick={openAccountModal}>
                      <span className="ustetu-wallet-icon ustetu-wallet-connected-icon" aria-hidden="true">◉</span>
                      <span className="ustetu-wallet-label">{account.displayName}</span>
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {menuOpen && (
        <>
          <button type="button" className="ustetu-menu-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="ustetu-header-menu">
            <div className="ustetu-header-menu-head">
              <button type="button" className="ustetu-menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>×</button>
            </div>

            <div className="ustetu-header-menu-tools">
              <ThemeLanguageControls />
              <SystemInfo />
            </div>

            <nav className="ustetu-header-menu-nav" aria-label="USTETU navigation">
              {showHome && (
                <a href="/UStetu/" className="ustetu-header-menu-link" onClick={() => setMenuOpen(false)}>
                  <span className="ustetu-header-menu-icon">⌂</span>
                  <span>Home</span>
                </a>
              )}
              {showSellerCenter && (
                <a href="/UStetu/seller/" className="ustetu-header-menu-link" onClick={() => setMenuOpen(false)}>
                  <span className="ustetu-header-menu-icon">◆</span>
                  <span>Seller Center</span>
                </a>
              )}
              {showSellerOrders && (
                <a href="/UStetu/seller/orders/" className="ustetu-header-menu-link" onClick={() => setMenuOpen(false)}>
                  <span className="ustetu-header-menu-icon">▣</span>
                  <span>Orders</span>
                </a>
              )}
            </nav>
          </div>
        </>
      )}

      <style jsx global>{`
        .topbar{position:sticky !important;top:0;z-index:100 !important;background:transparent !important;border:0 !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;padding-top:6px;padding-bottom:6px}
        html[data-theme="dark"] .topbar{background:transparent !important;border:0 !important;box-shadow:none !important}

        .ustetu-header-brand{display:flex;align-items:center;min-width:0}
        .ustetu-header-brand-link{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:inherit}
        .ustetu-header-brand-link .ustetu-logo{width:27px;height:44px;object-fit:contain;display:block}
        .ustetu-header-brand-link .brand-copy{text-align:left}
        .ustetu-header-brand-link .brand-ust{color:#48a8ff}
        .ustetu-header-brand-link .brand-etu{color:#ff4b5f}
        .ustetu-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;margin-left:auto}
        .ustetu-menu-button{position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:38px;height:38px;padding:0;border:1px solid transparent;border-radius:11px;background:linear-gradient(145deg,rgba(10,20,38,.94),rgba(8,12,25,.98)) padding-box,linear-gradient(135deg,rgba(72,210,255,.58),rgba(105,92,255,.52),rgba(235,86,255,.34)) border-box;color:#dff7ff;cursor:pointer;box-shadow:0 0 16px rgba(72,168,255,.07),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
        .ustetu-menu-button span{display:block;width:15px;height:1.5px;border-radius:999px;background:currentColor;transition:transform .18s ease,opacity .18s ease,width .18s ease}
        .ustetu-menu-button:hover,.ustetu-menu-button.is-open{transform:translateY(-1px);background:linear-gradient(145deg,rgba(12,25,48,.98),rgba(10,14,31,.98)) padding-box,linear-gradient(135deg,rgba(72,210,255,.82),rgba(105,92,255,.72),rgba(235,86,255,.50)) border-box;box-shadow:0 0 22px rgba(72,168,255,.13),inset 0 1px 0 rgba(255,255,255,.08)}
        .ustetu-menu-button.is-open span:nth-child(1){transform:translateY(5.5px) rotate(45deg)}
        .ustetu-menu-button.is-open span:nth-child(2){opacity:0;width:0}
        .ustetu-menu-button.is-open span:nth-child(3){transform:translateY(-5.5px) rotate(-45deg)}
        .ustetu-header-menu{position:absolute;z-index:80;top:calc(100% + 8px);right:13px;width:min(310px,calc(100vw - 28px));padding:10px;border:1px solid transparent;border-radius:18px;background:linear-gradient(145deg,rgba(7,14,29,.985),rgba(8,12,25,.985)) padding-box,linear-gradient(135deg,rgba(72,210,255,.46),rgba(105,92,255,.40),rgba(235,86,255,.24)) border-box;box-shadow:0 24px 70px rgba(0,0,0,.52),0 0 28px rgba(54,130,255,.08),inset 0 1px rgba(255,255,255,.06);backdrop-filter:blur(24px) saturate(135%);-webkit-backdrop-filter:blur(24px) saturate(135%)}
        .ustetu-menu-backdrop{position:fixed;z-index:70;inset:0;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:default}
        .ustetu-header-menu-head{display:flex;align-items:center;justify-content:flex-end;min-height:27px;padding:0 0 7px}
        .ustetu-menu-close{display:grid;width:27px;height:27px;place-items:center;padding:0;border:1px solid rgba(139,183,232,.14);border-radius:8px;background:rgba(255,255,255,.025);color:#b9c9dc;font-size:18px;line-height:1;cursor:pointer}
        .ustetu-menu-close:hover{background:rgba(139,183,232,.08);color:#fff}
        .ustetu-header-menu-tools{display:flex;align-items:center;gap:7px;padding:9px 1px;border-top:1px solid rgba(139,183,232,.10);border-bottom:1px solid rgba(139,183,232,.10)}
        .ustetu-header-menu-tools .system-info-trigger{margin-left:auto}
        .ustetu-header-menu-nav{display:grid;gap:6px;padding-top:10px}
        .ustetu-header-menu-link{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 11px;border:1px solid transparent;border-radius:10px;background:linear-gradient(145deg,rgba(10,20,38,.72),rgba(8,12,25,.82)) padding-box,linear-gradient(135deg,rgba(72,210,255,.18),rgba(105,92,255,.18),rgba(235,86,255,.10)) border-box;color:#dcecff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.035em;transition:transform .16s ease,background .16s ease}
        .ustetu-header-menu-link:hover{transform:translateX(2px);background:linear-gradient(145deg,rgba(12,25,48,.92),rgba(10,14,31,.94)) padding-box,linear-gradient(135deg,rgba(72,210,255,.42),rgba(105,92,255,.34),rgba(235,86,255,.22)) border-box}
        .ustetu-header-menu-icon{display:inline-flex;width:18px;justify-content:center;color:#8ff6ff;text-shadow:0 0 8px rgba(72,210,255,.55)}
        .wallet-connect-control{display:inline-flex;align-items:center}
        .ustetu-wallet-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 12px;border:1px solid transparent;border-radius:11px;background:linear-gradient(145deg,rgba(10,20,38,.96),rgba(8,12,25,.98)) padding-box,linear-gradient(135deg,rgba(72,210,255,.72),rgba(105,92,255,.64),rgba(235,86,255,.50)) border-box;color:#f4f8ff;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.055em;white-space:nowrap;cursor:pointer;box-shadow:0 0 18px rgba(72,168,255,.10),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .2s ease,background .2s ease,box-shadow .2s ease,color .2s ease}
        .ustetu-wallet-button:hover{background:linear-gradient(145deg,rgba(12,25,48,.98),rgba(10,14,31,.98)) padding-box,linear-gradient(135deg,rgba(72,210,255,.90),rgba(105,92,255,.78),rgba(235,86,255,.64)) border-box;transform:translateY(-1px);box-shadow:0 0 24px rgba(72,168,255,.16),0 0 36px rgba(105,92,255,.08),inset 0 1px 0 rgba(255,255,255,.10)}
        .ustetu-wallet-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid rgba(72,210,255,.72);border-radius:50%;color:#8ff6ff;font-size:9px;line-height:1;text-shadow:0 0 8px rgba(72,210,255,.60)}
        .ustetu-wallet-connected-icon{color:#45f0a5;border-color:rgba(69,240,165,.7)}
        .ustetu-wallet-label{line-height:1}
        .ustetu-wallet-wrong-network{color:#ffd166}
        .ustetu-wallet-wrong-network .ustetu-wallet-icon{color:#ffd166;border-color:rgba(255,209,102,.75)}
        @media(min-width:761px){.topbar{width:min(1440px,calc(100% - 64px)) !important;box-sizing:border-box;padding-left:15px}.topbar-left,.topbar-right{display:none !important}}
        @media(max-width:760px){.ustetu-header-brand-link .ustetu-logo{width:22px;height:34px}.ustetu-header-brand-link .brand{font-size:14px;letter-spacing:.14em}.ustetu-menu-button{width:35px;height:35px}.ustetu-wallet-button{min-height:35px;padding:0 9px;font-size:10px}.ustetu-wallet-icon{width:15px;height:15px;font-size:8px}}
        @media(max-width:430px){.topbar{padding:8px 9px}.ustetu-header-brand-link .ustetu-logo{width:20px;height:31px}.ustetu-header-brand-link .brand{font-size:13px}.ustetu-header-actions{gap:6px}.ustetu-wallet-button{padding:0 8px;font-size:9px}.ustetu-wallet-label{max-width:82px;overflow:hidden;text-overflow:ellipsis}.ustetu-header-menu{right:9px;width:min(310px,calc(100vw - 18px))}}
      `}</style>
    </header>
  );
}