"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { USTETU_ESCROW_ADDRESS, USTETU_REGISTRY_ADDRESS, USTETU_TOKEN_ADDRESS, USDC_BASE_SEPOLIA_ADDRESS } from "@/lib/contracts";

function shorten(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function SystemInfo() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const contractRows = [
    { label: t("registryContract"), address: USTETU_REGISTRY_ADDRESS },
    { label: t("escrowContract"), address: USTETU_ESCROW_ADDRESS },
    { label: t("ustetuTokenContract"), address: USTETU_TOKEN_ADDRESS },
    { label: t("usdcContract"), address: USDC_BASE_SEPOLIA_ADDRESS },
  ];

  return (
    <>
      <button className="system-info-trigger" type="button" onClick={() => setOpen(true)}>
        <span className="system-info-icon">ⓘ</span>
        <span>{t("systemInfo")}</span>
      </button>

      {open && (
        <>
          <button className="system-info-backdrop" aria-label={t("systemClose")} onClick={() => setOpen(false)} />
          <aside className="system-info-panel" role="dialog" aria-modal="true" aria-label={t("systemInfo")}>
            <div className="system-info-glow" aria-hidden="true" />

            <div className="system-info-head">
              <div>
                <span className="eyebrow">USTETU · TRUST CENTER</span>
                <h2>{t("systemInfo")}</h2>
                <p>{t("systemInfoSubtitle")}</p>
              </div>
              <button className="drawer-close" type="button" onClick={() => setOpen(false)}>×</button>
            </div>

            <section className="system-info-hero">
              <div className="system-hero-icon">◎</div>
              <div>
                <h3>{t("trustHeadline")}</h3>
                <p>{t("trustDescription")}</p>
              </div>
            </section>

            <section className="system-feature-grid">
              <div className="system-feature"><span>✓</span><div><strong>{t("transparentTitle")}</strong><p>{t("transparentDesc")}</p></div></div>
              <div className="system-feature"><span>◆</span><div><strong>{t("nonCustodialTitle")}</strong><p>{t("nonCustodialDesc")}</p></div></div>
              <div className="system-feature"><span>⌁</span><div><strong>{t("smartContractTitle")}</strong><p>{t("smartContractDesc")}</p></div></div>
              <div className="system-feature"><span>⇄</span><div><strong>{t("escrowTitle")}</strong><p>{t("escrowDesc")}</p></div></div>
            </section>

            <section className="system-info-card">
              <h3>01 · {t("howUstetuWorks")}</h3>
              <div className="system-architecture-flow">
                {[t("walletNode"), t("blockchainNode"), t("smartContractNode"), t("registryNode"), t("escrowNode")].map((item, index) => (
                  <div className="system-architecture-item" key={item}>
                    <span>{index + 1}</span><strong>{item}</strong>{index < 4 && <b>→</b>}
                  </div>
                ))}
              </div>
              <p className="system-note">{t("architectureDesc")}</p>
            </section>

            <section className="system-info-card">
              <h3>02 · {t("whyTrustUstetu")}</h3>
              <div className="system-rule"><strong>{t("ownershipTitle")}</strong><span>{t("ownershipDesc")}</span></div>
              <div className="system-rule"><strong>{t("verificationTitle")}</strong><span>{t("verificationDesc")}</span></div>
              <div className="system-rule"><strong>{t("securityTitle")}</strong><span>{t("securityDesc")}</span></div>
            </section>

            <section className="system-info-card">
              <h3>03 · {t("simpleFlow")}</h3>
              <div className="system-steps">
                {[t("connectWalletStep"), t("chooseAssetStep"), t("createTradeStep"), t("confirmStep"), t("verifyStep"), t("ownershipStep")].map((step, index) => (
                  <div className="system-step" key={`${step}-${index}`}>
                    <span>{index + 1}</span><strong>{step}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="system-info-card">
              <h3>04 · {t("onChainInfo")}</h3>
              <div className="system-chain-meta">
                <div><span>{t("networkLabel")}</span><strong>Base Sepolia</strong></div>
                <div><span>{t("chainIdLabel")}</span><strong>84532</strong></div>
                <div><span>{t("status")}</span><strong className="approved">● {t("active")}</strong></div>
              </div>
              <div className="system-contract-list">
                {contractRows.map((row) => (
                  <div className="system-contract-row" key={row.label}>
                    <div><span>{row.label}</span><strong>{shorten(row.address)}</strong></div>
                    <a href={`https://sepolia.basescan.org/address/${row.address}`} target="_blank" rel="noreferrer">BaseScan ↗</a>
                  </div>
                ))}
              </div>
              <p className="system-note">{t("onChainNote")}</p>
            </section>

            <section className="system-info-card system-vision-card">
              <h3>05 · {t("visionTitle")}</h3>
              <p className="system-vision-lead">{t("visionLead")}</p>
              <p className="system-note">{t("visionDesc")}</p>
            </section>

            <section className="system-info-warning">
              <strong>{t("beforeTrade")}</strong>
              <p>{t("beforeTradeDesc")}</p>
            </section>

            <div className="system-trust-footer">{t("trustFooter")}</div>
          </aside>
        </>
      )}
    </>
  );
}
