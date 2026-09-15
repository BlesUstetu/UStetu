"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { decodeEventLog, formatUnits, parseUnits, type PublicClient } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { erc20PaymentAbi, escrowAbi, USTETU_ESCROW_ADDRESS } from "@/lib/contracts";

const BASESCAN_TX = "https://sepolia.basescan.org/tx/";
const PAYMENT_PENDING = 1;
const PAID = 2;
const COMPLETED = 5;
const RPC_TIMEOUT = 8000;
const COMPLETE_WRITE_TIMEOUT = 15000;
const COMPLETE_RECOVERY_ATTEMPTS = 30;
const SCAN_BLOCKS = 5000n;
const COMPLETION_SCAN_BLOCKS = 20000n;
const MAX_LOG_RANGE = 5000n;
const ACTIVE_ORDER_STORAGE = "ustetu.active-order.v1";

type Step = "idle" | "creating" | "approving" | "funding" | "completing" | "success";
type TxPhase = "idle" | "wallet" | "submitted" | "confirmed";
type TxHashes = {
  create?: `0x${string}`;
  approve?: `0x${string}`;
  fund?: `0x${string}`;
  complete?: `0x${string}`;
};
type ActiveOrder = {
  orderId: bigint;
  tokenAmount: bigint;
  grossPayment: bigint;
  state: number;
  expiresAt: bigint;
  createHash?: `0x${string}`;
};
type StoredCompleteRecovery = {
  chainId: number;
  escrow: string;
  listingId: string;
  buyer: string;
  orderId: string;
  startedAt: number;
  completeHash?: `0x${string}`;
};
type ApprovalOutcome =
  | { kind: "submitted"; hash: `0x${string}` }
  | { kind: "confirmed"; allowance: bigint }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };
type FundOutcome =
  | { kind: "submitted"; hash: `0x${string}` }
  | { kind: "paid" }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };
type Props = {
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
  tokenDecimals: number;
  paymentDecimals: number;
  paymentSymbol: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function timeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const fallback = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, fallback]).finally(() => clearTimeout(timer));
}

function storageKey(chainId: number | undefined, buyer: string | undefined, listingId: bigint) {
  return `ustetu.active-order.v1:${chainId ?? 0}:${buyer?.toLowerCase() ?? ""}:${listingId}`;
}

function recoveryKey(chainId: number | undefined, buyer: string | undefined, listingId: bigint) {
  return `ustetu.complete-recovery.v1:${chainId ?? 0}:${buyer?.toLowerCase() ?? ""}:${listingId}`;
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function load(key: string) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function clear(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function hashShort(hash: `0x${string}`) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function isUserRejected(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request")
  );
}

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Transaksi gagal.");
  const lower = message.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) return "Transaksi dibatalkan di wallet.";
  if (lower.includes("insufficient funds")) return "Saldo ETH Base Sepolia tidak cukup untuk gas.";
  if (lower.includes("deadlineexpired") || lower.includes("deadline expired")) return "Order sudah melewati batas waktu pembayaran.";
  if (lower.includes("invalidorderstate")) return "Order tidak berada pada status yang dapat dilanjutkan.";
  if (lower.includes("insufficient allowance")) return "Allowance payment token ke Escrow belum mencukupi.";
  if (
    lower.includes("requested resource not available") ||
    lower.includes("resource not available") ||
    lower.includes("rpc") ||
    lower.includes("timeout") ||
    lower.includes("429") ||
    lower.includes("rate limit")
  ) {
    return "Koneksi RPC sedang tidak tersedia. Tidak ada order baru yang dibuat. Coba lagi beberapa detik lagi.";
  }
  return message.length > 260 ? `${message.slice(0, 260)}…` : message;
}

async function logsChunked(client: PublicClient, from: bigint, to: bigint) {
  const logs: Awaited<ReturnType<PublicClient["getLogs"]>> = [];
  for (let start = from; start <= to; ) {
    const end = start + MAX_LOG_RANGE - 1n < to ? start + MAX_LOG_RANGE - 1n : to;
    logs.push(
      ...(await timeout(
        client.getLogs({ address: USTETU_ESCROW_ADDRESS, fromBlock: start, toBlock: end }),
        RPC_TIMEOUT * 3,
        "RPC logs timeout"
      ))
    );
    start = end + 1n;
  }
  return logs;
}

