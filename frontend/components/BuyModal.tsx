"use client";

import { useMemo, useState } from "react";
import { decodeEventLog, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  erc20PaymentAbi,
  escrowAbi,
  USDC_BASE_SEPOLIA_ADDRESS,
  USTETU_ESCROW_ADDRESS,
} from "@/lib/contracts";
import { baseSepolia } from "wagmi/chains";

const USDC_DECIMALS = 6;
const TOKEN_DECIMALS = 18;

function formatError(error: unknown) {
  if (!error) return "Transaksi gagal.";
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("User rejected") || message.includes("User denied")) {
    return "Transaksi dibatalkan di wallet.";
  }
  if (message.includes("insufficient funds")) {
    return "Saldo ETH Base Sepolia tidak cukup untuk gas.";
  }
  return message.length > 220 ? `${message.slice(0, 220)}…` : message;
}

type BuyModalProps = {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  listingId: bigint;
  symbol: string;
  price: bigint;
  available: bigint;
  minOrderAmount: bigint;
  maxOrderAmount: bigint;
  paymentToken: `0x${string}`;
};

type Step = "idle" | "creating" | "approving" | "funding" | "completing" | "success";

export default function BuyModal({
  open,
  onClose,
  onCompleted,
  listingId,
  symbol,
  price,
  available,
  minOrderAmount,
  maxOrderAmount,
  paymentToken,
}: BuyModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("1");
  const [step, setStep] = useState<Step>("idle");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [orderId, setOrderId] = useState<bigint | null>(null);

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: paymentToken,
    abi: erc20PaymentAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: paymentToken,
    abi: erc20PaymentAbi,
    functionName: "allowance",
    args: address ? [address, USTETU_ESCROW_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  const minAmount = formatUnits(minOrderAmount, TOKEN_DECIMALS);
  const maxAmount = formatUnits(maxOrderAmount, TOKEN_DECIMALS);
  const availableAmount = formatUnits(available, TOKEN_DECIMALS);

  const parsedAmount = useMemo(() => {
    try {
      if (!amount || Number(amount) <= 0) return null;
      return parseUnits(amount, TOKEN_DECIMALS);
    } catch {
      return null;
    }
  }, [amount]);

  const grossPaymentPreview = useMemo(() => {
    if (!parsedAmount) return 0n;
    return (parsedAmount * price) / 10n ** BigInt(TOKEN_DECIMALS);
  }, [parsedAmount, price]);

  const isBusy = step === "creating" || step === "approving" || step === "funding" || step === "completing";

  if (!open) return null;

  const closeIfIdle = () => {
    if (!isBusy) onClose();
  };

  const handleBuy = async () => {
    setErrorText("");
    setOrderId(null);

    if (!isConnected || !address) {
      setErrorText("Hubungkan wallet terlebih dahulu.");
      return;
    }

    if (chainId !== baseSepolia.id) {
      try {
        setStatusText("Mengganti jaringan ke Base Sepolia…");
        await switchChainAsync({ chainId: baseSepolia.id });
      } catch (error) {
        setErrorText(formatError(error));
        return;
      }
    }

    if (!parsedAmount) {
      setErrorText("Masukkan jumlah USTETU yang valid.");
      return;
    }

    if (parsedAmount < minOrderAmount || parsedAmount > maxOrderAmount || parsedAmount > available) {
      setErrorText(`Jumlah harus ${minAmount}–${maxAmount} USTETU dan tidak melebihi stok ${availableAmount} USTETU.`);
      return;
    }

    if (paymentToken.toLowerCase() !== USDC_BASE_SEPOLIA_ADDRESS.toLowerCase()) {
      setErrorText("Listing ini menggunakan payment token yang bukan USDC Base Sepolia.");
      return;
    }

    if ((usdcBalance ?? 0n) < grossPaymentPreview) {
      setErrorText(`Saldo USDC tidak cukup. Dibutuhkan ${formatUnits(grossPaymentPreview, USDC_DECIMALS)} USDC.`);
      return;
    }

    if (!publicClient) {
      setErrorText("RPC client belum siap. Silakan coba lagi.");
      return;
    }

    try {
      setStep("creating");
      setStatusText("1/3 Membuat order on-chain…");
      const createHash = await writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "createOrder",
        args: [listingId, parsedAmount],
      });
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

      let createdOrderId: bigint | undefined;
      let grossPayment = grossPaymentPreview;

      for (const log of createReceipt.logs) {
        if (log.address.toLowerCase() !== USTETU_ESCROW_ADDRESS.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: escrowAbi,
            data: log.data,
            topics: log.topics,
            eventName: "OrderCreated",
          });
          if (decoded.eventName === "OrderCreated") {
            createdOrderId = decoded.args.orderId;
            grossPayment = decoded.args.grossPayment;
            break;
          }
        } catch {
          // Ignore unrelated logs.
        }
      }

      if (createdOrderId === undefined) {
        throw new Error("OrderCreated event tidak ditemukan pada transaksi createOrder.");
      }

      setOrderId(createdOrderId);

      if ((usdcBalance ?? 0n) < grossPayment) {
        throw new Error(`Order #${createdOrderId.toString()} sudah dibuat, tetapi saldo USDC tidak cukup untuk mendanai order.`);
      }

      let currentAllowance = allowance ?? 0n;
      if (currentAllowance < grossPayment) {
        setStep("approving");
        setStatusText("2/3 Approve USDC ke Escrow…");
        const approveHash = await writeContractAsync({
          address: paymentToken,
          abi: erc20PaymentAbi,
          functionName: "approve",
          args: [USTETU_ESCROW_ADDRESS, grossPayment],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        currentAllowance = grossPayment;
        await refetchAllowance();
      }

      if (currentAllowance < grossPayment) {
        throw new Error("Allowance USDC belum mencukupi setelah approve.");
      }

      setStep("funding");
      setStatusText(`2/3 Membayar ${formatUnits(grossPayment, USDC_DECIMALS)} USDC…`);
      const fundHash = await writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "fundOrder",
        args: [createdOrderId],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });

      setStep("completing");
      setStatusText("3/3 Menyelesaikan order dan mengirim USTETU…");
      const completeHash = await writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "completeOrder",
        args: [createdOrderId],
      });
      await publicClient.waitForTransactionReceipt({ hash: completeHash });

      setStep("success");
      setStatusText(`Order #${createdOrderId.toString()} selesai. ${amount} ${symbol} berhasil dibeli.`);
      await refetchBalance();
      onCompleted();
    } catch (error) {
      setStep("idle");
      setStatusText("");
      setErrorText(formatError(error));
    }
  };

  return (
    <>
      <button className="drawer-backdrop" aria-label="Close buy dialog" onClick={closeIfIdle} />
      <section className="buy-modal" role="dialog" aria-modal="true" aria-label={`Buy ${symbol}`}>
        <div className="buy-modal-header">
          <div>
            <span className="eyebrow">BUY TOKEN</span>
            <h2>Buy {symbol}</h2>
          </div>
          <button className="drawer-close" type="button" onClick={closeIfIdle} disabled={isBusy}>×</button>
        </div>

        <div className="buy-summary">
          <div><span>Price</span><strong>{formatUnits(price, USDC_DECIMALS)} USDC / {symbol}</strong></div>
          <div><span>Available</span><strong>{availableAmount} {symbol}</strong></div>
          <div><span>Min / Max</span><strong>{minAmount} / {maxAmount} {symbol}</strong></div>
        </div>

        <label className="buy-input-label" htmlFor="buy-amount">Amount ({symbol})</label>
        <div className="buy-input-wrap">
          <input
            id="buy-amount"
            type="number"
            min={minAmount}
            max={maxAmount}
            step="0.000000000000000001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={isBusy || step === "success"}
          />
          <span>{symbol}</span>
        </div>

        <div className="buy-total">
          <span>Total payment</span>
          <strong>{formatUnits(grossPaymentPreview, USDC_DECIMALS)} USDC</strong>
        </div>

        {!isConnected && <div className="buy-notice">Hubungkan wallet untuk melanjutkan pembelian.</div>}
        {errorText && <div className="buy-error">{errorText}</div>}
        {statusText && <div className={`buy-status ${step === "success" ? "success" : ""}`}>{statusText}</div>}

        {step === "success" ? (
          <button className="primary-glass buy-confirm" type="button" onClick={onClose}>Selesai</button>
        ) : (
          <button className="primary-glass buy-confirm" type="button" onClick={handleBuy} disabled={isBusy || !isConnected}>
            {isBusy ? "Memproses…" : `Buy ${symbol}`}
          </button>
        )}

        <p className="buy-footnote">Transaksi diproses langsung melalui smart contract USTETU Escrow di Base Sepolia.</p>
      </section>

      <style jsx>{`
        .buy-modal {
          position: fixed;
          z-index: 60;
          top: 50%;
          left: 50%;
          width: min(470px, calc(100vw - 32px));
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          transform: translate(-50%, -50%);
          padding: 25px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          background: rgba(13, 22, 35, 0.88);
          box-shadow: 0 35px 110px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(36px) saturate(135%);
          -webkit-backdrop-filter: blur(36px) saturate(135%);
          color: var(--text);
        }
        .buy-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .buy-modal h2 {
          margin: 7px 0 0;
          font-size: 27px;
          letter-spacing: -0.035em;
        }
        .buy-summary {
          display: grid;
          gap: 1px;
          margin: 24px 0;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 15px;
          background: var(--line);
        }
        .buy-summary div {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.035);
        }
        .buy-summary span,
        .buy-total span,
        .buy-input-label {
          color: var(--muted);
          font-size: 11px;
        }
        .buy-summary strong {
          color: var(--muted-strong);
          font-size: 11px;
          text-align: right;
        }
        .buy-input-label {
          display: block;
          margin-bottom: 8px;
        }
        .buy-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 14px 4px 15px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.045);
        }
        .buy-input-wrap:focus-within {
          border-color: rgba(110, 173, 245, 0.55);
          box-shadow: 0 0 0 3px rgba(101, 169, 255, 0.08);
        }
        .buy-input-wrap input {
          width: 100%;
          min-width: 0;
          padding: 11px 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text);
          font-size: 18px;
          font-weight: 650;
        }
        .buy-input-wrap span {
          color: var(--accent);
          font-size: 12px;
          font-weight: 700;
        }
        .buy-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 15px 0;
          padding: 14px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.035);
        }
        .buy-total strong {
          color: var(--text);
          font-size: 18px;
        }
        .buy-notice,
        .buy-error,
        .buy-status {
          margin-top: 10px;
          padding: 11px 13px;
          border: 1px solid var(--line);
          border-radius: 12px;
          color: var(--muted-strong);
          font-size: 11px;
          line-height: 1.45;
        }
        .buy-error {
          border-color: rgba(255, 125, 125, 0.25);
          background: rgba(255, 80, 80, 0.07);
        }
        .buy-status.success {
          border-color: rgba(130, 205, 157, 0.28);
          background: rgba(100, 190, 125, 0.08);
        }
        .buy-confirm {
          width: 100%;
          margin-top: 14px;
          padding: 13px 16px;
          background: linear-gradient(135deg, rgba(101, 169, 255, 0.24), rgba(125, 185, 255, 0.12));
          color: var(--text);
          font-weight: 700;
        }
        .buy-confirm:hover:not(:disabled) {
          border-color: rgba(140, 195, 255, 0.48);
          transform: translateY(-1px);
        }
        .buy-confirm:disabled {
          cursor: not-allowed;
          opacity: 0.52;
        }
        .buy-footnote {
          margin: 14px 2px 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.5;
          text-align: center;
        }
        html[data-theme="light"] .buy-modal {
          background: rgba(247, 250, 253, 0.92);
        }
        @media (max-width: 560px) {
          .buy-modal {
            padding: 20px;
          }
        }
      `}</style>
    </>
  );
}
