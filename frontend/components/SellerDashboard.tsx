"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, formatEther, formatUnits, isAddress, keccak256, parseUnits } from "viem";
import { useAccount, useBalance, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_MAINNET_USDC_ADDRESS,
  escrowAbi,
  registryAbi,
  sellerRegistryAbi,
  erc20MetadataAbi,
  USTETU_ESCROW_ADDRESS,
  USTETU_REGISTRY_ADDRESS,
  USTETU_SELLER_REGISTRY_ADDRESS,
  USTETU_BOOTSTRAP_LISTING_ID,
  USTETU_TOKEN_ID
} from "@/lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";
const LISTING_STATUS = { ACTIVE: 0, PAUSED: 1, CLOSED: 2 } as const;
const orderLookupAbi = [{
  type: "function", name: "getOrder", stateMutability: "view", inputs: [{ name: "orderId", type: "uint256" }],
  outputs: [{ name: "order", type: "tuple", components: [
    { name: "listingId", type: "uint256" }, { name: "buyer", type: "address" }, { name: "seller", type: "address" },
    { name: "recipient", type: "address" }, { name: "token", type: "address" }, { name: "paymentToken", type: "address" },
    { name: "tokenAmount", type: "uint256" }, { name: "unitPrice", type: "uint256" }, { name: "grossPayment", type: "uint256" },
    { name: "marketplaceFee", type: "uint256" }, { name: "sellerProceeds", type: "uint256" }, { name: "state", type: "uint8" },
    { name: "createdAt", type: "uint64" }, { name: "paidAt", type: "uint64" }, { name: "completedAt", type: "uint64" }, { name: "expiresAt", type: "uint64" }
  ] }]
}] as const;
const tokenMetadataLookupAbi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;
const tokenApprovalAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }
] as const;

function short(value?: string) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—"; }
function tokenIdFor(address: `0x${string}`) {
  return keccak256(encodeAbiParameters(
    [{ type: "string" }, { type: "uint256" }, { type: "address" }],
    ["USTETU_TOKEN_V1", BigInt(BASE_MAINNET_CHAIN_ID), address]
  ));
}

function generateListingId(): bigint {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random generator tidak tersedia di browser.");
  }

  const words = new Uint32Array(4);
  crypto.getRandomValues(words);

  let id = 0n;
  for (const word of words) {
    id = (id << 32n) | BigInt(word);
  }

  return id === 0n ? 1n : id;
}