async function scanActiveOrder(
  client: PublicClient,
  listingId: bigint,
  buyer: `0x${string}`,
  now: bigint
): Promise<ActiveOrder | null> {
  const latest = await timeout(client.getBlockNumber(), RPC_TIMEOUT, "RPC block timeout");
  const from = latest > SCAN_BLOCKS ? latest - SCAN_BLOCKS : 0n;
  const logs = await logsChunked(client, from, latest);

  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    let args: any;
    try {
      const decoded = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
        eventName: "OrderCreated",
      });
      if (decoded.eventName !== "OrderCreated") continue;
      args = decoded.args;
    } catch {
      continue;
    }

    if (args.listingId !== listingId || args.buyer.toLowerCase() !== buyer.toLowerCase()) continue;

    const order: any = await timeout(
      client.readContract({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "getOrder",
        args: [args.orderId],
      }),
      RPC_TIMEOUT,
      "RPC order timeout"
    );
    if (!order) continue;

    const state = Number(order.state);
    if (state === PAYMENT_PENDING && order.expiresAt <= now) continue;
    if (state === PAYMENT_PENDING || state === PAID) {
      return {
        orderId: args.orderId,
        tokenAmount: args.tokenAmount,
        grossPayment: args.grossPayment,
        state,
        expiresAt: order.expiresAt,
        createHash: log.transactionHash ?? undefined,
      };
    }
  }

  return null;
}

async function findCompletedTx(client: PublicClient, orderId: bigint) {
  const latest = await timeout(client.getBlockNumber(), RPC_TIMEOUT, "RPC completion block timeout");
  const from = latest > COMPLETION_SCAN_BLOCKS ? latest - COMPLETION_SCAN_BLOCKS : 0n;
  const logs = await logsChunked(client, from, latest);

  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    try {
      const decoded = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
        eventName: "OrderCompleted",
      });
      if (decoded.eventName !== "OrderCompleted") continue;
      const args: any = decoded.args;
      if (args.orderId === orderId && log.transactionHash) return log.transactionHash as `0x${string}`;
    } catch {}
  }

  return null;
}

function createdOrderIdFromReceipt(receipt: any, listingId: bigint, buyer: `0x${string}`) {
  for (let i = (receipt?.logs?.length ?? 0) - 1; i >= 0; i--) {
    const log = receipt.logs[i];
    try {
      const decoded = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
        eventName: "OrderCreated",
      });
      if (decoded.eventName !== "OrderCreated") continue;
      const args: any = decoded.args;
      if (args.listingId === listingId && args.buyer?.toLowerCase() === buyer.toLowerCase()) return args.orderId as bigint;
    } catch {}
  }
  return null;
}

async function waitReceipt(client: PublicClient, hash: `0x${string}`) {
  for (let i = 0; i < 30; i++) {
    try {
      const receipt = await timeout(
        client.getTransactionReceipt({ hash }),
        RPC_TIMEOUT,
        "RPC receipt timeout"
      );
      if (receipt.status !== "success") throw new Error("Transaksi on-chain gagal atau di-revert.");
      return receipt;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("revert") || message.includes("on-chain gagal")) throw error;
      await sleep(700);
    }
  }
  throw new Error(`Receipt belum terbaca. Transaksi tidak dikirim ulang. Tx: ${hash}`);
}

async function waitAllowance(
  client: PublicClient,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  expected: bigint,
  attempts = 45
) {
  for (let i = 0; i < attempts; i++) {
    try {
      const allowance = await timeout(
        client.readContract({ address: token, abi: erc20PaymentAbi, functionName: "allowance", args: [owner, spender] }),
        RPC_TIMEOUT,
        "RPC allowance confirmation timeout"
      );
      if (allowance >= expected) return allowance;
    } catch {}
    await sleep(700);
  }
  return null;
}

async function waitOrderState(client: PublicClient, orderId: bigint, wanted: number[], attempts = COMPLETE_RECOVERY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      const order: any = await timeout(
        client.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [orderId] }),
        RPC_TIMEOUT,
        "RPC order recovery timeout"
      );
      if (order) {
        const state = Number(order.state);
        if (wanted.includes(state)) return state;
      }
    } catch {}
    await sleep(1000);
  }
  return null;
}

async function waitFundState(client: PublicClient, orderId: bigint, attempts = 45) {
  for (let i = 0; i < attempts; i++) {
    try {
      const order: any = await timeout(
        client.readContract({ address: USTETU_ESCROW_ADDRESS, abi: escrowAbi, functionName: "getOrder", args: [orderId] }),
        RPC_TIMEOUT,
        "RPC fund state timeout"
      );
      if (order) {
        const state = Number(order.state);
        if (state === PAID || state === COMPLETED) return state;
      }
    } catch {}
    await sleep(700);
  }
  return null;
}

function phaseLabel(phase: TxPhase) {
  if (phase === "wallet") return "WALLET";
  if (phase === "submitted") return "SUBMITTED";
  if (phase === "confirmed") return "ON-CHAIN ✓";
  return "";
}

