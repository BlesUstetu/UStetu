"use client";

import { useMemo, useState } from "react";
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
const WALLET_REQUEST_TIMEOUT = 20_000;
const CREATE_RECOVERY_TIMEOUT = 60_000;
const RPC_REQUEST_TIMEOUT = 3_000;

type Step = "idle" | "creating" | "approving" | "funding" | "completing" | "success";
type TxHashes = { create?: `0x${string}`; approve?: `0x${string}`; fund?: `0x${string}`; complete?: `0x${string}` };
type BuyModalProps = {
  open: boolean; onClose: () => void; onCompleted: () => void;
  listingId: bigint; symbol: string; price: bigint; available: bigint;
  minOrderAmount: bigint; maxOrderAmount: bigint; paymentToken: `0x${string}`;
};

type RecoveredOrder = { orderId: bigint; grossPayment: bigint; txHash: `0x${string}` };

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); });
  return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

async function requestWalletTx<T>(promise: Promise<T>, action: string) {
  return withTimeout(promise, WALLET_REQUEST_TIMEOUT, `${action} belum mendapat respons dari wallet setelah 20 detik. Periksa popup wallet.`);
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

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Transaksi gagal.");
  const lower = message.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) return "Transaksi dibatalkan di wallet.";
  if (lower.includes("insufficient funds")) return "Saldo ETH Base Sepolia tidak cukup untuk gas.";
  if (lower.includes("deadlineexpired")) return "Order sudah melewati batas waktu pembayaran.";
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

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({ address: paymentToken, abi: erc20PaymentAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: paymentToken, abi: erc20PaymentAbi, functionName: "allowance", args: address ? [address, USTETU_ESCROW_ADDRESS] : undefined, query: { enabled: Boolean(address) } });

  const minAmount = formatUnits(minOrderAmount, TOKEN_DECIMALS);
  const maxAmount = formatUnits(maxOrderAmount, TOKEN_DECIMALS);
  const availableAmount = formatUnits(available, TOKEN_DECIMALS);
  const parsedAmount = useMemo(() => { try { if (!amount || Number(amount) <= 0) return null; return parseUnits(amount, TOKEN_DECIMALS); } catch { return null; } }, [amount]);
  const grossPaymentPreview = useMemo(() => !parsedAmount ? 0n : (parsedAmount * price) / 10n ** BigInt(TOKEN_DECIMALS), [parsedAmount, price]);
  const isBusy = step === "creating" || step === "approving" || step === "funding" || step === "completing";

  if (!open) return null;

  const readOrderState = async (id: bigint) => {
    if (!publicClient) return null;
    const order = await withTimeout(publicClient.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [id] }), RPC_REQUEST_TIMEOUT, "RPC order state timeout");
    return order.state;
  };

  const markCompleted = async (id: bigint) => {
    setStep("success");
    setStatusText(`Order #${id.toString()} selesai. ${amount} ${symbol} berhasil dibeli.`);
    await refetchBalance();
    onCompleted();
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

    try {
      setStep("creating");
      setStatusText("1/3 Konfirmasi createOrder di wallet…");
      const startBlock = await publicClient.getBlockNumber();
      const walletCreatePromise = writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "createOrder", args: [listingId, parsedAmount] }).catch((error) => { throw error; });
      const recoveryPromise = recoverCreatedOrder(publicClient, startBlock, listingId, address, parsedAmount);
      const result = await Promise.race([
        requestWalletTx(walletCreatePromise, "createOrder").then((hash) => ({ kind: "wallet" as const, hash })),
        recoveryPromise.then((recovered) => recovered ? ({ kind: "recovered" as const, recovered }) : null),
      ]);

      let createHash: `0x${string}`;
      let createReceipt;
      let createdOrderId: bigint;
      let grossPayment = grossPaymentPreview;

      if (result?.kind === "wallet") {
        createHash = result.hash;
        setTxHashes((current) => ({ ...current, create: createHash }));
        setStatusText("1/3 createOrder terkirim. Menunggu konfirmasi network…");
        createReceipt = await waitForReceiptRobust(publicClient, createHash);
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
        createReceipt = await waitForReceiptRobust(publicClient, createHash);
      } else {
        throw new Error("createOrder belum ditemukan di wallet maupun blockchain. Pastikan popup wallet sudah dikonfirmasi.");
      }
      setOrderId(createdOrderId);

      let currentAllowance = allowance ?? 0n;
      if (currentAllowance < grossPayment) {
        setStep("approving"); setStatusText("2/3 Konfirmasi approval USDC di wallet…");
        const approveHash = await requestWalletTx(writeContractAsync({ address: paymentToken, abi: erc20PaymentAbi, functionName: "approve", args: [USTETU_ESCROW_ADDRESS, grossPayment] }), "Approval USDC");
        setTxHashes((current) => ({ ...current, approve: approveHash }));
        setStatusText("2/3 Approval terkirim. Menunggu konfirmasi network…");
        await waitForReceiptRobust(publicClient, approveHash);
        currentAllowance = grossPayment;
        await refetchAllowance();
      }
      if (currentAllowance < grossPayment) throw new Error("Allowance USDC belum mencukupi setelah approve.");

      setStep("funding"); setStatusText(`2/3 Konfirmasi pembayaran ${formatUnits(grossPayment, USDC_DECIMALS)} USDC di wallet…`);
      const fundHash = await requestWalletTx(writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "fundOrder", args: [createdOrderId] }), "Pembayaran");
      setTxHashes((current) => ({ ...current, fund: fundHash }));
      setStatusText("2/3 Pembayaran terkirim. Menunggu konfirmasi network…");
      try { await waitForReceiptRobust(publicClient, fundHash); }
      catch (fundError) {
        const state = await readOrderState(createdOrderId);
        if (state !== ORDER_STATE_PAID && state !== ORDER_STATE_COMPLETED) throw state === ORDER_STATE_PAYMENT_PENDING ? new Error(`Pembayaran belum tercatat. Tx: ${fundHash}`) : fundError;
      }

      const stateAfterFunding = await readOrderState(createdOrderId);
      if (stateAfterFunding === ORDER_STATE_COMPLETED) return markCompleted(createdOrderId);
      if (stateAfterFunding !== ORDER_STATE_PAID) throw new Error(`Order #${createdOrderId.toString()} belum PAID. Status on-chain: ${stateAfterFunding ?? "unknown"}.`);

      setStep("completing"); setStatusText("3/3 Konfirmasi penyelesaian order di wallet…");
      const completeHash = await requestWalletTx(writeContractAsync({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "completeOrder", args: [createdOrderId] }), "completeOrder");
      setTxHashes((current) => ({ ...current, complete: completeHash }));
      setStatusText("3/3 Complete terkirim. Menunggu konfirmasi network…");
      try { await waitForReceiptRobust(publicClient, completeHash); }
      catch (completeError) { const finalState = await readOrderState(createdOrderId); if (finalState === ORDER_STATE_COMPLETED) return markCompleted(createdOrderId); throw completeError; }
      await markCompleted(createdOrderId);
    } catch (error) {
      setStep("idle"); setStatusText(""); setErrorText(formatError(error));
    }
  };

  const visibleHashes = Object.entries(txHashes).filter(([, hash]) => Boolean(hash));
  const closeIfIdle = () => { if (!isBusy) onClose(); };

  return <>
    <button className="drawer-backdrop" aria-label="Close buy dialog" onClick={closeIfIdle} />
    <section className="buy-modal" role="dialog" aria-modal="true" aria-label={`Buy ${symbol}`}>
      <div className="buy-modal-header"><div><span className="eyebrow">BUY TOKEN</span><h2>Buy {symbol}</h2></div><button className="drawer-close" type="button" onClick={closeIfIdle} disabled={isBusy}>×</button></div>
      <div className="buy-summary"><div><span>Price</span><strong>{formatUnits(price, USDC_DECIMALS)} USDC / {symbol}</strong></div><div><span>Available</span><strong>{availableAmount} {symbol}</strong></div><div><span>Min / Max</span><strong>{minAmount} / {maxAmount} {symbol}</strong></div></div>
      <label className="buy-input-label" htmlFor="buy-amount">Amount ({symbol})</label>
      <div className="buy-input-wrap"><input id="buy-amount" type="number" min={minAmount} max={maxAmount} step="0.000000000000000001" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isBusy || step === "success"}/><span>{symbol}</span></div>
      <div className="buy-total"><span>Total payment</span><strong>{formatUnits(grossPaymentPreview, USDC_DECIMALS)} USDC</strong></div>
      {!isConnected && <div className="buy-notice">Hubungkan wallet untuk melanjutkan pembelian.</div>}
      {errorText && <div className="buy-error">{errorText}</div>}
      {statusText && <div className={`buy-status ${step === "success" ? "success" : ""}`}><span className="status-dot"/><span>{statusText}</span></div>}
      {visibleHashes.length > 0 && <div className="buy-txs">{visibleHashes.map(([name, hash]) => { const typedHash = hash as `0x${string}`; const label = name === "create" ? "Order" : name === "approve" ? "Approve" : name === "fund" ? "Payment" : "Complete"; return <a key={name} href={`${BASESCAN_TX}${typedHash}`} target="_blank" rel="noreferrer"><span>{label}</span><strong>{shortHash(typedHash)} ↗</strong></a>; })}</div>}
      {orderId !== null && step !== "idle" && <div className="buy-order">Order #{orderId.toString()}</div>}
      {step === "success" ? <button className="primary-glass buy-confirm" type="button" onClick={onClose}>Selesai</button> : <button className="primary-glass buy-confirm" type="button" onClick={handleBuy} disabled={isBusy || !isConnected}>{isBusy ? "Memproses…" : `Buy ${symbol}`}</button>}
      <p className="buy-footnote">Transaksi diproses langsung melalui smart contract USTETU Escrow di Base Sepolia.</p>
    </section>
    <style jsx>{`
      .buy-modal{position:fixed;z-index:60;top:50%;left:50%;width:min(470px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow-y:auto;transform:translate(-50%,-50%);padding:25px;border:1px solid rgba(255,255,255,.15);border-radius:24px;background:rgba(13,22,35,.9);box-shadow:0 35px 110px rgba(0,0,0,.45);backdrop-filter:blur(36px) saturate(135%);color:var(--text)}
      .buy-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.buy-modal h2{margin:7px 0 0;font-size:27px;letter-spacing:-.035em}.buy-summary{display:grid;gap:1px;margin:24px 0;overflow:hidden;border:1px solid var(--line);border-radius:15px;background:var(--line)}.buy-summary div{display:flex;justify-content:space-between;gap:15px;padding:12px 14px;background:rgba(255,255,255,.035)}.buy-summary span,.buy-total span,.buy-input-label{color:var(--muted);font-size:11px}.buy-summary strong{color:var(--muted-strong);font-size:11px;text-align:right}.buy-input-label{display:block;margin-bottom:8px}.buy-input-wrap{display:flex;align-items:center;gap:10px;padding:4px 14px 4px 15px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.045)}.buy-input-wrap:focus-within{border-color:rgba(110,173,245,.55);box-shadow:0 0 0 3px rgba(101,169,255,.08)}.buy-input-wrap input{width:100%;min-width:0;padding:11px 0;border:0;outline:0;background:transparent;color:var(--text);font-size:18px;font-weight:650}.buy-input-wrap span{color:var(--accent);font-size:12px;font-weight:700}.buy-total{display:flex;align-items:center;justify-content:space-between;margin:15px 0;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.035)}.buy-total strong{color:var(--text);font-size:18px}.buy-notice,.buy-error,.buy-status{display:flex;align-items:flex-start;gap:9px;margin-top:10px;padding:11px 13px;border:1px solid var(--line);border-radius:12px;color:var(--muted-strong);font-size:11px;line-height:1.45}.buy-error{border-color:rgba(255,125,125,.25);background:rgba(255,80,80,.06)}.buy-status.success{border-color:rgba(100,220,160,.28);background:rgba(70,210,145,.07)}.status-dot{width:7px;height:7px;flex:0 0 7px;margin-top:4px;border-radius:999px;background:currentColor;box-shadow:0 0 12px currentColor;animation:pulse 1.5s ease-in-out infinite}.buy-txs{display:grid;gap:7px;margin-top:10px}.buy-txs a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;color:var(--muted);background:rgba(255,255,255,.025);font-size:10px;text-decoration:none}.buy-txs a:hover{border-color:rgba(110,173,245,.35);color:var(--text)}.buy-txs strong{color:var(--accent);font-weight:650}.buy-order{margin-top:9px;color:var(--muted);font-size:10px;text-align:right}.buy-confirm{width:100%;margin-top:18px;padding:13px 16px;border-radius:14px;cursor:pointer}.buy-confirm:disabled{cursor:not-allowed;opacity:.58}.buy-footnote{margin:13px 2px 0;color:var(--muted);font-size:10px;line-height:1.5;text-align:center}@keyframes pulse{0%,100%{opacity:.45;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
    `}</style>
  </>;
}
