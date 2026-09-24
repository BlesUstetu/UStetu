"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import ThemeLanguageControls from "@/components/ThemeLanguageControls";
import SystemInfo from "@/components/SystemInfo";

export default function Header({ showSellerOrders = false, showHome = true }: { showSellerOrders?: boolean; showHome?: boolean }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <ThemeLanguageControls />
        <SystemInfo />
      </div>

      <div className="brand-block brand-center">
        <img className="ustetu-logo" src="/UStetu/ustetu-logo.svg" alt="USTETU" />
        <div className="brand-copy">
          <div className="brand"><span className="brand-ust">UST</span><span className="brand-etu">ETU</span></div>
        </div>
      </div>

      <div className="topbar-right">
        {showHome && (
          <a href="/UStetu/" className="home-nav-link" aria-label="Home" title="Home">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5.5 9.5V21h13V9.5" />
              <path d="M9.5 21v-6h5v6" />
            </svg>
          </a>
        )}
        <div className="seller-nav-control">
          <a href="/UStetu/seller/" className="seller-nav-link">
            <span className="seller-nav-icon" aria-hidden="true">◆</span>
            <span>Seller Center</span>
          </a>
        </div>
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

      <style jsx global>{`
        .topbar{position:relative !important}
        .brand-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;text-align:left;pointer-events:none;white-space:nowrap}
        .ustetu-logo{width:27px;height:44px;object-fit:contain;display:block;filter:drop-shadow(0 0 8px rgba(255,100,30,.18))}
        .brand-copy{text-align:center}
        .brand-ust{color:#48a8ff}
        .brand-etu{color:#ff4b5f}
        .home-nav-link,.seller-orders-link{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;color:inherit;text-decoration:none;opacity:.82;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.035);transition:.2s}
        .home-nav-link svg,.seller-orders-link svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .home-nav-link:hover,.seller-orders-link:hover{opacity:1;background:rgba(255,255,255,.08);transform:translateY(-1px)}
        .seller-nav-control{position:relative;isolation:isolate;display:inline-flex;align-items:center;padding:1px;border-radius:12px;overflow:hidden;background:transparent}
        .seller-nav-control::after{content:"";position:absolute;inset:1px;z-index:-1;border-radius:11px;background:rgba(7,11,20,.96);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
        .seller-nav-link{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;font-size:11px;font-weight:700;letter-spacing:.04em;text-decoration:none;color:#f4f8ff;padding:0 11px;border:0;border-radius:11px;background:rgba(7,11,20,.96);transition:transform .2s ease,background .2s ease,box-shadow .2s ease}
        .seller-nav-link:hover{background:rgba(14,21,34,.98);transform:translateY(-1px);box-shadow:0 0 18px rgba(64,180,255,.12)}
        .seller-nav-icon{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;color:#ff4b5f;font-size:9px;line-height:1;text-shadow:0 0 8px rgba(255,75,95,.55)}
        @keyframes ustetu-seller-border-spin{to{transform:rotate(360deg)}}
        .seller-nav-link:hover{opacity:1;background:rgba(255,255,255,.08)}
        .wallet-connect-control{position:relative;isolation:isolate;display:inline-flex;align-items:center;padding:1px;border-radius:12px;overflow:hidden;background:transparent}
        .wallet-connect-control::after{content:"";position:absolute;inset:1px;z-index:-1;border-radius:11px;background:rgba(7,11,20,.96);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
        .ustetu-wallet-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:0 12px;border:0;border-radius:11px;background:rgba(7,11,20,.96);color:#f4f8ff;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.055em;white-space:nowrap;cursor:pointer;transition:transform .2s ease,background .2s ease,box-shadow .2s ease,color .2s ease}
        .ustetu-wallet-button:hover{background:rgba(14,21,34,.98);transform:translateY(-1px);box-shadow:0 0 18px rgba(64,180,255,.12)}
        .ustetu-wallet-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid rgba(72,168,255,.7);border-radius:50%;color:#48a8ff;font-size:9px;line-height:1}
        .ustetu-wallet-connected-icon{color:#45f0a5;border-color:rgba(69,240,165,.7)}
        .ustetu-wallet-label{line-height:1}
        .ustetu-wallet-wrong-network{color:#ffd166}
        .ustetu-wallet-wrong-network .ustetu-wallet-icon{color:#ffd166;border-color:rgba(255,209,102,.75)}
        @keyframes ustetu-wallet-border-spin{to{transform:rotate(360deg)}}
        .topbar-left .system-info-trigger{order:-1}
        @media(max-width:760px){
          .brand-center{gap:5px}
          .ustetu-logo{width:19px;height:32px}
          .brand{font-size:13px}
          .tagline{font-size:8px}
          .seller-nav-link{min-height:32px;font-size:10px;padding:0 9px;gap:5px}
          .seller-nav-icon{width:14px;height:14px;font-size:8px}
          .home-nav-link,.seller-orders-link{width:32px;height:32px}
          .home-nav-link svg,.seller-orders-link svg{width:16px;height:16px}
          .ustetu-wallet-button{min-height:32px;padding:0 9px;gap:5px;font-size:10px;letter-spacing:.04em}
          .ustetu-wallet-icon{width:14px;height:14px;font-size:8px}
        }
        @media(max-width:430px){
          .ustetu-wallet-button{padding:0 7px;font-size:9px}
          .ustetu-wallet-label{max-width:82px;overflow:hidden;text-overflow:ellipsis}
        }
        @media(max-width:360px){
          .ustetu-wallet-label{max-width:64px}
        }
        @media(max-width:520px){
          .topbar-left .system-info-trigger{order:2}
          .topbar{
            display:grid !important;
            grid-template-columns:minmax(0,1fr) auto;
            grid-template-rows:auto auto;
            row-gap:7px;
          }
          .brand-center{
            position:static !important;
            grid-column:1;
            grid-row:1;
            display:flex !important;
            align-items:center;
            justify-content:flex-start;
            gap:6px;
            transform:none !important;
            margin:0 !important;
            min-width:0;
            width:max-content;
            max-width:100%;
            visibility:visible !important;
            opacity:1 !important;
            z-index:2;
          }
          .ustetu-logo{width:20px;height:30px}
          .brand-copy{display:block !important;text-align:left}
          .brand{display:block !important;font-size:14px;letter-spacing:.1em}
          .tagline{display:none !important}
          .topbar-left{grid-column:2;grid-row:1}
          .topbar-right{
            grid-column:1 / -1;
            grid-row:2;
            width:100%;
            max-width:none !important;
            justify-content:center;
            overflow:visible;
            gap:7px;
          }
          .brand-center + .topbar-right{position:relative}
          .brand-center .brand-copy{flex:0 0 auto}
          .topbar-right > *{max-width:none !important}
          .seller-nav-link{
            min-height:32px;
            padding:0 11px;
            font-size:10px;
            letter-spacing:.035em;
          }
          .seller-nav-icon{width:14px;height:14px}
          .ustetu-wallet-button{
            min-height:32px;
            padding:0 11px;
            font-size:10px;
            letter-spacing:.035em;
          }
          .ustetu-wallet-label{max-width:none !important;overflow:visible;text-overflow:clip}
          .wallet-connect-control{overflow:visible}
        }
      `}</style>
    </header>
  );
}
