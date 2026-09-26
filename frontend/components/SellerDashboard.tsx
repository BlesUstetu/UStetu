"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeAbiParameters, formatEther, formatUnits, isAddress, keccak256, parseUnits } from "viem";
import { useAccount, useBalance, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import {
  BASE_MAINNET_CHAIN_ID,
  escrowAbi,
  registryAbi,
  sellerRegistryAbi,
  erc20MetadataAbi,
  USTETU_ESCROW_ADDRESS,
  USTETU_REGISTRY_ADDRESS,
  USTETU_SELLER_REGISTRY_ADDRESS
} from "@/lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";
const LISTING_STATUS = { ACTIVE: 1, PAUSED: 2, CLOSED: 3 } as const;
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

  const [listingIdInput, setListingIdInput] = useState("");
  const [activeListingId, setActiveListingId] = useState<bigint | null>(null);
  const [listingTokenAddress, setListingTokenAddress] = useState("");
  const [listingPrice, setListingPrice] = useState("1");
  const [listingInventory, setListingInventory] = useState("1");
  const [listingMin, setListingMin] = useState("1");
  const [listingMax, setListingMax] = useState("5");
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
  const tokenAddress = tokenInfoQuery.data?.contractAddress;
  const tokenDecimals = Number(tokenInfoQuery.data?.decimalsSnapshot ?? tokenDecimalsQuery.data ?? 18);
  const tokenSymbol = tokenMetadataQuery.data ?? "TOKEN";
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

  const loadListing = async () => {
    setError(""); setMessage("");
    try {
      const value = BigInt(listingIdInput.trim());
      if (value <= 0n) throw new Error("Listing ID harus lebih besar dari 0.");
      setActiveListingId(value);
      setMessage(`Memuat Listing #${value}…`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const createListing = async () => {
    try {
      await ensureSeller();
      if (!isAddress(listingTokenAddress)) throw new Error("Token contract address tidak valid.");
      const token = listingTokenAddress as `0x${string}`;
      const id = BigInt(listingIdInput.trim());
      if (id <= 0n) throw new Error("Listing ID harus lebih besar dari 0.");
      if (!publicClient) throw new Error("RPC client belum tersedia.");
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
  const listingTokenId = useMemo(() => listing ? `0x${listing.tokenId.toString(16).padStart(64, "0")}` : "", [listing]);

  return (
    <section className="seller-dashboard">
      <style jsx global>{`
        .seller-dashboard{max-width:1180px;margin:0 auto;padding:34px 22px 70px;color:var(--text,#f5f7ff)}
        .seller-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:24px}.seller-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.65}.seller-head h1{margin:7px 0 5px;font-size:34px}.seller-head p{margin:0;opacity:.62}.seller-wallet{font-family:ui-monospace,monospace;font-size:11px;opacity:.7}
        .seller-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}.seller-card{border:1px solid rgba(255,255,255,.1);background:rgba(10,14,25,.72);backdrop-filter:blur(14px);border-radius:18px;padding:18px;box-shadow:0 10px 35px rgba(0,0,0,.18)}.seller-card label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.12em;opacity:.55}.seller-value{font-size:24px;font-weight:750;margin-top:8px}.seller-sub{font-size:12px;opacity:.55;margin-top:4px}.seller-ok{color:#75f7ae}.seller-warn{color:#ffd166}
        .seller-two{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.seller-section{margin-bottom:16px}.seller-section h2{font-size:15px;margin:0 0 12px}.seller-listing-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.seller-token{display:flex;align-items:center;gap:12px}.seller-token-mark{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-weight:900;font-size:20px;background:linear-gradient(135deg,#1e2745,#7c5cff)}.seller-status{font-size:11px;border:1px solid rgba(117,247,174,.28);padding:7px 10px;border-radius:999px;color:#75f7ae}.seller-status.paused{border-color:rgba(255,209,102,.3);color:#ffd166}.seller-status.closed{border-color:rgba(255,100,100,.3);color:#ff7b8a}.seller-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.seller-stat{background:rgba(255,255,255,.035);border-radius:12px;padding:12px}.seller-stat span{display:block;font-size:10px;opacity:.5;text-transform:uppercase}.seller-stat strong{display:block;margin-top:5px}.seller-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.seller-actions button,.seller-form button,.seller-card>button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;border-radius:10px;padding:10px 13px;cursor:pointer}.seller-actions button:hover,.seller-form button:hover,.seller-card>button:hover{background:rgba(255,255,255,.1)}.seller-actions button:disabled,.seller-form button:disabled,.seller-card>button:disabled{opacity:.45;cursor:not-allowed}.danger{border-color:rgba(255,100,100,.3)!important}.primary{border-color:rgba(117,247,174,.3)!important}
        .seller-form{display:grid;gap:9px}.seller-form label{font-size:11px;opacity:.55}.seller-form input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.18);color:inherit;border-radius:10px;padding:11px 12px;outline:none}.seller-inline{display:grid;grid-template-columns:1fr 1fr;gap:9px}.seller-note{font-size:11px;line-height:1.55;opacity:.52}.seller-message{margin:12px 0;padding:11px 13px;border-radius:10px;background:rgba(117,247,174,.08);border:1px solid rgba(117,247,174,.18);font-size:12px}.seller-error{margin:12px 0;padding:11px 13px;border-radius:10px;background:rgba(255,80,100,.08);border:1px solid rgba(255,80,100,.18);font-size:12px;word-break:break-word}.seller-address{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all}.seller-gas-status{margin:14px 0;display:grid;gap:8px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.seller-gas-row{display:flex;justify-content:space-between;gap:14px;font-size:12px}.seller-gas-row span{opacity:.58}.seller-gas-row strong{font-family:ui-monospace,monospace}.seller-gas-state{font-size:11px;line-height:1.45;padding:9px 10px;border-radius:9px;background:rgba(255,209,102,.07);border:1px solid rgba(255,209,102,.16);color:#ffd166}.seller-gas-state.ready{background:rgba(117,247,174,.07);border-color:rgba(117,247,174,.16);color:#75f7ae}
.seller-divider{height:1px;background:rgba(255,255,255,.08);margin:14px 0}
        @media(max-width:850px){.seller-grid,.seller-two{grid-template-columns:1fr}.seller-stats{grid-template-columns:repeat(2,1fr)}.seller-head{align-items:flex-start;flex-direction:column}}
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
            <div><div className="seller-eyebrow">USTETU Seller Center</div><h1>Seller Dashboard</h1><p>Create dan kelola listing tanpa admin.</p></div>
            <div className="seller-wallet">{short(address)}</div>
          </div>

          <div className="seller-grid">
            <div className="seller-card"><label>Seller</label><div className="seller-value seller-ok">REGISTERED</div><div className="seller-sub">Permissionless Seller Registry</div></div>
            <div className="seller-card"><label>Claimable</label><div className="seller-value">{formatUnits(claimable, paymentDecimals)} {paymentToken ? short(paymentToken) : "PAYMENT"}</div><div className="seller-sub">Proceeds after settlement</div></div>
            <div className="seller-card"><label>Network</label><div className="seller-value">BASE</div><div className="seller-sub">Chain ID {BASE_MAINNET_CHAIN_ID}</div></div>
          </div>

          <div className="seller-card seller-section">
            <h2>Create Listing</h2>
            <p className="seller-note">Masukkan token contract yang sudah terdaftar di UStetu Registry. Registration tidak berarti token telah diverifikasi.</p>
            <div className="seller-form">
              <div className="seller-inline">
                <div><label>Listing ID</label><input value={listingIdInput} onChange={e => setListingIdInput(e.target.value)} placeholder="Contoh: 1001" inputMode="numeric" /></div>
                <div><label>Token Contract</label><input value={listingTokenAddress} onChange={e => setListingTokenAddress(e.target.value)} placeholder="0x..." /></div>
              </div>
              <div className="seller-inline">
                <div><label>Price ({paymentToken ? short(paymentToken) : "PAYMENT"} / token)</label><input value={listingPrice} onChange={e => setListingPrice(e.target.value)} inputMode="decimal" /></div>
                <div><label>Inventory</label><input value={listingInventory} onChange={e => setListingInventory(e.target.value)} inputMode="decimal" /></div>
              </div>
              <div className="seller-inline">
                <div><label>Min Order</label><input value={listingMin} onChange={e => setListingMin(e.target.value)} inputMode="decimal" /></div>
                <div><label>Max Order</label><input value={listingMax} onChange={e => setListingMax(e.target.value)} inputMode="decimal" /></div>
              </div>
              <div className="seller-actions"><button className="primary" disabled={disabled || chainId !== base.id} onClick={() => void createListing()}>Create Listing + Deposit</button></div>
              <p className="seller-note">Token approval diberikan ke Escrow hanya sebesar inventory yang akan didepositkan.</p>
            </div>
          </div>

          <div className="seller-card seller-section">
            <h2>Load Existing Listing</h2>
            <div className="seller-inline">
              <input value={listingIdInput} onChange={e => setListingIdInput(e.target.value)} placeholder="Listing ID" inputMode="numeric" />
              <button disabled={disabled} onClick={() => void loadListing()}>Load Listing</button>
            </div>
            <p className="seller-note">Dashboard akan membaca token, decimals snapshot, price, inventory, dan status langsung dari Escrow + Registry.</p>
          </div>

          {activeListingId !== null && listing && (
            <div className="seller-two">
              <div>
                <div className="seller-card seller-section">
                  <div className="seller-listing-top">
                    <div className="seller-token"><div className="seller-token-mark">T</div><div><strong>{tokenSymbol} / PAYMENT</strong><div className="seller-sub">Listing #{activeListingId.toString()} • Base Mainnet</div></div></div>
                    <span className={`seller-status ${status === LISTING_STATUS.PAUSED ? "paused" : status === LISTING_STATUS.CLOSED ? "closed" : ""}`}>● {statusLabel}</span>
                  </div>
                  <div className="seller-stats">
                    <div className="seller-stat"><span>Token</span><strong>{short(tokenAddress)}</strong></div>
                    <div className="seller-stat"><span>Price</span><strong>{formatUnits(listing.price, paymentDecimals)}</strong></div>
                    <div className="seller-stat"><span>Deposited</span><strong>{formatUnits(listing.inventoryDeposited, tokenDecimals)}</strong></div>
                    <div className="seller-stat"><span>Available</span><strong>{formatUnits(available, tokenDecimals)}</strong></div>
                  </div>
                  <div className="seller-note">Locked: {formatUnits(listing.inventoryLocked, tokenDecimals)} {tokenSymbol} · Decimals snapshot: {tokenDecimals} · Token ID: {listingTokenId}</div>
                  {!isListingOwner && <div className="seller-error">Listing ini bukan milik wallet yang sedang terhubung. Read-only mode.</div>}
                  {isListingOwner && <div className="seller-actions"><button className="primary" disabled={disabled || status !== LISTING_STATUS.ACTIVE} onClick={() => void listingAction("pauseListing")}>Pause</button><button disabled={disabled || status !== LISTING_STATUS.PAUSED} onClick={() => void listingAction("resumeListing")}>Resume</button><button className="danger" disabled={disabled || status === LISTING_STATUS.CLOSED} onClick={() => void listingAction("closeListing")}>Close</button></div>}
                </div>

                {isListingOwner && <div className="seller-card seller-section">
                  <h2>Inventory</h2>
                  <div className="seller-form">
                    <label>Amount {tokenSymbol}</label>
                    <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
                    <div className="seller-actions"><button disabled={disabled} onClick={() => void addInventory()}>Add Inventory</button><button disabled={disabled} onClick={() => void withdrawInventory()}>Withdraw Available</button></div>
                    <div className="seller-note">Wallet balance: {formatUnits(tokenBalance, tokenDecimals)} {tokenSymbol}. Withdraw hanya dari inventory yang tidak locked.</div>
                  </div>
                </div>}
              </div>

              <div>
                {isListingOwner && <div className="seller-card seller-section">
                  <h2>Listing Settings</h2>
                  <div className="seller-form">
                    <label>Price ({paymentToken ? short(paymentToken) : "PAYMENT"} / {tokenSymbol})</label>
                    <input value={newPrice} onChange={e => setNewPrice(e.target.value)} inputMode="decimal" />
                    <button disabled={disabled} onClick={() => void updatePrice()}>Update Price</button>
                    <div className="seller-inline"><div><label>Min Order</label><input value={minOrder} onChange={e => setMinOrder(e.target.value)} inputMode="decimal" /></div><div><label>Max Order</label><input value={maxOrder} onChange={e => setMaxOrder(e.target.value)} inputMode="decimal" /></div></div>
                    <button disabled={disabled} onClick={() => void updateLimits()}>Update Limits</button>
                  </div>
                </div>}

                <div className="seller-card seller-section">
                  <h2>Earnings</h2>
                  <div className="seller-value">{formatUnits(claimable, paymentDecimals)} {paymentToken ? short(paymentToken) : "PAYMENT"}</div>
                  <p className="seller-note">Claimable proceeds dapat ditarik ke withdrawal wallet seller setelah settlement.</p>
                  <button disabled={disabled || claimable === 0n} onClick={() => void withdrawEarnings()}>Withdraw Proceeds</button>
                </div>

                <div className="seller-card seller-section">
                  <h2>Withdrawal Wallet</h2>
                  <div className="seller-address">{seller?.withdrawalWallet ?? "—"}</div>
                  {pendingActive && <p className="seller-note">Pending: {pendingWallet}<br />Effective: {effectiveAt ? new Date(effectiveAt * 1000).toLocaleString("id-ID") : "—"}</p>}
                  <div className="seller-form" style={{marginTop:12}}>
                    <label>New withdrawal wallet</label>
                    <input value={withdrawalWallet} onChange={e => setWithdrawalWallet(e.target.value)} placeholder="0x..." />
                    <button disabled={disabled} onClick={() => void requestWallet()}>Request Change (24h delay)</button>
                    {canActivate && <button disabled={disabled} onClick={() => void activateWallet()}>Activate New Wallet</button>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {message && <div className="seller-message">{message}</div>}
          {error && <div className="seller-error">{error}</div>}
        </>
      )}
    </section>
  );
}