export default function BuyModal(props: Props) {
  const {
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
    tokenDecimals,
    paymentDecimals,
    paymentSymbol,
  } = props;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("1");
  const [step, setStep] = useState<Step>("idle");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [orderId, setOrderId] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxHashes>({});
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [expiredOrderId, setExpiredOrderId] = useState<bigint | null>(null);
  const [checking, setChecking] = useState(false);
  const [approvalReady, setApprovalReady] = useState(false);
  const [fundPhase, setFundPhase] = useState<TxPhase>("idle");
  const [completePhase, setCompletePhase] = useState<TxPhase>("idle");
  const flowStartedRef = useRef(false);
  const [flowStarted, setFlowStarted] = useState(false);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: paymentToken,
    abi: erc20PaymentAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const min = formatUnits(minOrderAmount, tokenDecimals);
  const max = formatUnits(maxOrderAmount, tokenDecimals);
  const avail = formatUnits(available, tokenDecimals);
  const parsed = useMemo(() => {
    try {
      return amount && Number(amount) > 0 ? parseUnits(amount, tokenDecimals) : null;
    } catch {
      return null;
    }
  }, [amount, tokenDecimals]);
  const preview = useMemo(
    () => (!parsed ? 0n : (parsed * price) / 10n ** BigInt(tokenDecimals)),
    [parsed, price, tokenDecimals]
  );
  const display = activeOrder?.grossPayment ?? preview;
  const busy = ["creating", "approving", "funding", "completing"].includes(step);
  const activeStorageKey = storageKey(chainId, address, listingId);
  const completeRecoveryStorageKey = recoveryKey(chainId, address, listingId);

  const readOrder = async (id: bigint, blockNumber?: bigint) => {
    if (!client) return null;
    const request: any = {
      address: USTETU_ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "getOrder",
      args: [id],
    };
    if (blockNumber !== undefined) request.blockNumber = blockNumber;
    return await timeout(client.readContract(request), RPC_TIMEOUT, "RPC order state timeout");
  };

  const readAllowance = async () =>
    address && client
      ? timeout(
          client.readContract({ address: paymentToken, abi: erc20PaymentAbi, functionName: "allowance", args: [address, USTETU_ESCROW_ADDRESS] }),
          RPC_TIMEOUT,
          "RPC allowance timeout"
        )
      : 0n;

  const readBalance = async () =>
    address && client
      ? timeout(
          client.readContract({ address: paymentToken, abi: erc20PaymentAbi, functionName: "balanceOf", args: [address] }),
          RPC_TIMEOUT,
          "RPC balance timeout"
        )
      : 0n;

  const readChainTimestamp = async () =>
    client
      ? (await timeout(client.getBlock({ blockTag: "latest" }), RPC_TIMEOUT, "RPC block timestamp timeout")).timestamp
      : BigInt(Math.floor(Date.now() / 1000));

  const applyActiveOrder = (found: ActiveOrder) => {
    setActiveOrder(found);
    setOrderId(found.orderId);
    setAmount(formatUnits(found.tokenAmount, tokenDecimals));
    if (found.createHash) setTx((current) => ({ ...current, create: found.createHash }));
    if (found.state === PAID) {
      setApprovalReady(true);
      setFundPhase("confirmed");
    } else {
      setApprovalReady(false);
      setFundPhase("idle");
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function detectActiveOrder() {
      if (!open || !client || !address || flowStartedRef.current) return;
      setChecking(true);
      setActiveOrder(null);
      setExpiredOrderId(null);
      setErr("");
      setApprovalReady(false);
      setFundPhase("idle");
      setCompletePhase("idle");

      try {
        if (chainId !== baseSepolia.id) {
          setStatus("Hubungkan wallet ke Base Sepolia untuk melanjutkan pembelian.");
          return;
        }

        const now = await readChainTimestamp();
        if (cancelled || flowStartedRef.current) return;

        let found: ActiveOrder | null = null;
        const stored = load(activeStorageKey);

        if (
          stored &&
          stored.escrow?.toLowerCase() === USTETU_ESCROW_ADDRESS.toLowerCase() &&
          stored.buyer?.toLowerCase() === address.toLowerCase() &&
          stored.listingId === listingId.toString()
        ) {
          try {
            const order: any = await readOrder(BigInt(stored.orderId));
            if (order) {
              const state = Number(order.state);
              if (state === PAYMENT_PENDING && order.expiresAt <= now) {
                clear(activeStorageKey);
                setExpiredOrderId(BigInt(stored.orderId));
              } else if (state === PAYMENT_PENDING || state === PAID) {
                found = {
                  orderId: BigInt(stored.orderId),
                  tokenAmount: order.tokenAmount,
                  grossPayment: order.grossPayment,
                  state,
                  expiresAt: order.expiresAt,
                  createHash: stored.createHash,
                };
              } else if (state === COMPLETED) {
                clear(activeStorageKey);
                setStatus(`Order #${stored.orderId} sudah selesai on-chain.`);
              }
            }
          } catch {}
        }

        if (cancelled || flowStartedRef.current) return;
        if (!found) found = await scanActiveOrder(client, listingId, address, now);
        if (cancelled || flowStartedRef.current) return;

        if (found) {
          applyActiveOrder(found);
          setStatus(`Order #${found.orderId} masih aktif. Klik BUY untuk melanjutkan order ini.`);
          save(activeStorageKey, {
            chainId,
            escrow: USTETU_ESCROW_ADDRESS,
            listingId: listingId.toString(),
            buyer: address,
            orderId: found.orderId.toString(),
            tokenAmount: found.tokenAmount.toString(),
            grossPayment: found.grossPayment.toString(),
            expiresAt: found.expiresAt.toString(),
            createHash: found.createHash,
          });
        }
      } catch (error) {
        if (!cancelled && !flowStartedRef.current) setErr(errorText(error));
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void detectActiveOrder();
    return () => {
      cancelled = true;
    };
  }, [open, client, address, chainId, listingId, activeStorageKey, tokenDecimals]);

  useEffect(() => {
    if (!open) {
      flowStartedRef.current = false;
      setFlowStarted(false);
    }
  }, [open]);

  if (!open) return null;

  const markComplete = async (id: bigint) => {
    let completionHash = tx.complete;
    if (!completionHash && client) {
      try {
        completionHash = await findCompletedTx(client, id);
      } catch {}
    }
    if (completionHash) setTx((current) => ({ ...current, complete: completionHash }));

    clear(activeStorageKey);
    clear(completeRecoveryStorageKey);
    setActiveOrder(null);
    setStep("success");
    setFundPhase("confirmed");
    setCompletePhase("confirmed");
    setApprovalReady(true);
    setStatus(`Order #${id} selesai on-chain. ${amount} ${symbol} berhasil dibeli.`);
    await refetchBalance();
    onCompleted();
  };

  const recoverComplete = async (id: bigint) => {
    if (!client) return false;
    setStep("completing");
    setStatus(`Memastikan Order #${id} sudah COMPLETED on-chain…`);
    const state = await waitOrderState(client, id, [COMPLETED]);
    if (state === COMPLETED) {
      setCompletePhase("confirmed");
      await markComplete(id);
      return true;
    }
    setStep("idle");
    setStatus(`Transaksi Complete belum dapat dipastikan on-chain. Tidak mengirim transaksi kedua. Coba lagi beberapa detik lagi.`);
    return false;
  };

  const settle = async (
    id: bigint,
    gross: bigint,
    state: number,
    createHash?: `0x${string}`,
    confirmedBlock?: bigint
  ) => {
    setOrderId(id);
    if (createHash) setTx((current) => ({ ...current, create: createHash }));

    const tokenAmount = activeOrder?.orderId === id ? activeOrder.tokenAmount : parsed;
    save(activeStorageKey, {
      chainId,
      escrow: USTETU_ESCROW_ADDRESS,
      listingId: listingId.toString(),
      buyer: address!,
      orderId: id.toString(),
      tokenAmount: tokenAmount?.toString() ?? "0",
      grossPayment: gross.toString(),
      createHash,
    });

    if (state === COMPLETED) return markComplete(id);

    if (state === PAYMENT_PENDING) {
      const live: any = await readOrder(id, confirmedBlock);
      if (!live) throw new Error(`Order #${id} tidak ditemukan.`);

      let liveState = Number(live.state);
      if (liveState !== PAYMENT_PENDING) {
        if (liveState === PAID) {
          liveState = PAID;
          setFundPhase("confirmed");
        } else if (liveState === COMPLETED) {
          return markComplete(id);
        } else {
          throw new Error(`Order #${id} tidak lagi menunggu pembayaran. Status on-chain: ${liveState}.`);
        }
      } else {
        const now = await readChainTimestamp();
        if (live.expiresAt <= now) {
          clear(activeStorageKey);
          setActiveOrder(null);
          setExpiredOrderId(id);
          throw new Error(`Order #${id} sudah melewati batas waktu pembayaran.`);
        }

        if ((await readBalance()) < gross) {
          throw new Error(
            `Saldo ${paymentSymbol} tidak cukup. Order #${id} membutuhkan ${formatUnits(gross, paymentDecimals)} ${paymentSymbol}.`
          );
        }

        let allowance = await readAllowance();
        if (allowance < gross) {
          setStep("approving");
          setStatus(`Konfirmasi approval ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} di wallet…`);

          const approvalWrite: Promise<ApprovalOutcome> = writeContractAsync({
            address: paymentToken,
            abi: erc20PaymentAbi,
            functionName: "approve",
            args: [USTETU_ESCROW_ADDRESS, gross],
          })
            .then((hash) => {
              setTx((current) => ({ ...current, approve: hash }));
              return { kind: "submitted", hash } as const;
            })
            .catch((error) => ({ kind: "error", error }) as const);

          const allowanceWatch: Promise<ApprovalOutcome> = waitAllowance(
            client!,
            paymentToken,
            address!,
            USTETU_ESCROW_ADDRESS,
            gross,
            45
          ).then((value) =>
            value === null ? ({ kind: "timeout" } as const) : ({ kind: "confirmed", allowance: value } as const)
          );

          const outcome = await Promise.race([approvalWrite, allowanceWatch]);

          if (outcome.kind === "confirmed") {
            allowance = outcome.allowance;
            setApprovalReady(true);
            setStatus(`Approval ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} terkonfirmasi on-chain.`);
          } else if (outcome.kind === "submitted") {
            setStatus(`Approval ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} sudah dikirim. Menunggu konfirmasi blockchain…`);
            try {
              await waitReceipt(client!, outcome.hash);
              allowance = await readAllowance();
            } catch (error) {
              const confirmed = await waitAllowance(
                client!,
                paymentToken,
                address!,
                USTETU_ESCROW_ADDRESS,
                gross,
                20
              );
              if (confirmed === null) throw error;
              allowance = confirmed;
            }
          } else {
            const confirmed = await waitAllowance(
              client!,
              paymentToken,
              address!,
              USTETU_ESCROW_ADDRESS,
              gross,
              15
            );
            if (confirmed !== null) {
              allowance = confirmed;
              setApprovalReady(true);
              setStatus(`Approval ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} terkonfirmasi on-chain.`);
            } else if (outcome.kind === "error") {
              throw outcome.error;
            } else {
              throw new Error(`Approval ${paymentSymbol} belum terkonfirmasi on-chain. Tidak mengirim approval kedua.`);
            }
          }
        }

        if (allowance < gross) {
          const confirmed = await waitAllowance(
            client!,
            paymentToken,
            address!,
            USTETU_ESCROW_ADDRESS,
            gross,
            20
          );
          if (confirmed === null) throw new Error(`Approval ${paymentSymbol} belum terkonfirmasi on-chain. Tidak mengirim approval kedua.`);
          allowance = confirmed;
        }

        if (allowance < gross) throw new Error(`Allowance ${paymentSymbol} belum mencukupi untuk Order #${id}.`);
        setApprovalReady(true);

        setStep("funding");
        setFundPhase("wallet");
        setStatus(`Konfirmasi pembayaran ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} di wallet…`);

        const fundWrite: Promise<FundOutcome> = writeContractAsync({
          address: USTETU_ESCROW_ADDRESS,
          abi: escrowAbi,
          functionName: "fundOrder",
          args: [id],
        })
          .then((hash) => {
            setTx((current) => ({ ...current, fund: hash }));
            return { kind: "submitted", hash } as const;
          })
          .catch((error) => ({ kind: "error", error }) as const);

        const fundWatch: Promise<FundOutcome> = waitFundState(client!, id, 45).then((value) =>
          value === PAID || value === COMPLETED ? ({ kind: "paid" } as const) : ({ kind: "timeout" } as const)
        );

        const fundOutcome = await Promise.race([fundWrite, fundWatch]);

        if (fundOutcome.kind === "paid") {
          liveState = PAID;
          setFundPhase("confirmed");
          setStatus(`Fund Escrow terkonfirmasi on-chain. ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} masuk ke escrow.`);
        } else if (fundOutcome.kind === "submitted") {
          setFundPhase("submitted");
          setStatus("Fund Escrow sudah dikirim. Menunggu konfirmasi blockchain…");
          try {
            await waitReceipt(client!, fundOutcome.hash);
            liveState = PAID;
            setFundPhase("confirmed");
            setStatus(`Fund Escrow terkonfirmasi on-chain. ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} masuk ke escrow.`);
          } catch (error) {
            const stateAfter = await waitFundState(client!, id, 20);
            if (stateAfter === PAID || stateAfter === COMPLETED) {
              liveState = stateAfter;
              setFundPhase("confirmed");
              setStatus(`Fund Escrow terkonfirmasi on-chain. ${formatUnits(gross, paymentDecimals)} ${paymentSymbol} masuk ke escrow.`);
            } else {
              throw error;
            }
          }
        } else {
          const stateAfter = await waitFundState(client!, id, 15);
          if (stateAfter === PAID || stateAfter === COMPLETED) {
            liveState = stateAfter;
            setFundPhase("confirmed");
          } else if (fundOutcome.kind === "error") {
            throw fundOutcome.error;
          } else {
            throw new Error(`Fund Escrow belum terkonfirmasi on-chain. Tidak mengirim transaksi kedua.`);
          }
        }
      }

      state = liveState;
    }

    if (state === COMPLETED) return markComplete(id);
    if (state !== PAID) throw new Error(`Order #${id} belum PAID. Status on-chain: ${state}.`);

    setApprovalReady(true);
    setFundPhase("confirmed");

    const recovery = load(completeRecoveryStorageKey) as StoredCompleteRecovery | null;
    if (
      recovery &&
      recovery.orderId === id.toString() &&
      recovery.buyer?.toLowerCase() === address?.toLowerCase()
    ) {
      if (recovery.completeHash) setTx((current) => ({ ...current, complete: recovery.completeHash }));
      const recovered = await recoverComplete(id);
      if (recovered) return;
      throw new Error(`Order #${id} masih menunggu kepastian transaksi Complete. Tidak mengirim transaksi kedua.`);
    }

    setStep("completing");
    setCompletePhase("wallet");
    setStatus("Konfirmasi penyelesaian order di wallet…");

    let completeHash: `0x${string}`;
    try {
      completeHash = await timeout(
        writeContractAsync({
          address: USTETU_ESCROW_ADDRESS,
          abi: escrowAbi,
          functionName: "completeOrder",
          args: [id],
        }),
        COMPLETE_WRITE_TIMEOUT,
        "Complete wallet/RPC timeout"
      );
      save(completeRecoveryStorageKey, {
        chainId,
        escrow: USTETU_ESCROW_ADDRESS,
        listingId: listingId.toString(),
        buyer: address!,
        orderId: id.toString(),
        startedAt: Date.now(),
        completeHash,
      });
      setTx((current) => ({ ...current, complete: completeHash }));
      setCompletePhase("submitted");
      setStatus("Complete Order sudah dikirim. Menunggu konfirmasi blockchain…");
    } catch (error) {
      if (isUserRejected(error)) {
        setCompletePhase("idle");
        throw error;
      }
      save(completeRecoveryStorageKey, {
        chainId,
        escrow: USTETU_ESCROW_ADDRESS,
        listingId: listingId.toString(),
        buyer: address!,
        orderId: id.toString(),
        startedAt: Date.now(),
      });
      const recovered = await recoverComplete(id);
      if (recovered) return;
      throw new Error(`Konfirmasi Complete sudah dilakukan atau sedang diproses, tetapi hash belum dapat dipastikan. Tidak mengirim completeOrder kedua.`);
    }

    try {
      await waitReceipt(client!, completeHash);
    } catch (error) {
      const recovered = await waitOrderState(client!, id, [COMPLETED]);
      if (recovered === COMPLETED) {
        setCompletePhase("confirmed");
        return markComplete(id);
      }
      throw error;
    }

    setCompletePhase("confirmed");
    setStatus(`Complete Order terkonfirmasi on-chain. Token ${amount} ${symbol} sudah dilepas ke wallet buyer.`);
    clear(completeRecoveryStorageKey);

    const finalOrder: any = await readOrder(id);
    if (finalOrder && Number(finalOrder.state) === COMPLETED) return markComplete(id);
    throw new Error(`Order #${id} belum berstatus COMPLETED setelah receipt.`);
  };

  const buy = async () => {
    flowStartedRef.current = true;
    setFlowStarted(true);

    try {
      setErr("");

      if (!isConnected || !address || !client) {
        setErr("Hubungkan wallet terlebih dahulu.");
        return;
      }

      if (chainId !== baseSepolia.id) {
        setStatus("Pindah jaringan ke Base Sepolia…");
        await switchChainAsync({ chainId: baseSepolia.id });
        return;
      }

      const now = await readChainTimestamp();
      let existing = activeOrder;

      if (existing) {
        const live: any = await readOrder(existing.orderId);
        if (live) {
          const state = Number(live.state);
          if (state === COMPLETED) return markComplete(existing.orderId);
          if (state === PAYMENT_PENDING && live.expiresAt > now) {
            existing = {
              ...existing,
              tokenAmount: live.tokenAmount,
              grossPayment: live.grossPayment,
              state,
              expiresAt: live.expiresAt,
            };
          } else if (state === PAID) {
            existing = {
              ...existing,
              tokenAmount: live.tokenAmount,
              grossPayment: live.grossPayment,
              state,
              expiresAt: live.expiresAt,
            };
          } else {
            existing = null;
            setActiveOrder(null);
            clear(activeStorageKey);
          }
        }
      }

      if (!existing) {
        const stored = load(activeStorageKey);
        if (
          stored &&
          stored.escrow?.toLowerCase() === USTETU_ESCROW_ADDRESS.toLowerCase() &&
          stored.buyer?.toLowerCase() === address.toLowerCase() &&
          stored.listingId === listingId.toString()
        ) {
          const storedOrder: any = await readOrder(BigInt(stored.orderId));
          if (storedOrder) {
            const state = Number(storedOrder.state);
            if (state === COMPLETED) return markComplete(BigInt(stored.orderId));
            if ((state === PAYMENT_PENDING || state === PAID) && (state === PAID || storedOrder.expiresAt > now)) {
              existing = {
                orderId: BigInt(stored.orderId),
                tokenAmount: storedOrder.tokenAmount,
                grossPayment: storedOrder.grossPayment,
                state,
                expiresAt: storedOrder.expiresAt,
                createHash: stored.createHash,
              };
            }
          }
        }
      }

      if (!existing) {
        const found = await scanActiveOrder(client, listingId, address, now);
        if (found) existing = found;
      }

      if (existing) {
        applyActiveOrder(existing);
        setStatus(`Order #${existing.orderId} ditemukan on-chain. Melanjutkan transaksi yang sama.`);
        await settle(existing.orderId, existing.grossPayment, existing.state, existing.createHash);
        return;
      }

      if (!parsed) {
        setErr("Jumlah token tidak valid.");
        return;
      }
      if (parsed < minOrderAmount || parsed > maxOrderAmount) {
        setErr(`Jumlah harus antara ${min} dan ${max} ${symbol}.`);
        return;
      }
      if (parsed > available) {
        setErr(`Jumlah melebihi inventory tersedia (${avail} ${symbol}).`);
        return;
      }

      const gross = preview;
      if (gross <= 0n) {
        setErr("Nilai pembayaran terlalu kecil.");
        return;
      }
      if ((await readBalance()) < gross) {
        setErr(`Saldo ${paymentSymbol} tidak cukup. Dibutuhkan ${formatUnits(gross, paymentDecimals)} ${paymentSymbol}.`);
        return;
      }

      setStep("creating");
      setStatus(`Konfirmasi pembuatan order ${formatUnits(parsed, tokenDecimals)} ${symbol} di wallet…`);

      const createHash = await writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "createOrder",
        args: [listingId, parsed],
      });
      setTx({ create: createHash });

      const receipt = await waitReceipt(client, createHash);
      const createdId = createdOrderIdFromReceipt(receipt, listingId, address);
      if (createdId === null) {
        throw new Error("Create Order berhasil, tetapi OrderCreated event tidak ditemukan pada receipt. Tidak mengirim order kedua.");
      }

      await settle(createdId, gross, PAYMENT_PENDING, createHash, receipt.blockNumber);
    } catch (error) {
      setErr(errorText(error));
      setStep("idle");
    } finally {
      flowStartedRef.current = false;
      setFlowStarted(false);
    }
  };

  const createLink = tx.create ? `${BASESCAN_TX}${tx.create}` : "";
  const approveLink = tx.approve ? `${BASESCAN_TX}${tx.approve}` : "";
  const fundLink = tx.fund ? `${BASESCAN_TX}${tx.fund}` : "";
  const completeLink = tx.complete ? `${BASESCAN_TX}${tx.complete}` : "";

  const createDone = Boolean(tx.create || activeOrder || orderId);
  const approveDone = approvalReady || step === "success";
  const fundDone = fundPhase === "confirmed" || Boolean(activeOrder?.state === PAID) || step === "success";
  const completeDone = completePhase === "confirmed" || step === "success";
  const buttonLabel = checking
    ? "Checking order…"
    : busy
      ? step === "creating"
        ? "Creating order…"
        : step === "approving"
          ? "Approving payment…"
          : step === "funding"
            ? "Funding escrow…"
            : "Completing order…"
      : "BUY";

  const txAddress = (hash?: `0x${string}`) => {
    if (!hash) return null;
    return (
      <a
        className="escrow-tx-address"
        href={`${BASESCAN_TX}${hash}`}
        target="_blank"
        rel="noreferrer"
        title={hash}
        aria-label={`Open transaction ${hash} on BaseScan`}
      >
        <span>{hashShort(hash)}</span>
        <span className="escrow-tx-external" aria-hidden="true">↗</span>
      </a>
    );
  };

  return (
    <div className="buy-modal-overlay">
      <div className="buy-modal">
        <div className="buy-modal-header">
          <div>
            <span className="buy-modal-kicker">ESCROW PURCHASE</span>
            <h2>Buy {symbol}</h2>
            <p>
              {checking
                ? "Checking active order…"
                : activeOrder
                  ? `Order #${activeOrder.orderId} · ${activeOrder.state === PAID ? "PAID in escrow" : "PAYMENT PENDING"}`
                  : `${formatUnits(price, paymentDecimals)} ${paymentSymbol} / ${symbol}`}
            </p>
          </div>
          <button onClick={onClose} disabled={busy} className="buy-modal-close" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="buy-order-summary">
          <div>
            <span>Order amount</span>
            <strong>{amount} {symbol}</strong>
          </div>
          <div>
            <span>Unit price</span>
            <strong>{formatUnits(price, paymentDecimals)} {paymentSymbol}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>{formatUnits(display, paymentDecimals)} {paymentSymbol}</strong>
          </div>
        </div>

        <label className="buy-input-label">Jumlah {symbol}</label>
        <div className="buy-input-wrap">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={busy || Boolean(activeOrder)}
            inputMode="decimal"
          />
          <span>{symbol}</span>
        </div>

        <div className="buy-balance-grid">
          <div>
            <span>Available</span>
            <strong>{avail} {symbol}</strong>
          </div>
          <div>
            <span>Wallet balance</span>
            <strong>{balance === undefined ? "—" : `${formatUnits(balance, paymentDecimals)} ${paymentSymbol}`}</strong>
          </div>
        </div>

        <div className="escrow-flow">
          <div className="escrow-flow-head">
            <div>
              <span className="buy-section-kicker">ESCROW FLOW</span>
              <strong>On-chain order lifecycle</strong>
            </div>
            <span className="escrow-network">Base Sepolia</span>
          </div>

          <div className={`escrow-step ${createDone ? "done" : step === "creating" ? "active" : "pending"}`}>
            <span className="escrow-index">1</span>
            <div><strong>Create Order</strong><small>Escrow locks seller inventory</small></div>
            <b>{createDone ? txAddress(tx.create) ?? "ON-CHAIN" : step === "creating" ? "…" : "WAIT"}</b>
          </div>
          <div className={`escrow-step ${approveDone ? "done" : step === "approving" ? "active" : "pending"}`}>
            <span className="escrow-index">2</span>
            <div><strong>Approve {paymentSymbol}</strong><small>Allow Escrow to spend payment</small></div>
            <b>{approveDone ? txAddress(tx.approve) ?? "ALLOWANCE OK" : step === "approving" ? "…" : "WAIT"}</b>
          </div>
          <div className={`escrow-step ${fundDone ? "done" : step === "funding" ? "active" : "pending"}`}>
            <span className="escrow-index">3</span>
            <div><strong>Fund Escrow</strong><small>Payment moves into escrow</small></div>
            <b>{fundDone ? txAddress(tx.fund) ?? "ON-CHAIN" : step === "funding" ? "…" : "WAIT"}</b>
          </div>
          <div className={`escrow-step ${completeDone ? "done" : step === "completing" ? "active" : "pending"}`}>
            <span className="escrow-index">4</span>
            <div><strong>Complete Order</strong><small>Token released to buyer · auto-release after 24h</small></div>
            <b>{completeDone ? txAddress(tx.complete) ?? "ON-CHAIN" : step === "completing" ? "…" : "WAIT"}</b>
          </div>
        </div>

        <div className="escrow-timing">
          <span>Payment window</span><strong>15 minutes</strong>
          <span>Auto-release window</span><strong>24 hours after payment</strong>
        </div>

        {status && <div className="buy-status">{status}</div>}
        {err && <div className="buy-error">{err}</div>}
        {expiredOrderId && (
          <div className="buy-warning">
            Order #{expiredOrderId} expired. Inventory yang terkunci dilepas kembali setelah <code>expireOrder()</code> diproses.
          </div>
        )}

        <div className="buy-actions">
          <button onClick={buy} disabled={busy || checking || !isConnected} className="buy-submit">
            {buttonLabel}
          </button>
        </div>

        {(createLink || approveLink || fundLink || completeLink) && (
          <div className="buy-tx-list">
            <div className="buy-tx-list-title">On-chain transactions</div>
            {createLink && <a href={createLink} target="_blank" rel="noreferrer">Create · {hashShort(tx.create!)}</a>}
            {approveLink && <a href={approveLink} target="_blank" rel="noreferrer">Approve · {hashShort(tx.approve!)}</a>}
            {fundLink && (
              <a href={fundLink} target="_blank" rel="noreferrer">
                Fund · {hashShort(tx.fund!)}
                <span className={`buy-tx-state ${fundPhase}`}>{phaseLabel(fundPhase)}</span>
              </a>
            )}
            {completeLink && (
              <a href={completeLink} target="_blank" rel="noreferrer">
                Complete · {hashShort(tx.complete!)}
                <span className={`buy-tx-state ${completePhase}`}>{phaseLabel(completePhase)}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
