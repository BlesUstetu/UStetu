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
    </>
  );
}