export default function SellerDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const basePublicClient = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const baseBalanceQuery = useBalance({
    address,
    chainId: base.id,
    query: { enabled: !!address }
  });

  const [activeListingId, setActiveListingId] = useState<bigint | null>(null);
  const [generatedListingId, setGeneratedListingId] = useState<bigint | null>(null);
  const [listingTokenAddress, setListingTokenAddress] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingInventory, setListingInventory] = useState("");
  const [listingMin, setListingMin] = useState("");
  const [listingMax, setListingMax] = useState("");
  const [amount, setAmount] = useState("1");
  const [newPrice, setNewPrice] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxOrder, setMaxOrder] = useState("");
  const [withdrawalWallet, setWithdrawalWallet] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registerGasCost, setRegisterGasCost] = useState<bigint | null>(null);
  const [registerGasLoading, setRegisterGasLoading] = useState(false);
  const [lockedOrders, setLockedOrders] = useState<Array<{
    id: bigint; buyer: string; tokenAmount: bigint; state: number; expiresAt: bigint; tokenSymbol: string; tokenDecimals: number;
  }>>([]);
  const [lockedOrdersLoading, setLockedOrdersLoading] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"create" | "inventory" | "settings" | "earnings" | "wallet">("create");

  const registeredQuery = useReadContract({
    address: USTETU_SELLER_REGISTRY_ADDRESS,
    abi: sellerRegistryAbi,
    functionName: "isRegisteredSeller",
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });
  const sellerQuery = useReadContract({
    address: USTETU_SELLER_REGISTRY_ADDRESS,
    abi: sellerRegistryAbi,
    functionName: "getSeller",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!registeredQuery.data, retry: false }
  });
  const listingQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "getListing",
    args: activeListingId !== null ? [activeListingId] : undefined,
    query: { enabled: activeListingId !== null }
  });
  const paymentTokenQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "paymentToken"
  });
  const paymentDecimalsQuery = useReadContract({
    address: paymentTokenQuery.data,
    abi: erc20MetadataAbi,
    functionName: "decimals",
    query: { enabled: !!paymentTokenQuery.data }
  });
  const claimableQuery = useReadContract({
    address: USTETU_ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "claimable",
    args: address && paymentTokenQuery.data ? [address, paymentTokenQuery.data] : undefined,
    query: { enabled: !!address && !!paymentTokenQuery.data }
  });
  const tokenInfoQuery = useReadContract({
    address: USTETU_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "getToken",
    args: listingQuery.data ? [`0x${listingQuery.data.tokenId.toString(16).padStart(64, "0")}` as `0x${string}`] : undefined,
    query: { enabled: !!listingQuery.data }
  });
  const tokenMetadataQuery = useReadContract({
    address: tokenInfoQuery.data?.contractAddress,
    abi: erc20MetadataAbi,
    functionName: "symbol",
    query: { enabled: !!tokenInfoQuery.data?.contractAddress }
  });
  const tokenDecimalsQuery = useReadContract({
    address: tokenInfoQuery.data?.contractAddress,
    abi: erc20MetadataAbi,
    functionName: "decimals",
    query: { enabled: !!tokenInfoQuery.data?.contractAddress }
  });
  const createTokenAddress = isAddress(listingTokenAddress) ? listingTokenAddress as `0x${string}` : undefined;
  const createTokenId = createTokenAddress ? tokenIdFor(createTokenAddress) : undefined;
  const createTokenInfoQuery = useReadContract({
    address: USTETU_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "getToken",
    args: createTokenId ? [createTokenId] : undefined,
    query: { enabled: !!createTokenId }
  });
  const createTokenSymbolQuery = useReadContract({
    address: createTokenAddress,
    abi: erc20MetadataAbi,
    functionName: "symbol",
    query: { enabled: !!createTokenAddress }
  });
  const createTokenDecimalsQuery = useReadContract({
    address: createTokenAddress,
    abi: erc20MetadataAbi,
    functionName: "decimals",
    query: { enabled: !!createTokenAddress }
  });
  const tokenBalanceQuery = useReadContract({
    address: tokenInfoQuery.data?.contractAddress,
    abi: tokenApprovalAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenInfoQuery.data?.contractAddress }
  });
  const tokenAllowanceQuery = useReadContract({
    address: tokenInfoQuery.data?.contractAddress,
    abi: tokenApprovalAbi,
    functionName: "allowance",
    args: address && tokenInfoQuery.data?.contractAddress ? [address, USTETU_ESCROW_ADDRESS] : undefined,
    query: { enabled: !!address && !!tokenInfoQuery.data?.contractAddress }
  });
  const pendingWalletQuery = useReadContract({
    address: USTETU_SELLER_REGISTRY_ADDRESS,
    abi: sellerRegistryAbi,
    functionName: "getPendingWithdrawalWallet",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!registeredQuery.data }
  });

  const listing = listingQuery.data;
  const seller = sellerQuery.data;
  const paymentToken = paymentTokenQuery.data;
  const paymentDecimals = Number(paymentDecimalsQuery.data ?? 6);
  const paymentSymbol = paymentToken && paymentToken.toLowerCase() === BASE_MAINNET_USDC_ADDRESS.toLowerCase() ? "USDC" : paymentToken ? short(paymentToken) : "PAYMENT";
  const tokenAddress = tokenInfoQuery.data?.contractAddress;
  const tokenDecimals = Number(tokenInfoQuery.data?.decimalsSnapshot ?? tokenDecimalsQuery.data ?? 18);
  const tokenSymbol = tokenMetadataQuery.data ?? "TOKEN";
  const createTokenRegistered = !!createTokenInfoQuery.data?.contractAddress && createTokenAddress ? createTokenInfoQuery.data.contractAddress.toLowerCase() === createTokenAddress.toLowerCase() : false;
  const createTokenSymbol = createTokenSymbolQuery.data ?? "TOKEN";
  const createTokenDecimals = Number(createTokenInfoQuery.data?.decimalsSnapshot ?? createTokenDecimalsQuery.data ?? 18);
  const createTokenMetadataReady = !!createTokenAddress && !!createTokenSymbolQuery.data && createTokenDecimalsQuery.data !== undefined;
  const available = listing ? listing.inventoryDeposited - listing.inventoryLocked : 0n;
  const claimable = claimableQuery.data ?? 0n;
  const tokenBalance = tokenBalanceQuery.data ?? 0n;
  const tokenAllowance = tokenAllowanceQuery.data ?? 0n;
  const status = listing ? Number(listing.status) : 0;
  const statusLabel = status === LISTING_STATUS.ACTIVE ? "ACTIVE" : status === LISTING_STATUS.PAUSED ? "PAUSED" : status === LISTING_STATUS.CLOSED ? "CLOSED" : "—";
  const pendingWallet = pendingWalletQuery.data as `0x${string}` | undefined;
  const effectiveAt = seller?.withdrawalWalletChangeEffectiveAt ? Number(seller.withdrawalWalletChangeEffectiveAt) : 0;
  const pendingActive = !!pendingWallet && pendingWallet !== ZERO;
  const canActivate = pendingActive && effectiveAt > 0 && Date.now() >= effectiveAt * 1000;
  const isListingOwner = !!address && !!listing?.seller && listing.seller.toLowerCase() === address.toLowerCase();
  const isUstetuListing = !!listing && 
    `0x${listing.tokenId.toString(16).padStart(64, "0")}`.toLowerCase() === USTETU_TOKEN_ID.toLowerCase();

  useEffect(() => {
    if (registeredQuery.data && activeListingId === null) {
      setActiveListingId(USTETU_BOOTSTRAP_LISTING_ID);
    }
  }, [registeredQuery.data, activeListingId]);

  useEffect(() => {
    if (seller?.withdrawalWallet) setWithdrawalWallet(seller.withdrawalWallet);
    if (listing) {
      setNewPrice(formatUnits(listing.price, paymentDecimals));
      setMinOrder(formatUnits(listing.minOrderAmount, tokenDecimals));
      setMaxOrder(formatUnits(listing.maxOrderAmount, tokenDecimals));
    }
  }, [seller?.withdrawalWallet, listing, paymentDecimals, tokenDecimals]);


  useEffect(() => {
    let cancelled = false;

    const checkRegisterGas = async () => {
      if (!address || !basePublicClient || registeredQuery.data) {
        setRegisterGasCost(null);
        setRegisterGasLoading(false);
        return;
      }

      setRegisterGasLoading(true);
      try {
        const gas = await basePublicClient.estimateContractGas({
          address: USTETU_SELLER_REGISTRY_ADDRESS,
          abi: sellerRegistryAbi,
          functionName: "registerSeller",
          args: [address],
          account: address
        });
        const gasPrice = await basePublicClient.getGasPrice();
        const estimatedCost = (gas * gasPrice * 120n) / 100n;

        if (!cancelled) setRegisterGasCost(estimatedCost);
      } catch {
        if (!cancelled) setRegisterGasCost(null);
      } finally {
        if (!cancelled) setRegisterGasLoading(false);
      }
    };

    void checkRegisterGas();
    return () => { cancelled = true; };
  }, [address, basePublicClient, registeredQuery.data]);

  const refresh = () => {
    void listingQuery.refetch();
    void sellerQuery.refetch();
    void registeredQuery.refetch();
    void claimableQuery.refetch();
    void tokenInfoQuery.refetch();
    void tokenBalanceQuery.refetch();
    void tokenAllowanceQuery.refetch();
    void pendingWalletQuery.refetch();
  };

  const ensureBase = async () => {
    if (!address) throw new Error("Connect wallet terlebih dahulu.");
    if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
  };

  const ensureSeller = async () => {
    await ensureBase();
    if (!registeredQuery.data) throw new Error("Wallet belum terdaftar sebagai seller.");
  };

  const loadLockedOrders = async () => {
    try {
      await ensureSeller();
      if (!publicClient || activeListingId === null || !listing || !isListingOwner) {
        throw new Error("Listing USTETU belum tersedia untuk wallet ini.");
      }

      setLockedOrdersLoading(true);
      setError("");
      const matches: typeof lockedOrders = [];

      // PublicNode/Base RPC dapat menolak eth_getLogs untuk event filters.
      // Untuk lookup ini kita baca order state langsung agar tidak bergantung pada archive/log indexing.
      const MAX_ORDER_ID_SCAN = 200;
      const BATCH_SIZE = 50;

      for (let startId = 1; startId <= MAX_ORDER_ID_SCAN; startId += BATCH_SIZE) {
        const ids = Array.from(
          { length: Math.min(BATCH_SIZE, MAX_ORDER_ID_SCAN - startId + 1) },
          (_, i) => BigInt(startId + i)
        );

        const results = await publicClient.multicall({
          contracts: ids.map((orderId) => ({
            address: USTETU_ESCROW_ADDRESS,
            abi: orderLookupAbi,
            functionName: "getOrder" as const,
            args: [orderId]
          })),
          allowFailure: true
        });

        for (let i = 0; i < results.length; i += 1) {
          const result = results[i];
          if (result.status !== "success" || !result.result) continue;

          const order = result.result;
          if (
            order.listingId !== activeListingId ||
            order.seller.toLowerCase() !== address!.toLowerCase() ||
            order.tokenAmount === 0n ||
            order.state === 2 ||
            order.state === 3
          ) continue;

          let tokenSymbol = "UST";
          let tokenDecimals = 18;
          try {
            const [symbol, decimals] = await Promise.all([
              publicClient.readContract({
                address: order.token,
                abi: tokenMetadataLookupAbi,
                functionName: "symbol"
              }),
              publicClient.readContract({
                address: order.token,
                abi: tokenMetadataLookupAbi,
                functionName: "decimals"
              })
            ]);
            tokenSymbol = symbol || tokenSymbol;
            tokenDecimals = Number(decimals);
          } catch {}

          matches.push({
            id: ids[i],
            buyer: order.buyer,
            tokenAmount: order.tokenAmount,
            state: Number(order.state),
            expiresAt: order.expiresAt,
            tokenSymbol,
            tokenDecimals
          });
        }
      }

      matches.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
      setLockedOrders(matches);

      if (!matches.length) {
        setMessage("Tidak ditemukan order aktif untuk listing USTETU pada 200 Order ID pertama.");
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(text.length > 300 ? `${text.slice(0, 300)}…` : text);
    } finally {
      setLockedOrdersLoading(false);
    }
  };

  const transact = async (label: string, fn: () => Promise<`0x${string}`>) => {
    setBusy(label); setError(""); setMessage("");
    try {
      const hash = await fn();
      setMessage(`${label} terkirim: ${short(hash)}`);
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`${label} gagal atau di-revert.`);
        setMessage(`${label} berhasil: ${short(hash)}`);
      }
      refresh();
      return hash;
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(text.length > 300 ? `${text.slice(0, 300)}…` : text);
      throw e;
    } finally { setBusy(""); }
  };

  const register = async () => {
    try {
      await ensureBase();
      if (!address) return;

      const balance = baseBalanceQuery.data?.value ?? 0n;
      if (registerGasCost !== null && balance < registerGasCost) {
        throw new Error("Saldo ETH di Base tidak cukup untuk biaya gas Register Seller.");
      }
      if (registerGasCost === null) {
        throw new Error("Estimasi biaya gas belum tersedia. Tunggu sebentar lalu coba lagi.");
      }

      await transact("Register seller", () => writeContractAsync({
        address: USTETU_SELLER_REGISTRY_ADDRESS,
        abi: sellerRegistryAbi,
        functionName: "registerSeller",
        args: [address]
      }));
    } catch {}
  };

  const createListing = async () => {
    try {
      await ensureSeller();
      if (!isAddress(listingTokenAddress)) throw new Error("Token contract address tidak valid.");
      const token = listingTokenAddress as `0x${string}`;
      if (!publicClient) throw new Error("RPC client belum tersedia.");

      let id: bigint | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateListingId();
        const existing = await publicClient.readContract({
          address: USTETU_ESCROW_ADDRESS,
          abi: escrowAbi,
          functionName: "getListing",
          args: [candidate]
        });

        if (!existing.seller || existing.seller.toLowerCase() === ZERO.toLowerCase()) {
          id = candidate;
          break;
        }
      }

      if (id === null) {
        throw new Error("Gagal mendapatkan Listing ID unik. Silakan coba lagi.");
      }

      setGeneratedListingId(id);
      const price = parseUnits(listingPrice || "0", paymentDecimals);

      const tokenId = tokenIdFor(token);
      const registeredToken = await publicClient.readContract({
        address: USTETU_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "getToken",
        args: [tokenId]
      });
      if (
        !registeredToken.contractAddress ||
        registeredToken.contractAddress.toLowerCase() !== token.toLowerCase()
      ) {
        throw new Error("Token belum terdaftar di USTETU Registry atau contract address tidak cocok.");
      }
      const decimals = Number(registeredToken.decimalsSnapshot);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error("Decimals token dari Registry tidak valid.");
      }
      const inventory = parseUnits(listingInventory || "0", decimals);
      const min = parseUnits(listingMin || "0", decimals);
      const max = parseUnits(listingMax || "0", decimals);
      if (price <= 0n || inventory <= 0n || min <= 0n || max < min) throw new Error("Parameter listing tidak valid.");

      const allowance = await publicClient?.readContract({
        address: token,
        abi: tokenApprovalAbi,
        functionName: "allowance",
        args: [address!, USTETU_ESCROW_ADDRESS]
      });
      if ((allowance ?? 0n) < inventory) {
        await transact("Approve listing inventory", () => writeContractAsync({
          address: token,
          abi: tokenApprovalAbi,
          functionName: "approve",
          args: [USTETU_ESCROW_ADDRESS, inventory]
        }));
      }

      await transact("Create listing", () => writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "createListingAndDeposit",
        args: [id, tokenId, address!, price, inventory, min, max]
      }));
      setActiveListingId(id);
      setMessage(`Listing #${id} berhasil dibuat.`);
    } catch {}
  };

  const addInventory = async () => {
    try {
      await ensureSeller();
      if (!listing || !tokenAddress || !isListingOwner) throw new Error("Listing tidak ditemukan atau bukan milik wallet ini.");
      const raw = parseUnits(amount || "0", tokenDecimals);
      if (raw <= 0n) throw new Error("Jumlah inventory harus lebih dari 0.");
      if (tokenAllowance < raw) {
        await transact("Approve inventory", () => writeContractAsync({
          address: tokenAddress,
          abi: tokenApprovalAbi,
          functionName: "approve",
          args: [USTETU_ESCROW_ADDRESS, raw]
        }));
      }
      await transact("Add inventory", () => writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "addListingInventory",
        args: [activeListingId!, raw]
      }));
    } catch {}
  };

  const withdrawInventory = async () => {
    try {
      await ensureSeller();
      if (!listing || !isListingOwner) throw new Error("Listing tidak ditemukan atau bukan milik wallet ini.");
      const raw = parseUnits(amount || "0", tokenDecimals);
      if (raw <= 0n || raw > available) throw new Error("Jumlah withdrawal melebihi inventory tersedia.");
      await transact("Withdraw inventory", () => writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "withdrawListingInventory",
        args: [activeListingId!, raw]
      }));
    } catch {}
  };

  const updatePrice = async () => {
    try {
      await ensureSeller();
      if (!listing || !isListingOwner) throw new Error("Listing tidak ditemukan atau bukan milik wallet ini.");
      const raw = parseUnits(newPrice || "0", paymentDecimals);
      if (raw <= 0n) throw new Error("Harga harus lebih dari 0.");
      await transact("Update price", () => writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "updateListingPrice",
        args: [activeListingId!, raw]
      }));
    } catch {}
  };

  const updateLimits = async () => {
    try {
      await ensureSeller();
      if (!listing || !isListingOwner) throw new Error("Listing tidak ditemukan atau bukan milik wallet ini.");
      const min = parseUnits(minOrder || "0", tokenDecimals);
      const max = parseUnits(maxOrder || "0", tokenDecimals);
      if (min <= 0n || max < min) throw new Error("Limit order tidak valid.");
      await transact("Update limits", () => writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "updateListingOrderLimits",
        args: [activeListingId!, min, max]
      }));
    } catch {}
  };

  const listingAction = async (functionName: "pauseListing" | "resumeListing" | "closeListing") => {
    try {
      await ensureSeller();
      if (!listing || !isListingOwner) throw new Error("Listing tidak ditemukan atau bukan milik wallet ini.");
      await transact(functionName, () => writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName,
        args: [activeListingId!]
      }));
    } catch {}
  };

  const withdrawEarnings = async () => {
    try {
      await ensureSeller();
      if (claimable === 0n) throw new Error("Tidak ada claimable USDC.");
      await transact("Withdraw earnings", () => writeContractAsync({
        address: USTETU_ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "withdrawClaimable",
        args: []
      }));
    } catch {}
  };

  const requestWallet = async () => {
    try {
      await ensureSeller();
      if (!isAddress(withdrawalWallet)) throw new Error("Withdrawal wallet tidak valid.");
      await transact("Request wallet change", () => writeContractAsync({
        address: USTETU_SELLER_REGISTRY_ADDRESS,
        abi: sellerRegistryAbi,
        functionName: "requestWithdrawalWalletChange",
        args: [withdrawalWallet as `0x${string}`]
      }));
    } catch {}
  };

  const activateWallet = async () => {
    try {
      await ensureSeller();
      await transact("Activate withdrawal wallet", () => writeContractAsync({
        address: USTETU_SELLER_REGISTRY_ADDRESS,
        abi: sellerRegistryAbi,
        functionName: "activateWithdrawalWalletChange"
      }));
    } catch {}
  };

  const disabled = !!busy;
  return (
    <section className="seller-dashboard">
      <style jsx global>{`
        .seller-dashboard{max-width:1180px;margin:0 auto;padding:34px 22px 70px;color:#f4f7ff}
        .seller-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:26px}.seller-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#8fa5c4;opacity:.9}.seller-head h1{margin:2px 0 12px;font-size:28px;line-height:1.05;letter-spacing:-.03em;font-weight:760;background:linear-gradient(135deg,#fff 20%,#cddcff 55%,#91a9ff);-webkit-background-clip:text;background-clip:text;color:transparent}.seller-head p{margin:0;color:#8290a7;font-size:13px}.seller-wallet{font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;color:#71809a;padding:7px 10px;border:1px solid rgba(132,160,205,.14);border-radius:9px;background:#0b1120}

        .seller-overview-shell{position:relative;overflow:hidden;border:1px solid rgba(128,157,205,.16);background:radial-gradient(circle at 85% 0%,rgba(91,107,255,.08),transparent 34%),linear-gradient(145deg,#0d1424 0%,#090e1a 58%,#080c16 100%);border-radius:18px;padding:10px 14px 14px;margin-bottom:12px;box-shadow:0 18px 45px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.045)}.seller-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0 0 10px;border-bottom:1px solid rgba(127,153,196,.10)}.seller-summary-item{min-width:0;padding:8px 10px}.seller-summary-item label{display:block;font-size:6px;text-transform:uppercase;letter-spacing:.12em;color:#7888a2}.seller-summary-item .seller-value{font-size:12px;margin-top:2px}.seller-summary-item .seller-sub{font-size:7px;margin-top:2px}.seller-overview{padding:10px 2px 0}.seller-overview-head{display:flex;justify-content:space-between;align-items:center;gap:14px}.seller-overview-head h2{margin:0;font-size:14px}.seller-overview-head>div>span{display:block;margin-top:3px;color:#68768d;font-size:8px}.seller-overview-listing{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}.seller-overview-item{padding:9px 10px;border:1px solid rgba(127,153,196,.11);border-radius:10px;background:rgba(255,255,255,.018)}.seller-overview-item span{display:block;font-size:7px;text-transform:uppercase;letter-spacing:.1em;color:#71819b}.seller-overview-item strong{display:block;margin-top:3px;font-size:11px}.seller-overview-item small{display:block;margin-top:2px;color:#68768d;font-size:7px}
        .seller-card{position:relative;overflow:hidden;border:1px solid rgba(128,157,205,.16);background:radial-gradient(circle at 85% 0%,rgba(91,107,255,.10),transparent 34%),linear-gradient(145deg,#0d1424 0%,#090e1a 58%,#080c16 100%);border-radius:18px;padding:19px;box-shadow:0 18px 45px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.045);transition:transform 180ms ease,border-color 180ms ease,box-shadow 180ms ease}
        .seller-card::before{content:"";position:absolute;inset:0 0 auto 0;height:1px;background:linear-gradient(90deg,transparent,rgba(154,181,255,.42),transparent);opacity:.7;pointer-events:none}
        .seller-card:hover{transform:translateY(-2px);border-color:rgba(132,164,228,.28);box-shadow:0 22px 55px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.06)}
        .seller-card label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.17em;color:#7888a2}.seller-value{font-size:24px;font-weight:760;margin-top:9px;letter-spacing:-.02em}.seller-sub{font-size:11px;color:#69778e;margin-top:5px}.seller-ok{color:#72f0ae;text-shadow:0 0 18px rgba(114,240,174,.14)}.seller-warn{color:#ffd166}

        .seller-two{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.seller-section{margin-bottom:16px}.seller-section h2{font-size:15px;margin:0 0 13px;color:#eef3fb;letter-spacing:-.01em}.seller-listing-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.seller-token{display:flex;align-items:center;gap:12px}.seller-token-mark{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-weight:900;font-size:20px;background:linear-gradient(145deg,#17213c,#263a72 52%,#6955d8);border:1px solid rgba(156,181,255,.25);box-shadow:0 10px 28px rgba(45,64,150,.25),inset 0 1px rgba(255,255,255,.14)}.seller-status{font-size:10px;border:1px solid rgba(117,247,174,.25);padding:7px 10px;border-radius:999px;color:#75f7ae;background:rgba(117,247,174,.045)}.seller-status.paused{border-color:rgba(255,209,102,.28);color:#ffd166;background:rgba(255,209,102,.04)}.seller-status.closed{border-color:rgba(255,100,100,.28);color:#ff7b8a;background:rgba(255,100,100,.04)}

        .seller-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:18px}.seller-stat{background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018));border:1px solid rgba(139,163,205,.09);border-radius:12px;padding:12px}.seller-stat span{display:block;font-size:9px;color:#71819b;text-transform:uppercase;letter-spacing:.1em}.seller-stat strong{display:block;margin-top:6px;color:#dce6f5;font-size:13px}

        .seller-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.seller-actions button,.seller-form button,.seller-card>button{border:1px solid rgba(133,160,210,.16);background:linear-gradient(145deg,rgba(28,40,65,.88),rgba(13,19,32,.96));color:#dce6f5;border-radius:10px;padding:10px 13px;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.045),0 6px 18px rgba(0,0,0,.16);transition:transform 160ms ease,border-color 160ms ease,background 160ms ease,box-shadow 160ms ease}.seller-actions button:hover,.seller-form button:hover,.seller-card>button:hover{background:linear-gradient(145deg,rgba(40,57,91,.95),rgba(16,24,40,.98));border-color:rgba(143,174,232,.32);transform:translateY(-1px);box-shadow:inset 0 1px rgba(255,255,255,.06),0 9px 24px rgba(0,0,0,.22)}.seller-actions button:disabled,.seller-form button:disabled,.seller-card>button:disabled{opacity:.42;cursor:not-allowed;transform:none}.danger{border-color:rgba(255,100,100,.28)!important;color:#ff9aa4!important}.primary{border-color:rgba(117,247,174,.28)!important;color:#a8ffd0!important;background:linear-gradient(145deg,rgba(22,70,54,.62),rgba(12,29,27,.96))!important}

        .seller-form{display:grid;gap:9px}.seller-form label{font-size:10px;color:#7888a2;letter-spacing:.08em;text-transform:uppercase}.seller-auto-id{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 13px;border:1px solid rgba(117,247,174,.15);border-radius:12px;background:linear-gradient(145deg,rgba(117,247,174,.055),rgba(255,255,255,.018))}.seller-auto-id span{display:block;font-size:9px;color:#71819b;text-transform:uppercase;letter-spacing:.14em}.seller-auto-id strong{display:block;margin-top:4px;color:#8ff6ba;font-size:12px;letter-spacing:.08em}.seller-auto-id small{display:block;margin-top:4px;color:#65738a;font-size:10px;line-height:1.45}.seller-auto-id-value{font:11px ui-monospace,SFMono-Regular,monospace;color:#cfeedd;white-space:nowrap}.seller-my-listings{display:grid;gap:8px;margin-top:14px}.seller-my-listing{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;text-align:left;padding:12px 14px;border:1px solid rgba(127,153,196,.12);border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.015));color:#dce6f5;cursor:pointer;transition:transform 160ms ease,border-color 160ms ease,background 160ms ease}.seller-my-listing:hover{transform:translateY(-1px);border-color:rgba(143,174,232,.30);background:linear-gradient(145deg,rgba(35,51,82,.65),rgba(12,18,30,.92))}.seller-my-listing.selected{border-color:rgba(117,247,174,.30);background:linear-gradient(145deg,rgba(117,247,174,.065),rgba(12,22,25,.94))}.seller-my-listing>div:first-child{display:grid;gap:3px}.seller-my-listing-label{font-size:8px;letter-spacing:.12em;color:#75f7ae}.seller-my-listing strong{font-size:12px}.seller-my-listing small{font-size:10px;color:#6f7e95}.seller-my-listing-value{text-align:right}.seller-my-listing-value strong{display:block;font:12px ui-monospace,SFMono-Regular,monospace}.seller-my-listing-value small{display:block;margin-top:2px}.seller-form input{width:100%;box-sizing:border-box;border:1px solid rgba(127,153,196,.14);background:#070c16;color:#e8eef8;border-radius:10px;padding:11px 12px;outline:none;box-shadow:inset 0 2px 8px rgba(0,0,0,.18);transition:border-color 160ms ease,box-shadow 160ms ease,background 160ms ease}.seller-form input::placeholder{color:#58667c}.seller-form input:focus{border-color:rgba(122,157,229,.42);background:#090f1b;box-shadow:0 0 0 3px rgba(91,120,196,.08),inset 0 2px 8px rgba(0,0,0,.2)}.seller-inline{display:grid;grid-template-columns:1fr 1fr;gap:9px}.seller-inline>input{width:100%;min-width:0;box-sizing:border-box;border:1px solid rgba(127,153,196,.16);background:linear-gradient(145deg,#0a101c,#070c15);color:#e8eef8;border-radius:11px;padding:11px 13px;outline:none;font-size:12px;box-shadow:inset 0 2px 10px rgba(0,0,0,.22),0 1px 0 rgba(255,255,255,.025);transition:border-color 160ms ease,box-shadow 160ms ease,transform 160ms ease,background 160ms ease}.seller-inline>input::placeholder{color:#56657d}.seller-inline>input:focus{border-color:rgba(111,151,232,.48);background:#090f1b;box-shadow:0 0 0 3px rgba(80,119,202,.08),inset 0 2px 10px rgba(0,0,0,.24);transform:translateY(-1px)}.seller-inline>button{width:100%;min-height:40px;border:1px solid rgba(112,151,226,.24);border-radius:11px;background:linear-gradient(145deg,#182744 0%,#0d1728 55%,#0a111e 100%);color:#dce7f7;font-size:12px;font-weight:650;letter-spacing:.01em;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.055),0 8px 22px rgba(0,0,0,.2);transition:transform 160ms ease,border-color 160ms ease,box-shadow 160ms ease,background 160ms ease}.seller-inline>button:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(133,171,239,.42);background:linear-gradient(145deg,#203456 0%,#101d32 55%,#0b1422 100%);box-shadow:inset 0 1px rgba(255,255,255,.07),0 11px 26px rgba(0,0,0,.25)}.seller-inline>button:disabled{opacity:.42;cursor:not-allowed}.seller-note{font-size:11px;line-height:1.55;color:#68768d}.seller-token-info{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(117,247,174,.12);border-radius:11px;background:rgba(117,247,174,.035);font-size:10px}.seller-token-info span{color:#71819b;text-transform:uppercase;letter-spacing:.1em}.seller-token-info strong{color:#cfeedd;font-size:11px}.seller-token-address{font-family:ui-monospace,SFMono-Regular,monospace!important;text-transform:none!important;letter-spacing:0!important;margin-left:auto}.seller-token-registered{color:#75f7ae!important;text-transform:none!important;letter-spacing:0!important}.seller-message{margin:12px 0;padding:11px 13px;border-radius:10px;background:rgba(117,247,174,.055);border:1px solid rgba(117,247,174,.16);font-size:12px}.seller-error{margin:12px 0;padding:11px 13px;border-radius:10px;background:rgba(255,80,100,.055);border:1px solid rgba(255,80,100,.18);font-size:12px;word-break:break-word}.seller-address{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all}.seller-gas-status{margin:14px 0;display:grid;gap:8px;padding:12px;border:1px solid rgba(127,153,196,.11);border-radius:12px;background:#090f1a}.seller-gas-row{display:flex;justify-content:space-between;gap:14px;font-size:12px}.seller-gas-row span{color:#71809a}.seller-gas-row strong{font-family:ui-monospace,monospace}.seller-gas-state{font-size:11px;line-height:1.45;padding:9px 10px;border-radius:9px;background:rgba(255,209,102,.055);border:1px solid rgba(255,209,102,.14);color:#ffd166}.seller-gas-state.ready{background:rgba(117,247,174,.055);border-color:rgba(117,247,174,.14);color:#75f7ae}
        .seller-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(128,157,205,.14),transparent);margin:15px 0}
        .seller-earnings{border-color:rgba(117,247,174,.18);background:radial-gradient(circle at 100% 0%,rgba(72,190,132,.10),transparent 38%),linear-gradient(145deg,#0d171b 0%,#090f17 58%,#080d15 100%)}
        .seller-earnings .seller-value{font-size:30px;letter-spacing:-.035em}.seller-earnings-meta{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:13px 0;padding:10px 12px;border:1px solid rgba(139,163,205,.10);border-radius:11px;background:rgba(255,255,255,.025)}.seller-earnings-meta span{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#71819b}.seller-earnings-meta strong{font:11px ui-monospace,SFMono-Regular,monospace;color:#dce6f5}.seller-menu{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0 14px;padding:6px;border:1px solid rgba(127,153,196,.12);border-radius:14px;background:linear-gradient(145deg,rgba(14,20,34,.92),rgba(7,11,19,.96));box-shadow:0 10px 28px rgba(0,0,0,.14)}.seller-menu button{flex:1 1 110px;min-height:38px;border:1px solid transparent;border-radius:10px;background:transparent;color:#7f8da4;font-size:11px;font-weight:650;cursor:pointer;transition:.18s}.seller-menu button:hover{color:#dce6f5;background:rgba(255,255,255,.035)}.seller-menu button.active{color:#a8ffd0;border-color:rgba(117,247,174,.18);background:linear-gradient(145deg,rgba(117,247,174,.09),rgba(20,35,32,.7));box-shadow:inset 0 1px rgba(255,255,255,.04)}.seller-page{min-height:180px}.seller-overview{padding:15px 17px}.seller-overview-head{display:flex;justify-content:space-between;align-items:center;gap:14px}.seller-overview-head h2{margin:0}.seller-overview-head>div>span{display:block;margin-top:4px;color:#68768d;font-size:9px}.seller-overview-listing{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.seller-overview-item{padding:10px 11px;border:1px solid rgba(127,153,196,.11);border-radius:10px;background:rgba(255,255,255,.018)}.seller-overview-item span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#71819b}.seller-overview-item strong{display:block;margin-top:4px;font-size:12px}.seller-overview-item small{display:block;margin-top:2px;color:#68768d;font-size:8px}.seller-overview-item span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#71819b}.seller-overview-item strong{display:block;margin-top:5px;font-size:13px}.seller-overview-item small{display:block;margin-top:3px;color:#68768d;font-size:9px}.seller-earnings button.primary{width:100%;min-height:43px;font-weight:700}.seller-locked-orders{margin-top:13px;padding:12px;border:1px solid rgba(139,163,205,.10);border-radius:12px;background:rgba(255,255,255,.018)}.seller-locked-orders-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.seller-locked-orders-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#71819b}.seller-locked-order{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:9px}.seller-locked-order strong{font-size:11px}.seller-locked-order small{display:block;color:#68768d;font-size:9px;margin-top:3px}.seller-locked-state{font-size:9px;color:#ffd166;border:1px solid rgba(255,209,102,.22);border-radius:999px;padding:4px 7px}.seller-view-orders{border:1px solid rgba(112,151,226,.24)!important;background:linear-gradient(145deg,#182744,#0a111e)!important;color:#dce7f7;border-radius:9px;padding:7px 9px;font-size:10px;cursor:pointer}.seller-view-orders:disabled{opacity:.45;cursor:not-allowed}
        @media(max-width:850px){.seller-grid,.seller-two{grid-template-columns:1fr}.seller-stats{grid-template-columns:repeat(2,1fr)}.seller-head{align-items:flex-start;flex-direction:column}.seller-overview-listing{grid-template-columns:repeat(2,1fr)}.seller-grid{grid-template-columns:1fr}.seller-summary-item{padding:7px 9px}.seller-menu{overflow-x:auto;flex-wrap:nowrap}.seller-menu button{flex:0 0 auto;padding:0 13px}}
      `}</style>

      {!isConnected ? (
        <div className="seller-card"><h2>Seller Center</h2><p className="seller-note">Connect wallet untuk membuka Seller Center.</p></div>
      ) : !registeredQuery.data ? (
        <div className="seller-card"><h2>Seller Registration</h2><p className="seller-note">Wallet ini belum terdaftar. Seller registration bersifat permissionless dan membutuhkan sedikit ETH di Base untuk gas.</p>
          <div className="seller-gas-status">
            <div className="seller-gas-row"><span>Base ETH Balance</span><strong>{baseBalanceQuery.isLoading ? "Checking…" : formatEther(baseBalanceQuery.data?.value ?? 0n) + " ETH"}</strong></div>
            <div className="seller-gas-row"><span>Estimated Register Gas</span><strong>{registerGasLoading ? "Estimating…" : registerGasCost !== null ? "~" + formatEther(registerGasCost) + " ETH" : "Unavailable"}</strong></div>
            <div className={"seller-gas-state " + (registerGasCost !== null && (baseBalanceQuery.data?.value ?? 0n) >= registerGasCost ? "ready" : "warning")}>
              {registerGasLoading ? "Checking Base gas balance…" :
                registerGasCost === null ? "Gas estimate belum tersedia. Coba lagi sebentar." :
                (baseBalanceQuery.data?.value ?? 0n) >= registerGasCost ? "✓ Ready — saldo Base cukup untuk registrasi." :
                "⚠ Saldo ETH Base tidak cukup untuk registrasi."}
            </div>
          </div>
          <button onClick={() => void register()} disabled={disabled || chainId !== base.id || registerGasLoading || registerGasCost === null || (baseBalanceQuery.data?.value ?? 0n) < registerGasCost}>{busy || "Register Seller"}</button>
          {error && <div className="seller-error">{error}</div>}</div>
      ) : (
        <>
          <div className="seller-head">
            <h1>Seller Dashboard</h1>
          </div>

          <div className="seller-overview-shell">
            <div className="seller-grid">
              <div className="seller-summary-item"><label>Seller</label><div className="seller-value seller-ok">REGISTERED</div><div className="seller-sub">Permissionless Seller Registry</div></div>
              <div className="seller-summary-item"><label>Claimable USDC</label><div className="seller-value">{formatUnits(claimable, paymentDecimals)} USDC</div><div className="seller-sub">Available proceeds after settlement</div></div>
              <div className="seller-summary-item"><label>Network</label><div className="seller-value">BASE</div><div className="seller-sub">Chain ID {BASE_MAINNET_CHAIN_ID}</div></div>
            </div>
            {activeListingId !== null && listing && (
              <div className="seller-overview">
                <div className="seller-overview-head">
                  <div><h2>{tokenSymbol} / PAYMENT</h2><span>Listing #{activeListingId.toString()} · Base Mainnet</span></div>
                  <span className={`seller-status ${status === LISTING_STATUS.PAUSED ? "paused" : status === LISTING_STATUS.CLOSED ? "closed" : ""}`}>● {statusLabel}</span>
                </div>
                <div className="seller-overview-listing">
                  <div className="seller-overview-item"><span>Price</span><strong>{formatUnits(listing.price, paymentDecimals)}</strong><small>{paymentSymbol} / {tokenSymbol}</small></div>
                  <div className="seller-overview-item"><span>Deposited</span><strong>{formatUnits(listing.inventoryDeposited, tokenDecimals)}</strong><small>{tokenSymbol}</small></div>
                  <div className="seller-overview-item"><span>Available</span><strong>{formatUnits(available, tokenDecimals)}</strong><small>Can withdraw</small></div>
                  <div className="seller-overview-item"><span>Locked</span><strong>{formatUnits(listing.inventoryLocked, tokenDecimals)}</strong><small>Active orders</small></div>
                </div>
              </div>
            )}
          </div>
          <nav className="seller-menu" aria-label="Seller menu">
            {([["create","Create Listing"],["inventory","Inventory"],["settings","Listing Settings"],["earnings","Earnings"],["wallet","Withdrawal Wallet"]] as const).map(([key,label]) => (
              <button key={key} className={activeMenu === key ? "active" : ""} onClick={() => setActiveMenu(key)}>{label}</button>
            ))}
          </nav>

          <div className="seller-page">

          {activeMenu === "create" && (
          <div className="seller-card seller-section">
            <h2>Create Listing</h2>
            <div className="seller-form">
              <div className="seller-form">
                <label>Token Contract</label>
                <input value={listingTokenAddress} onChange={e => setListingTokenAddress(e.target.value)} placeholder="0x..." />
              </div>
              <div className="seller-inline">
                <div><label>Price ({paymentSymbol} / token)</label><input value={listingPrice} onChange={e => setListingPrice(e.target.value)} inputMode="decimal" /></div>
                <div><label>Inventory{createTokenMetadataReady ? ` (${createTokenSymbol})` : ""}</label><input value={listingInventory} onChange={e => setListingInventory(e.target.value)} inputMode="decimal" /></div>
              </div>
              <div className="seller-inline">
                <div><label>Min Order{createTokenMetadataReady ? ` (${createTokenSymbol})` : ""}</label><input value={listingMin} onChange={e => setListingMin(e.target.value)} inputMode="decimal" /></div>
                <div><label>Max Order{createTokenMetadataReady ? ` (${createTokenSymbol})` : ""}</label><input value={listingMax} onChange={e => setListingMax(e.target.value)} inputMode="decimal" /></div>
              </div>
              {createTokenMetadataReady && <div className="seller-token-info"><span>Token</span><strong>{createTokenSymbol}</strong><span>Decimals</span><strong>{createTokenDecimals}</strong><span className="seller-token-address">{short(listingTokenAddress)}</span>{createTokenRegistered && <span className="seller-token-registered">✓ Registered</span>}</div>}
              {createTokenAddress && !createTokenRegistered && <div className="seller-note">Token address belum cocok dengan token yang terdaftar di USTETU Registry.</div>}
              <div className="seller-actions"><button className="primary" disabled={disabled || chainId !== base.id} onClick={() => void createListing()}>Create Listing</button></div>
              <p className="seller-note">Token approval diberikan ke Escrow hanya sebesar inventory yang akan didepositkan.</p>
            </div>
          </div>

          )}

          {activeListingId !== null && listing && (
            <>
              {activeMenu === "inventory" && (
                <div className="seller-card seller-section">
                  <div className="seller-listing-top">
                    <div className="seller-token"><div className="seller-token-mark">T</div><div><strong>{tokenSymbol} / PAYMENT</strong><div className="seller-sub">Listing #{activeListingId.toString()} • Base Mainnet</div></div></div>
                    <span className={`seller-status ${status === LISTING_STATUS.PAUSED ? "paused" : status === LISTING_STATUS.CLOSED ? "closed" : ""}`}>● {statusLabel}</span>
                  </div>
                  <div className="seller-stats">
                    <div className="seller-stat"><span>Deposited</span><strong>{formatUnits(listing.inventoryDeposited, tokenDecimals)} {tokenSymbol}</strong></div>
                    <div className="seller-stat"><span>Available</span><strong>{formatUnits(available, tokenDecimals)} {tokenSymbol}</strong></div>
                    <div className="seller-stat"><span>Locked</span><strong>{formatUnits(listing.inventoryLocked, tokenDecimals)} {tokenSymbol}</strong></div>
                    <div className="seller-stat"><span>Wallet</span><strong>{formatUnits(tokenBalance, tokenDecimals)} {tokenSymbol}</strong></div>
                  </div>
                  {isListingOwner && isUstetuListing && <div className="seller-form" style={{marginTop:14}}>
                    <h2>USTETU Inventory</h2>
                    <p className="seller-note">Hanya inventory yang belum terkunci oleh order yang dapat ditarik.</p>
                    <label>Amount {tokenSymbol}</label>
                    <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="Enter amount" />
                    <div className="seller-actions"><button disabled={disabled || available === 0n} onClick={() => setAmount(formatUnits(available, tokenDecimals))}>Use Max</button><button disabled={disabled} onClick={() => void addInventory()}>Add Inventory</button><button className="primary" disabled={disabled || available === 0n} onClick={() => void withdrawInventory()}>Withdraw USTETU</button></div>
                    <div className="seller-note">Available: {formatUnits(available, tokenDecimals)} {tokenSymbol} · Locked: {formatUnits(listing.inventoryLocked, tokenDecimals)} {tokenSymbol}</div>
                    <div className="seller-locked-orders">
                      <div className="seller-locked-orders-head"><span className="seller-locked-orders-title">Orders locking inventory</span><button className="seller-view-orders" disabled={disabled || lockedOrdersLoading} onClick={() => void loadLockedOrders()}>{lockedOrdersLoading ? "Checking…" : "View Locked Orders"}</button></div>
                      {lockedOrders.map((order) => <div className="seller-locked-order" key={order.id.toString()}><div><strong>Order #{order.id.toString()}</strong><small>Buyer {short(order.buyer)}</small></div><div><strong>{formatUnits(order.tokenAmount, order.tokenDecimals)} {order.tokenSymbol}</strong><small>{order.expiresAt ? `Expires ${new Date(Number(order.expiresAt) * 1000).toLocaleString("id-ID")}` : "No expiry shown"}</small></div><span className="seller-locked-state">{order.state === 0 ? "PAYMENT PENDING" : "PAID"}</span></div>)}
                      {lockedOrders.length === 0 && !lockedOrdersLoading && <div className="seller-note" style={{marginTop:9}}>Klik View Locked Orders untuk mencari order yang sedang mengunci inventory.</div>}
                    </div>
                  </div>}
                  {isListingOwner && <div className="seller-actions" style={{marginTop:14}}><button className="primary" disabled={disabled || status !== LISTING_STATUS.ACTIVE} onClick={() => void listingAction("pauseListing")}>Pause</button><button disabled={disabled || status !== LISTING_STATUS.PAUSED} onClick={() => void listingAction("resumeListing")}>Resume</button><button className="danger" disabled={disabled || status === LISTING_STATUS.CLOSED} onClick={() => void listingAction("closeListing")}>Close</button></div>}
                </div>
              )}

              {activeMenu === "settings" && isListingOwner && (
                <div className="seller-card seller-section">
                  <h2>Listing Settings</h2>
                  <div className="seller-form"><label>Price ({paymentSymbol} / {tokenSymbol})</label><input value={newPrice} onChange={e => setNewPrice(e.target.value)} inputMode="decimal" /><button disabled={disabled} onClick={() => void updatePrice()}>Update Price</button><div className="seller-inline"><div><label>Min Order</label><input value={minOrder} onChange={e => setMinOrder(e.target.value)} inputMode="decimal" /></div><div><label>Max Order</label><input value={maxOrder} onChange={e => setMaxOrder(e.target.value)} inputMode="decimal" /></div></div><button disabled={disabled} onClick={() => void updateLimits()}>Update Limits</button></div>
                </div>
              )}

              {activeMenu === "earnings" && (
                <div className="seller-card seller-section seller-earnings">
                  <h2>Seller Earnings</h2><div className="seller-value">{formatUnits(claimable, paymentDecimals)} USDC</div><p className="seller-note">Claimable USDC from completed settlements, ready to withdraw.</p><div className="seller-earnings-meta"><span>Withdrawal destination</span><strong>{short(seller?.withdrawalWallet)}</strong></div><button className="primary" disabled={disabled || claimable === 0n} onClick={() => void withdrawEarnings()}>{claimable === 0n ? "No USDC Available" : "Withdraw USDC to Wallet"}</button>
                </div>
              )}

              {activeMenu === "wallet" && (
                <div className="seller-card seller-section">
                  <h2>Withdrawal Wallet</h2><div className="seller-address">{seller?.withdrawalWallet ?? "—"}</div>{pendingActive && <p className="seller-note">Pending: {pendingWallet}<br />Effective: {effectiveAt ? new Date(effectiveAt * 1000).toLocaleString("id-ID") : "—"}</p>}<div className="seller-form" style={{marginTop:12}}><label>New withdrawal wallet</label><input value={withdrawalWallet} onChange={e => setWithdrawalWallet(e.target.value)} placeholder="0x..." /><button disabled={disabled} onClick={() => void requestWallet()}>Request Change (24h delay)</button>{canActivate && <button disabled={disabled} onClick={() => void activateWallet()}>Activate New Wallet</button>}</div>
                </div>
              )}
            </>
          )}

          {message && <div className="seller-message">{message}</div>}
          {error && <div className="seller-error">{error}</div>}
          </div>
        </>
      )}
    </section>
  );
}
