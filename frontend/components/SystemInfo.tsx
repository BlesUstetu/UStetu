"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

export default function SystemInfo() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

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
                <span className="eyebrow">USTETU</span>
                <h2>{t("systemInfo")}</h2>
                <p>{t("systemInfoSubtitle")}</p>
              </div>
              <button className="drawer-close" type="button" onClick={() => setOpen(false)}>×</button>
            </div>

            <section className="system-info-card">
              <h3>01 · {t("howToBuy")}</h3>
              <div className="system-steps">
                {[t("chooseToken"), t("enterAmount"), t("createOrder"), t("approveUsdc"), t("payment"), t("complete"), t("tokenToWallet")].map((step, index) => (
                  <div className="system-step" key={`${step}-${index}`}>
                    <span>{index === 6 ? "✓" : index + 1}</span><strong>{step}</strong>
                  </div>
                ))}
              </div>
              <p className="system-note">{t("approvalNote")}</p>
            </section>

            <section className="system-info-card">
              <h3>02 · {t("escrowProtection")}</h3>
              <div className="system-rule"><strong>{t("paymentWindow")}</strong><span>{t("paymentWindowDesc")}</span></div>
              <div className="system-rule"><strong>{t("autoRelease")}</strong><span>{t("autoReleaseDesc")}</span></div>
            </section>

            <section className="system-info-card">
              <h3>03 · {t("howToSell")}</h3>
              <div className="system-sell-flow">{[t("deposit"), t("createListing"), t("buyerOrder"), t("locked"), t("payment"), t("complete"), t("receiveUsdc")].map((item, index) => <span key={item}>{item}{index < 6 ? " → " : ""}</span>)}</div>
              <p className="system-note">{t("sellerFlow")}</p>
            </section>

            <section className="system-info-warning">
              <strong>{t("beforeTrade")}</strong>
              <p>{t("beforeTradeDesc")}</p>
            </section>
          </aside>
        </>
      )}
    </>
  );
}
