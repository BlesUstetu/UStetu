"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeEventLog, formatUnits, parseUnits, type PublicClient } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { erc20PaymentAbi, escrowAbi, USDC_BASE_SEPOLIA_ADDRESS, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";
import { baseSepolia } from "wagmi/chains";

const USDC_DECIMALS = 6;
const TOKEN_DECIMALS = 18;
const BASESCAN_TX = "https://sepolia.basescan.org/tx/";
const ORDER_STATE_PAYMENT_PENDING = 1;
const ORDER_STATE_PAID = 2;
const ORDER_STATE_COMPLETED = 5;
const CREATE_RECOVERY_TIMEOUT = 10 * 60_000;
const RPC_REQUEST_TIMEOUT = 3_000;
const ORDER_STATE_POLL_ATTEMPTS = 20;
const ORDER_STATE_POLL_INTERVAL = 1_000;
const ORDER_SCAN_BLOCKS = 100_000n;
const PENDING_ORDER_STORAGE = "ustetu.pending-order.v1";

const paymentEscrowedEventAbi = [
  {
    type: "event",
    name: "PaymentEscrowed",
    anonymous: false,
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "buyer", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;

type Step = "idle" | "creating" | "approving" | "funding" | "completing" | "success";
type TxHashes = { create?: `0x${string}`; approve?: `0x${string}`; fund?: `0x${string}`; complete?: `0x${string}` };
type BuyModalProps = {
  open: boolean; onClose: () => void; onCompleted: () => void;
  listingId: bigint; symbol: string; price: bigint; available: bigint;
  minOrderAmount: bigint; maxOrderAmount: bigint; paymentToken: `0x${string}`;
};
type RecoveredOrder = { orderId: bigint; grossPayment: bigint; txHash: `0x${string}` };
type ResumeOrder = { orderId: bigint; tokenAmount: bigint; grossPayment: bigint; state: number; createHash?: `0x${string}` };
type StoredPendingOrder = {
  chainId: number;
  escrow: string;
  listingId: string;
  buyer: string;
  orderId: string;
  tokenAmount: string;
  grossPayment: string;
  createHash?: string;
};

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); });
  return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

async function requestWalletTx<T>(promise: Promise<T>) {
  return promise;
}

async function waitForReceiptRobust(publicClient: PublicClient, hash: `0x${string}`) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const receipt = await withTimeout(publicClient.getTransactionReceipt({ hash }), RPC_REQUEST_TIMEOUT, "RPC receipt timeout");
      if (receipt.status !== "success") throw new Error("Transaksi on-chain gagal atau di-revert.");
      return receipt;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("revert") || message.includes("on-chain gagal")) throw error;
      if (attempt < 19) await sleep(700);
    }
  }
  throw new Error(`Receipt belum terbaca. Transaksi tidak dikirim ulang. Tx: ${hash}`);
}

async function recoverCreatedOrder(publicClient: PublicClient, fromBlock: bigint, listingId: bigint, buyer: `0x${string}`, tokenAmount: bigint): Promise<RecoveredOrder | null> {
  const deadline = Date.now() + CREATE_RECOVERY_TIMEOUT;
  while (Date.now() < deadline) {
    try {
      const logs = await withTimeout(publicClient.getLogs({ address: USTETU_ESCROW_ADDRESS, fromBlock, toBlock: "latest" }), RPC_REQUEST_TIMEOUT, "RPC logs timeout");
      for (const log of logs) {
        try {
          const decoded = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics, eventName: "OrderCreated" });
          if (decoded.eventName !== "OrderCreated") continue;
          const args = decoded.args;
          if (args.listingId === listingId && args.buyer.toLowerCase() === buyer.toLowerCase() && args.tokenAmount === tokenAmount && log.transactionHash) {
            return { orderId: args.orderId, grossPayment: args.grossPayment, txHash: log.transactionHash };
          }
        } catch {}
      }
    } catch {}
    await sleep(1_500);
  }
  return null;
}

