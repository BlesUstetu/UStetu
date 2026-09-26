"use client";

import { useMemo, useState } from "react";
import { getAddress, isAddress } from "viem";
import { USTETU_TOKEN_ADDRESS } from "@/lib/contracts";

type TokenLogoProps = {
  address?: string;
  chainId?: number;
  symbol?: string;
  name?: string;
  size?: number;
  className?: string;
};

const CHAIN_PATHS: Record<number, string> = {
  1: "ethereum",
  56: "smartchain",
  137: "polygon",
  250: "fantom",
  42161: "arbitrum",
  43114: "avalanchec",
  42220: "celo",
  10: "optimism",
  8453: "base",
  59144: "linea",
  324: "zksync",
  534352: "scroll",
  81457: "blast",
  5000: "mantle",
  204: "opbnb",
  100: "xdai",
};

const firstLetter = (name?: string, symbol?: string) =>
  (symbol?.trim() || name?.trim() || "?").charAt(0).toUpperCase();

export default function TokenLogo({ address, chainId, symbol, name, size = 38, className = "" }: TokenLogoProps) {
  const [failed, setFailed] = useState(false);

  const logoUrl = useMemo(() => {
    if (!address || !isAddress(address) || !chainId) return "";

    // USTETU has a first-party logo in the deployed frontend.
    // Use it before third-party token-logo repositories so the official
    // USTETU logo is available even when Trust Wallet Assets has no entry.
    if (address.toLowerCase() === USTETU_TOKEN_ADDRESS.toLowerCase() && chainId === 8453) {
      return "/UStetu/ustetu-logo-32.svg";
    }

    const chain = CHAIN_PATHS[chainId];
    if (!chain) return "";

    // Trust Wallet Assets is used as a fallback for other registered tokens.
    const checksumAddress = getAddress(address);
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${checksumAddress}/logo.png`;
  }, [address, chainId]);

  const fallback = firstLetter(name, symbol);

  return (
    <div
      className={`token-logo ${className}`}
      style={{ width: size, height: size }}
      aria-label={name || symbol || "Token"}
      title={name || symbol || "Token"}
    >
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{fallback}</span>
      )}
      <style jsx>{`
        .token-logo{flex:0 0 auto;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(41,95,164,.35),rgba(10,17,31,.95));border:1px solid rgba(255,255,255,.13);box-shadow:0 4px 18px rgba(0,0,0,.22);font-weight:800;color:#f5f7ff;line-height:1}
        .token-logo img{width:100%;height:100%;display:block;object-fit:contain;padding:8px;box-sizing:border-box}
        .token-logo span{font-size:${Math.max(12, Math.round(size * .38))}px}
      `}</style>
    </div>
  );
}
