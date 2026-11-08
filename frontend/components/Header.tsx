"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ThemeLanguageControls from "@/components/ThemeLanguageControls";
import SystemInfo from "@/components/SystemInfo";

const DEPLOY_BASE = process.env.NEXT_DEPLOY_TARGET === "github-pages" ? "/UStetu" : "";

export default function Header({ showSellerOrders = false, showHome = true, showSellerCenter = true }: { showSellerOrders?: boolean; showHome?: boolean; showSellerCenter?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="ustetu-header-brand">
        <a href={`${DEPLOY_BASE}/`} aria-label="USTETU Home" className="ustetu-header-brand-link">
          <img className="ustetu-logo" src={`${DEPLOY_BASE}/ustetu-logo.png`} alt="USTETU" />
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
                      <span className="ustetu-wallet-icon ustetu-wallet-outline" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 8h13.5A2.5 2.5 0 0 1 20 10.5v3a2.5 2.5 0 0 1-2.5 2.5H16"/><path d="M16 12h.01"/></svg></span>
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
              <span className="ustetu-header-menu-title">QUICK MENU</span>
            </div>

            <section className="ustetu-header-menu-section" aria-label="Preferences">
              <span className="ustetu-header-menu-section-label">PREFERENCES</span>
              <div className="ustetu-header-menu-tools">
                <ThemeLanguageControls />
              </div>
            </section>

            <section className="ustetu-header-menu-section" aria-label="Information">
              <span className="ustetu-header-menu-section-label">INFORMATION</span>
              <div className="ustetu-header-menu-center">
                <SystemInfo />
              </div>
            </section>

            <nav className="ustetu-header-menu-nav" aria-label="USTETU navigation">
              <span className="ustetu-header-menu-section-label">NAVIGATION</span>
              {showHome && (
                <a href={`${DEPLOY_BASE}/`} className="ustetu-header-menu-link" onClick={() => setMenuOpen(false)}>
                  <span className="ustetu-header-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3.5 10 8.5-7 8.5 7v10a1 1 0 0 1-1 1h-5.5v-7h-4v7H4.5a1 1 0 0 1-1-1z"/></svg></span>
                  <span>Home</span>
                </a>
              )}
              {showSellerCenter && (
                <a href={`${DEPLOY_BASE}/seller/`} className="ustetu-header-menu-link" onClick={() => setMenuOpen(false)}>
                  <span className="ustetu-header-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 9 4.5 4h15L21 9"/><path d="M4 9v11h16V9M3 9h18M9 20v-7h6v7"/></svg></span>
                  <span>Seller Center</span>
                </a>
              )}
              {showSellerOrders && (
                <a href={`${DEPLOY_BASE}/seller/orders/`} className="ustetu-header-menu-link" onClick={() => setMenuOpen(false)}>
                  <span className="ustetu-header-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg></span>
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
        .ustetu-header-menu{position:absolute;z-index:80;top:calc(100% + 8px);right:13px;width:min(326px,calc(100vw - 28px));padding:12px;border:1px solid transparent;border-radius:18px;background:linear-gradient(145deg,rgba(7,14,29,.985),rgba(8,12,25,.985)) padding-box,linear-gradient(135deg,rgba(72,210,255,.46),rgba(105,92,255,.40),rgba(235,86,255,.24)) border-box;box-shadow:0 24px 70px rgba(0,0,0,.52),0 0 28px rgba(54,130,255,.08),inset 0 1px rgba(255,255,255,.06);backdrop-filter:blur(24px) saturate(135%);-webkit-backdrop-filter:blur(24px) saturate(135%)}
        .ustetu-menu-backdrop{position:fixed;z-index:70;inset:0;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:default}
        .ustetu-header-menu-head{display:flex;align-items:center;justify-content:space-between;min-height:30px;padding:0 1px 9px;border-bottom:1px solid rgba(139,183,232,.10)}
        .ustetu-header-menu-title{color:#8fa8c2;font-size:9px;font-weight:800;letter-spacing:.16em}
        .ustetu-header-menu-section{display:grid;gap:7px;padding:11px 1px;border-bottom:1px solid rgba(139,183,232,.10)}
        .ustetu-header-menu-section-label{display:block;color:#7189a4;font-size:8px;font-weight:800;letter-spacing:.15em}
        .ustetu-menu-close{display:grid;width:27px;height:27px;place-items:center;padding:0;border:1px solid rgba(139,183,232,.14);border-radius:8px;background:rgba(255,255,255,.025);color:#b9c9dc;font-size:18px;line-height:1;cursor:pointer}
        .ustetu-menu-close:hover{background:rgba(139,183,232,.08);color:#fff}
        .ustetu-header-menu-tools{display:flex;align-items:center;width:100%;padding:0}
        .ustetu-header-menu-tools .header-controls{display:grid;grid-template-columns:minmax(0,1fr) 42px;align-items:center;gap:8px;width:100%}
        .ustetu-header-menu-tools .language-control{width:100%;min-width:0}
        .ustetu-header-menu-tools .language-trigger{width:100%;min-height:38px;justify-content:flex-start;padding:0 11px}
        .ustetu-header-menu-tools .icon-button{width:42px;height:38px;min-width:42px}
        .ustetu-header-menu-center .system-info-trigger{display:flex;width:100%;min-height:40px;justify-content:flex-start;gap:10px;margin:0;padding:0 11px;border:1px solid rgba(72,210,255,.18);border-radius:10px;background:linear-gradient(145deg,rgba(10,20,38,.82),rgba(8,12,25,.92));color:#dcecff;font-size:12px;font-weight:650;letter-spacing:.02em;box-shadow:none}
        .ustetu-header-menu-center .system-info-trigger:hover{border-color:rgba(72,210,255,.42);background:rgba(14,32,52,.96)}\n        .ustetu-header-menu-center .system-info-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;width:22px;height:22px;border:1px solid rgba(72,210,255,.35);border-radius:7px;color:#8ff6ff;font-size:13px;line-height:1;text-shadow:none}
        .ustetu-header-menu-nav{display:grid;gap:6px;padding-top:11px}
        .ustetu-header-menu-link{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 11px;border:1px solid transparent;border-radius:10px;background:linear-gradient(145deg,rgba(10,20,38,.72),rgba(8,12,25,.82)) padding-box,linear-gradient(135deg,rgba(72,210,255,.18),rgba(105,92,255,.18),rgba(235,86,255,.10)) border-box;color:#dcecff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.035em;transition:transform .16s ease,background .16s ease}
        .ustetu-header-menu-link:hover{transform:translateX(2px);background:linear-gradient(145deg,rgba(12,25,48,.92),rgba(10,14,31,.94)) padding-box,linear-gradient(135deg,rgba(72,210,255,.42),rgba(105,92,255,.34),rgba(235,86,255,.22)) border-box}
        .ustetu-header-menu-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;width:22px;height:22px;color:#8ff6ff}.ustetu-header-menu-icon svg{display:block;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        .wallet-connect-control{display:inline-flex;align-items:center}
        .ustetu-wallet-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 12px;border:1px solid transparent;border-radius:11px;background:linear-gradient(145deg,rgba(10,20,38,.96),rgba(8,12,25,.98)) padding-box,linear-gradient(135deg,rgba(72,210,255,.72),rgba(105,92,255,.64),rgba(235,86,255,.50)) border-box;color:#f4f8ff;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.055em;white-space:nowrap;cursor:pointer;box-shadow:0 0 18px rgba(72,168,255,.10),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .2s ease,background .2s ease,box-shadow .2s ease,color .2s ease}
        .ustetu-wallet-button:hover{background:linear-gradient(145deg,rgba(12,25,48,.98),rgba(10,14,31,.98)) padding-box,linear-gradient(135deg,rgba(72,210,255,.90),rgba(105,92,255,.78),rgba(235,86,255,.64)) border-box;transform:translateY(-1px);box-shadow:0 0 24px rgba(72,168,255,.16),0 0 36px rgba(105,92,255,.08),inset 0 1px 0 rgba(255,255,255,.10)}
        .ustetu-wallet-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid rgba(72,210,255,.72);border-radius:50%;color:#8ff6ff;font-size:9px;line-height:1;text-shadow:0 0 8px rgba(72,210,255,.60)}
        .ustetu-wallet-connected-icon{color:#45f0a5;border-color:rgba(69,240,165,.7)}
        .ustetu-wallet-outline{border:0 !important;border-radius:0 !important;width:18px;height:18px;color:#8ff6ff;background:transparent !important;box-shadow:none !important}
        .ustetu-wallet-outline svg{display:block !important;width:18px;height:18px;fill:none !important;stroke:currentColor !important;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
        .ustetu-wallet-label{line-height:1}
        .ustetu-wallet-wrong-network{color:#ffd166}
        .ustetu-wallet-wrong-network .ustetu-wallet-icon{color:#ffd166;border-color:rgba(255,209,102,.75)}
        @media(min-width:761px){.topbar{width:min(1440px,calc(100% - 64px)) !important;box-sizing:border-box;padding-left:15px}.topbar-left,.topbar-right{display:none !important}}
        @media(max-width:760px){.ustetu-header-brand{display:flex;align-items:center;flex:0 1 auto;min-width:0}.ustetu-header-brand-link{gap:5px}.ustetu-header-brand-link .ustetu-logo{width:23px;height:34px}.ustetu-header-brand-link .brand{font-size:14px;letter-spacing:.12em}.ustetu-header-actions{margin-left:auto;gap:6px}.ustetu-menu-button{width:35px;height:35px;flex:0 0 auto}.ustetu-wallet-button{min-height:35px;padding:0 9px;font-size:10px;flex:0 0 auto}.ustetu-wallet-icon{width:15px;height:15px;font-size:8px}.ustetu-wallet-outline{width:17px;height:17px}.ustetu-wallet-outline svg{width:17px;height:17px}}
        @media(max-width:430px){.topbar{padding:8px 9px}.ustetu-header-brand-link .ustetu-logo{width:20px;height:31px}.ustetu-header-brand-link .brand{font-size:13px}.ustetu-header-actions{gap:6px}.ustetu-wallet-button{padding:0 8px;font-size:9px}.ustetu-wallet-label{max-width:82px;overflow:hidden;text-overflow:ellipsis}.ustetu-header-menu{right:9px;width:min(326px,calc(100vw - 18px))}}

        /* Normalize menu typography for phone-sized screens. */
        @media(max-width:600px){
          .ustetu-header-menu{font-family:inherit;font-size:14px;line-height:1.45}
          .ustetu-header-menu-title{font-size:10px;line-height:1.4;letter-spacing:.12em}
          .ustetu-header-menu-section-label{font-size:9px;line-height:1.4;letter-spacing:.12em}
          .ustetu-header-menu-link{font-size:13px;line-height:1.35;font-weight:600;letter-spacing:0}
          .ustetu-header-menu-icon{font-size:14px;line-height:1}
          .ustetu-header-menu-tools .language-trigger{font-size:12px;line-height:1.3}
          .ustetu-header-menu-tools .language-option{font-size:12px;line-height:1.4}
          .ustetu-header-menu-tools .language-option small{font-size:10px;line-height:1.35}
          .ustetu-header-menu-center .system-info-trigger{font-size:12px;line-height:1.35;letter-spacing:0}
          .ustetu-menu-close{font-size:20px;line-height:1}
        }
        @media(max-width:360px){
          .ustetu-header-menu{font-size:13px}
          .ustetu-header-menu-link{font-size:12px}
          .ustetu-header-menu-section-label{font-size:8px}
        }
        @media(max-width:600px){
          .topbar{position:sticky !important;isolation:isolate;min-height:54px;gap:8px}
          .ustetu-header-menu{top:calc(100% + 6px);right:8px;width:min(360px,calc(100vw - 16px));max-height:calc(100dvh - 76px);overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;padding:11px;border-radius:15px}
          .ustetu-header-menu-head{min-height:28px;padding-bottom:8px}
          .ustetu-header-menu-section{gap:6px;padding:9px 1px}
          .ustetu-header-menu-tools .header-controls{grid-template-columns:minmax(0,1fr) 40px;gap:7px}
          .ustetu-header-menu-tools .language-trigger{min-height:40px;padding:0 10px}
          .ustetu-header-menu-tools .icon-button{width:40px;height:40px;min-width:40px}
          .ustetu-header-menu-center .system-info-trigger{min-height:42px}
          .ustetu-header-menu-nav{gap:7px;padding-top:10px}
          .ustetu-header-menu-link{min-height:43px;padding:0 12px;font-size:12px}
          .ustetu-header-menu-icon{width:22px;flex-basis:22px}.ustetu-header-menu-icon svg{width:18px;height:18px}
        }
        @media(max-width:360px){
          .ustetu-header-menu{right:6px;width:calc(100vw - 12px);padding:9px}
          .ustetu-header-menu-section{padding:8px 1px}
          .ustetu-header-menu-link{min-height:41px}
        }
        
        /* Mobile menu corrections: one close control, visible Center label, balanced header. */
        @media(max-width:600px){
          .ustetu-header-menu-head{justify-content:flex-start;min-height:25px}
          .ustetu-menu-close{display:none !important}
          .ustetu-header-menu-center .system-info-trigger{font-size:12px !important;letter-spacing:.02em !important;justify-content:flex-start !important;gap:9px !important;padding:0 11px !important}
          .ustetu-header-menu-center .system-info-trigger>span:last-child{display:inline-flex !important;align-items:center;font-size:12px !important;line-height:1.3 !important}
          .ustetu-header-menu-center .system-info-trigger .system-info-icon{font-size:14px !important;flex:0 0 auto}
          .ustetu-header-menu-tools .header-controls{grid-template-columns:minmax(0,1fr) 40px;max-width:100%}
          .ustetu-header-menu-tools .language-control{min-width:0}
          .ustetu-header-menu-tools .language-trigger{box-sizing:border-box}
          .ustetu-header-menu{left:8px;right:8px;width:auto;max-width:none}
          .ustetu-wallet-label{max-width:none !important;overflow:visible !important;text-overflow:clip !important}
          .ustetu-wallet-button{padding-left:9px;padding-right:9px;font-size:9px;letter-spacing:.025em}
          .ustetu-header-actions{gap:6px}
        }
        @media(max-width:360px){
          .ustetu-header-menu{left:6px;right:6px}
          .ustetu-wallet-button{gap:5px;padding-left:7px;padding-right:7px;font-size:8px}.ustetu-wallet-outline{width:16px;height:16px}.ustetu-wallet-outline svg{width:16px;height:16px}
        }

        /* Header menu theme parity: keep the same hierarchy in dark and light modes. */
        html[data-theme="light"] .ustetu-header-menu{
          background:linear-gradient(145deg,rgba(250,253,255,.985),rgba(238,245,252,.985)) padding-box,
            linear-gradient(135deg,rgba(24,160,205,.52),rgba(105,92,210,.38),rgba(190,86,190,.22)) border-box;
          box-shadow:0 20px 54px rgba(32,55,82,.18),0 0 24px rgba(54,130,190,.07),inset 0 1px rgba(255,255,255,.92);
        }
        html[data-theme="light"] .ustetu-header-menu-title{color:#52677f}
        html[data-theme="light"] .ustetu-header-menu-section-label{color:#657b94}
        html[data-theme="light"] .ustetu-header-menu-section{border-bottom-color:rgba(48,76,108,.13)}
        html[data-theme="light"] .ustetu-header-menu-link{
          background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(239,245,251,.96)) padding-box,
            linear-gradient(135deg,rgba(24,160,205,.25),rgba(105,92,210,.18)) border-box;
          color:#20334a;
        }
        html[data-theme="light"] .ustetu-header-menu-link:hover{
          background:linear-gradient(145deg,#fff,#eaf3fb) padding-box,
            linear-gradient(135deg,rgba(24,160,205,.48),rgba(105,92,210,.34)) border-box;
        }
        html[data-theme="light"] .ustetu-header-menu-icon{color:#147fa5}
        html[data-theme="light"] .ustetu-header-menu-center .system-info-trigger{
          background:linear-gradient(145deg,#fff,#edf4fa);
          color:#20334a;border-color:rgba(24,145,190,.25);
        }
        html[data-theme="light"] .ustetu-header-menu-center .system-info-icon{
          color:#147fa5;border-color:rgba(24,145,190,.32);
        }
        html[data-theme="light"] .ustetu-header-menu-tools .icon-button{
          background:linear-gradient(145deg,#fff,#edf3f9) padding-box,
            linear-gradient(135deg,rgba(24,160,205,.42),rgba(105,92,210,.28)) border-box;
          color:#344b64;box-shadow:0 2px 8px rgba(32,55,82,.08);
        }
        html[data-theme="light"] .ustetu-header-menu-tools .language-control{
          background:linear-gradient(145deg,#fff,#edf3f9) padding-box,
            linear-gradient(135deg,rgba(24,160,205,.48),rgba(105,92,210,.30)) border-box !important;
          box-shadow:0 2px 8px rgba(32,55,82,.08) !important;
        }
        html[data-theme="light"] .ustetu-header-menu-tools .language-trigger{color:#263c54 !important}
        html[data-theme="light"] .ustetu-header-menu-tools .language-globe{color:#147fa5 !important;text-shadow:none !important}
        html[data-theme="light"] .ustetu-header-menu-tools .language-chevron{color:#627a94}
        html[data-theme="light"] .ustetu-header-menu-tools .language-options{
          background:rgba(250,253,255,.98) !important;border-color:rgba(48,76,108,.16) !important;
          box-shadow:0 12px 30px rgba(32,55,82,.16) !important;
        }
        html[data-theme="light"] .ustetu-header-menu-tools .language-option{color:#344b64}
        html[data-theme="light"] .ustetu-header-menu-tools .language-option:hover,
        html[data-theme="light"] .ustetu-header-menu-tools .language-option.is-active{background:#e8f1f9;color:#152b43}
        html[data-theme="light"] .ustetu-header-menu-tools .language-option small{color:#657b94}
      `}
      </style>
    </header>
  );
}