async function findPendingOrder(publicClient: PublicClient, listingId: bigint, buyer: `0x${string}`): Promise<ResumeOrder | null> {
  try {
    const latest = await publicClient.getBlockNumber();
    const fromBlock = latest > ORDER_SCAN_BLOCKS ? latest - ORDER_SCAN_BLOCKS : 0n;
    const logs = await withTimeout(publicClient.getLogs({ address: USTETU_ESCROW_ADDRESS, fromBlock, toBlock: "latest" }), RPC_REQUEST_TIMEOUT * 3, "RPC pending-order scan timeout");
    let candidate: ResumeOrder | null = null;
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics, eventName: "OrderCreated" });
        if (decoded.eventName !== "OrderCreated") continue;
        const args = decoded.args;
        if (args.listingId !== listingId || args.buyer.toLowerCase() !== buyer.toLowerCase()) continue;
        const order = await withTimeout(publicClient.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [args.orderId] }), RPC_REQUEST_TIMEOUT, "RPC pending-order read timeout");
        const state = Number(order.state);
        if (state === ORDER_STATE_PAYMENT_PENDING || state === ORDER_STATE_PAID) {
          if (!candidate || args.orderId > candidate.orderId) {
            candidate = { orderId: args.orderId, tokenAmount: args.tokenAmount, grossPayment: args.grossPayment, state, createHash: log.transactionHash ?? undefined };
          }
        }
      } catch {}
    }
    return candidate;
  } catch {
    return null;
  }
}

function storageKey(chainId: number | undefined, buyer: string | undefined, listingId: bigint) {
  return `${PENDING_ORDER_STORAGE}:${chainId ?? 0}:${buyer?.toLowerCase() ?? ""}:${listingId.toString()}`;
}

function savePendingOrder(key: string, order: StoredPendingOrder) {
  try { localStorage.setItem(key, JSON.stringify(order)); } catch {}
}

function loadPendingOrder(key: string): StoredPendingOrder | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as StoredPendingOrder : null;
  } catch { return null; }
}

function clearPendingOrder(key: string) {
  try { localStorage.removeItem(key); } catch {}
}

function receiptHasPaymentEscrowed(receipt: Awaited<ReturnType<PublicClient["getTransactionReceipt"]>>, expectedOrderId: bigint) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USTETU_ESCROW_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: paymentEscrowedEventAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "PaymentEscrowed" && decoded.args.orderId === expectedOrderId) return true;
    } catch {}
  }
  return false;
}

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Transaksi gagal.");
  const lower = message.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) return "Transaksi dibatalkan di wallet.";
  if (lower.includes("insufficient funds")) return "Saldo ETH Base Sepolia tidak cukup untuk gas.";
  if (lower.includes("deadlineexpired")) return "Order sudah melewati batas waktu pembayaran.";
  if (lower.includes("invalidorderstate")) return "Order tidak berada pada status yang dapat dilanjutkan.";
  return message.length > 260 ? `${message.slice(0, 260)}…` : message;
}

function shortHash(hash: `0x${string}`) { return `${hash.slice(0, 8)}…${hash.slice(-6)}`; }

export default function BuyModal(props: BuyModalProps) {
  const { open, onClose, onCompleted, listingId, symbol, price, available, minOrderAmount, maxOrderAmount, paymentToken } = props;
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
  const [txHashes, setTxHashes] = useState<TxHashes>({});
  const [resumeOrder, setResumeOrder] = useState<ResumeOrder | null>(null);
  const [resumeChecking, setResumeChecking] = useState(false);

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({ address: paymentToken, abi: erc20PaymentAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: paymentToken, abi: erc20PaymentAbi, functionName: "allowance", args: address ? [address, USTETU_ESCROW_ADDRESS] : undefined, query: { enabled: Boolean(address) } });

  const minAmount = formatUnits(minOrderAmount, TOKEN_DECIMALS);
  const maxAmount = formatUnits(maxOrderAmount, TOKEN_DECIMALS);
  const availableAmount = formatUnits(available, TOKEN_DECIMALS);
  const parsedAmount = useMemo(() => { try { if (!amount || Number(amount) <= 0) return null; return parseUnits(amount, TOKEN_DECIMALS); } catch { return null; } }, [amount]);
  const grossPaymentPreview = useMemo(() => !parsedAmount ? 0n : (parsedAmount * price) / 10n ** BigInt(TOKEN_DECIMALS), [parsedAmount, price]);
  const isBusy = step === "creating" || step === "approving" || step === "funding" || step === "completing";
  const pendingStorageKey = storageKey(chainId, address, listingId);

  const readOrderState = async (id: bigint) => {
    if (!publicClient) return null;
    const order = await withTimeout(publicClient.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [id] }), RPC_REQUEST_TIMEOUT, "RPC order state timeout");
    return Number(order.state);
  };

  const waitForOrderState = async (id: bigint, targetStates: number[]) => {
    let lastState: number | null = null;
    for (let attempt = 0; attempt < ORDER_STATE_POLL_ATTEMPTS; attempt += 1) {
      try {
        const state = await readOrderState(id);
        lastState = state;
        if (state !== null && targetStates.includes(state)) return state;
      } catch {}
      if (attempt < ORDER_STATE_POLL_ATTEMPTS - 1) await sleep(ORDER_STATE_POLL_INTERVAL);
    }
    return lastState;
  };

  useEffect(() => {
    let cancelled = false;
    async function detectResumeOrder() {
      if (!open || !publicClient || !address || chainId !== baseSepolia.id) return;
      setResumeChecking(true);
      try {
        const stored = loadPendingOrder(pendingStorageKey);
        if (stored && stored.escrow.toLowerCase() === USTETU_ESCROW_ADDRESS.toLowerCase() && stored.buyer.toLowerCase() === address.toLowerCase() && stored.listingId === listingId.toString()) {
          const storedId = BigInt(stored.orderId);
          const order = await withTimeout(publicClient.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [storedId] }), RPC_REQUEST_TIMEOUT, "RPC pending-order read timeout");
          const state = Number(order.state);
          if (!cancelled && (state === ORDER_STATE_PAYMENT_PENDING || state === ORDER_STATE_PAID)) {
            setResumeOrder({ orderId: storedId, tokenAmount: BigInt(stored.tokenAmount), grossPayment: BigInt(stored.grossPayment), state, createHash: stored.createHash as `0x${string}` | undefined });
            setOrderId(storedId);
            setAmount(formatUnits(BigInt(stored.tokenAmount), TOKEN_DECIMALS));
            return;
          }
          if (state === ORDER_STATE_COMPLETED) clearPendingOrder(pendingStorageKey);
        }
        const detected = await findPendingOrder(publicClient, listingId, address);
        if (!cancelled && detected) {
          setResumeOrder(detected);
          setOrderId(detected.orderId);
          setAmount(formatUnits(detected.tokenAmount, TOKEN_DECIMALS));
          savePendingOrder(pendingStorageKey, { chainId, escrow: USTETU_ESCROW_ADDRESS, listingId: listingId.toString(), buyer: address, orderId: detected.orderId.toString(), tokenAmount: detected.tokenAmount.toString(), grossPayment: detected.grossPayment.toString(), createHash: detected.createHash });
        }
      } catch {} finally {
        if (!cancelled) setResumeChecking(false);
      }
    }
    void detectResumeOrder();
    return () => { cancelled = true; };
  }, [open, publicClient, address, chainId, listingId, pendingStorageKey]);

  if (!open) return null;

  const markCompleted = async (id: bigint) => {
    clearPendingOrder(pendingStorageKey);
    setResumeOrder(null);
    setStep("success");
    setStatusText(`Order #${id.toString()} selesai. ${amount} ${symbol} berhasil dibeli.`);
    await refetchBalance();
    onCompleted();
  };

  const runSettlement = async (createdOrderId: bigint, grossPayment: bigint, initialState: number, createHash?: `0x${string}`) => {
    setOrderId(createdOrderId);
    if (createHash) setTxHashes((current) => ({ ...current, create: createHash }));
    savePendingOrder(pendingStorageKey, { chainId, escrow: USTETU_ESCROW_ADDRESS, listingId: listingId.toString(), buyer: address!, orderId: createdOrderId.toString(), tokenAmount: parsedAmount?.toString() ?? resumeOrder?.tokenAmount.toString() ?? "0", grossPayment: grossPayment.toString(), createHash });

    let state = initialState;
    if (state === ORDER_STATE_COMPLETED) return markCompleted(createdOrderId);

    let currentAllowance = allowance ?? 0n;
    if (state === ORDER_STATE_PAYMENT_PENDING) {
      if (currentAllowance < grossPayment) {
        setStep("approving"); setStatusText("1/3 Konfirmasi approval USDC di wallet…");
        const approveHash = await requestWalletTx(writeContractAsync({ address: paymentToken, abi: erc20PaymentAbi, functionName: "approve", args: [USTETU_ESCROW_ADDRESS, grossPayment] }));
        setTxHashes((current) => ({ ...current, approve: approveHash }));
        setStatusText("1/3 Approval terkirim. Menunggu konfirmasi network…");
        await waitForReceiptRobust(publicClient!, approveHash);
        currentAllowance = grossPayment;
        await refetchAllowance();
      }
      if (currentAllowance < grossPayment) throw new Error("Allowance USDC belum mencukupi setelah approve.");

      setStep("funding"); setStatusText(`2/3 Konfirmasi pembayaran ${formatUnits(grossPayment, USDC_DECIMALS)} USDC di wallet…`);
      const fundHash = await requestWalletTx(writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "fundOrder", args: [createdOrderId] }));
      setTxHashes((current) => ({ ...current, fund: fundHash }));
      setStatusText("2/3 Pembayaran terkirim. Menunggu konfirmasi network…");
      let fundReceipt: Awaited<ReturnType<PublicClient["getTransactionReceipt"]>> | null = null;
      try {
        fundReceipt = await waitForReceiptRobust(publicClient!, fundHash);
      } catch (fundError) {
        const recoveredState = await waitForOrderState(createdOrderId, [ORDER_STATE_PAID, ORDER_STATE_COMPLETED]);
        if (recoveredState !== ORDER_STATE_PAID && recoveredState !== ORDER_STATE_COMPLETED) throw fundError;
        state = recoveredState;
      }
      if (fundReceipt && receiptHasPaymentEscrowed(fundReceipt, createdOrderId)) state = ORDER_STATE_PAID;
      else if (state !== ORDER_STATE_COMPLETED) state = await waitForOrderState(createdOrderId, [ORDER_STATE_PAID, ORDER_STATE_COMPLETED]) ?? state;
    }

    if (state === ORDER_STATE_COMPLETED) return markCompleted(createdOrderId);
    if (state !== ORDER_STATE_PAID) throw new Error(`Order #${createdOrderId.toString()} belum PAID. Status on-chain: ${state}.`);

    setStep("completing"); setStatusText("3/3 Konfirmasi penyelesaian order di wallet…");
    const completeHash = await requestWalletTx(writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "completeOrder", args: [createdOrderId] }));
    setTxHashes((current) => ({ ...current, complete: completeHash }));
    setStatusText("3/3 Complete terkirim. Menunggu konfirmasi network…");
    try {
      await waitForReceiptRobust(publicClient!, completeHash);
    } catch (completeError) {
      const finalState = await waitForOrderState(createdOrderId, [ORDER_STATE_COMPLETED]);
      if (finalState === ORDER_STATE_COMPLETED) return markCompleted(createdOrderId);
      throw completeError;
    }
    await markCompleted(createdOrderId);
  };

  const resumeExistingOrder = async () => {
    if (!resumeOrder || !publicClient || !address) return;
    setErrorText(""); setStatusText(""); setTxHashes({});
    try {
      setStep(resumeOrder.state === ORDER_STATE_PAYMENT_PENDING ? "approving" : "completing");
      setStatusText(resumeOrder.state === ORDER_STATE_PAYMENT_PENDING ? "Melanjutkan Order dari blockchain…" : "Order sudah dibayar. Melanjutkan settlement…");
      await runSettlement(resumeOrder.orderId, resumeOrder.grossPayment, resumeOrder.state, resumeOrder.createHash);
    } catch (error) {
      setStep("idle"); setStatusText(""); setErrorText(formatError(error));
    }
  };

  const handleBuy = async () => {
    setErrorText(""); setStatusText(""); setOrderId(null); setTxHashes({});
    if (!isConnected || !address) return setErrorText("Hubungkan wallet terlebih dahulu.");
    if (chainId !== baseSepolia.id) {
      try { setStatusText("Mengganti jaringan ke Base Sepolia…"); await switchChainAsync({ chainId: baseSepolia.id }); }
      catch (error) { setStatusText(""); return setErrorText(formatError(error)); }
    }
    if (!parsedAmount) return setErrorText("Masukkan jumlah USTETU yang valid.");
    if (parsedAmount < minOrderAmount || parsedAmount > maxOrderAmount || parsedAmount > available) return setErrorText(`Jumlah harus ${minAmount}–${maxAmount} USTETU dan tidak melebihi stok ${availableAmount} USTETU.`);
    if (paymentToken.toLowerCase() !== USDC_BASE_SEPOLIA_ADDRESS.toLowerCase()) return setErrorText("Listing ini menggunakan payment token yang bukan USDC Base Sepolia.");
    if ((usdcBalance ?? 0n) < grossPaymentPreview) return setErrorText(`Saldo USDC tidak cukup. Dibutuhkan ${formatUnits(grossPaymentPreview, USDC_DECIMALS)} USDC.`);
    if (!publicClient) return setErrorText("RPC client belum siap. Silakan coba lagi.");
    if (resumeOrder) return resumeExistingOrder();

    try {
      setStep("creating");
      setStatusText("1/3 Menunggu konfirmasi createOrder di wallet…");
      const startBlock = await publicClient.getBlockNumber();
      const walletCreatePromise = writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "createOrder", args: [listingId, parsedAmount] }).catch((error) => { throw error; });
      const recoveryPromise = recoverCreatedOrder(publicClient, startBlock, listingId, address, parsedAmount);
      const result = await Promise.race([
        requestWalletTx(walletCreatePromise).then((hash) => ({ kind: "wallet" as const, hash })),
        recoveryPromise.then((recovered) => recovered ? ({ kind: "recovered" as const, recovered }) : null),
      ]);

      let createHash: `0x${string}`;
      let createdOrderId: bigint;
      let grossPayment = grossPaymentPreview;

      if (result?.kind === "wallet") {
        createHash = result.hash;
        setTxHashes((current) => ({ ...current, create: createHash }));
        setStatusText("1/3 createOrder terkirim. Menunggu konfirmasi network…");
        const createReceipt = await waitForReceiptRobust(publicClient, createHash);
        createdOrderId = 0n;
        for (const log of createReceipt.logs) {
          if (log.address.toLowerCase() !== USTETU_ESCROW_ADDRESS.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics, eventName: "OrderCreated" });
            if (decoded.eventName === "OrderCreated") { createdOrderId = decoded.args.orderId; grossPayment = decoded.args.grossPayment; break; }
          } catch {}
        }
        if (createdOrderId === 0n) throw new Error("OrderCreated event tidak ditemukan pada transaksi createOrder.");
      } else if (result?.kind === "recovered") {
        createHash = result.recovered.txHash;
        createdOrderId = result.recovered.orderId;
        grossPayment = result.recovered.grossPayment;
        setTxHashes((current) => ({ ...current, create: createHash }));
        setOrderId(createdOrderId);
        setStatusText("1/3 createOrder sudah masuk blockchain. Memulihkan transaksi…");
        await waitForReceiptRobust(publicClient, createHash);
      } else {
        throw new Error("createOrder belum ditemukan di wallet maupun blockchain. Pastikan popup wallet sudah dikonfirmasi.");
      }
      await runSettlement(createdOrderId, grossPayment, ORDER_STATE_PAYMENT_PENDING, createHash);
    } catch (error) {
      setStep("idle"); setStatusText(""); setErrorText(formatError(error));
    }
  };

  const visibleHashes = Object.entries(txHashes).filter(([, hash]) => Boolean(hash));
  const closeIfIdle = () => { if (!isBusy) onClose(); };

  return <>
    <button className="drawer-backdrop" aria-label="Close buy dialog" onClick={closeIfIdle} />
    <section className="buy-modal" role="dialog" aria-modal="true" aria-label={`Buy ${symbol}`}>
      <div className="buy-modal-header">
        <div><span className="eyebrow">BUY TOKEN</span><h2>Buy {symbol}</h2></div>
        <button className="drawer-close" type="button" onClick={closeIfIdle} disabled={isBusy}>×</button>
      </div>
      <div className="buy-summary">
        <div><span>Price</span><strong>{formatUnits(price, USDC_DECIMALS)} USDC / {symbol}</strong></div>
        <div><span>Available</span><strong>{availableAmount} {symbol}</strong></div>
        <div><span>Min / Max</span><strong>{minAmount} / {maxAmount} {symbol}</strong></div>
      </div>
      <label className="buy-input-label" htmlFor="buy-amount">Amount ({symbol})</label>
      <div className="buy-input-wrap"><input id="buy-amount" type="number" min={minAmount} max={maxAmount} step="0.000000000000000001" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isBusy || step === "success" || Boolean(resumeOrder)}/><span>{symbol}</span></div>
      <div className="buy-total"><span>Total payment</span><strong>{formatUnits(grossPaymentPreview, USDC_DECIMALS)} USDC</strong></div>
      {resumeChecking && <div className="buy-status">Memeriksa order yang belum selesai…</div>}
      {resumeOrder && !isBusy && step !== "success" && <div className="buy-status">Order #{resumeOrder.orderId.toString()} masih {resumeOrder.state === ORDER_STATE_PAYMENT_PENDING ? "menunggu pembayaran" : "sudah dibayar"}. Tidak membuat order baru.</div>}
      {statusText && <div className="buy-status">{statusText}</div>}
      {errorText && <div className="buy-error">{errorText}</div>}
      {orderId !== null && <div className="buy-order">Order #{orderId.toString()}</div>}
      {visibleHashes.length > 0 && <div className="buy-tx-list">{visibleHashes.map(([label, hash]) => <a key={label} href={`${BASESCAN_TX}${hash}`} target="_blank" rel="noreferrer"><span>{label === "create" ? "Order" : label === "approve" ? "Approve" : label === "fund" ? "Payment" : "Complete"}</span><strong>{shortHash(hash as `0x${string}`)} ↗</strong></a>)}</div>}
      {resumeOrder ? (
        <button className="buy-submit" type="button" onClick={resumeExistingOrder} disabled={isBusy || resumeChecking || step === "success"}>
          {step === "success" ? "Purchased" : `Resume Order #${resumeOrder.orderId.toString()}`}
        </button>
      ) : (
        <button className="buy-submit" type="button" onClick={handleBuy} disabled={isBusy || resumeChecking || step === "success"}>{step === "success" ? "Purchased" : `Buy ${symbol}`}</button>
      )}
      <p className="buy-note">Transaksi diproses langsung melalui smart contract USTETU Escrow di Base Sepolia.</p>
    </section>
  </>;
}
