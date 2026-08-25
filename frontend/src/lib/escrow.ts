import { BrowserProvider, Contract } from "ethers";
import { frontendConfig } from "../config";

export type BuyStage =
  | "VALIDATING"
  | "ORDER_PENDING"
  | "APPROVAL_PENDING"
  | "FUNDING_PENDING"
  | "COMPLETION_PENDING"
  | "COMPLETE";

export interface BuyState {
  stage: BuyStage;
  listingId: bigint;
  tokenAmount: bigint;
  orderId?: bigint;
  transactionHash?: string;
}

const ESCROW_ABI = [
  "function getListing(uint256 listingId) view returns (uint256 tokenId,address seller,address paymentToken,uint256 price,uint256 inventoryDeposited,uint256 inventoryLocked,uint256 minOrderAmount,uint256 maxOrderAmount,uint8 status,uint64 createdAt,uint64 updatedAt)",
  "function createOrder(uint256 listingId,uint256 tokenAmount) returns (uint256 orderId)",
  "function getOrder(uint256 orderId) view returns (uint256 listingId,address buyer,address seller,address recipient,address paymentToken,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,uint256 fee,uint256 sellerProceeds,uint8 state,uint64 createdAt,uint64 fundedAt,uint64 completedAt,uint64 refundedAt)",
  "function fundOrder(uint256 orderId)",
  "function completeOrder(uint256 orderId)",
  "event OrderCreated(uint256 indexed orderId,uint256 indexed listingId,address indexed buyer,address seller,address recipient,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,address paymentToken)"
] as const;

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
] as const;

export async function buyListing(
  listingId: bigint,
  tokenAmount: bigint,
  onState?: (state: BuyState) => void
): Promise<BuyState> {
  if (!frontendConfig.escrowAddress) throw new Error("Escrow address is not configured");

  const ethereum = (window as Window & { ethereum?: { request: (...args: unknown[]) => Promise<unknown> } }).ethereum;
  if (!ethereum) throw new Error("No browser wallet detected");

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const buyer = await signer.getAddress();
  const escrow = new Contract(frontendConfig.escrowAddress, ESCROW_ABI, signer);

  const listing = await escrow.getListing(listingId);
  if (Number(listing.status) !== 1) throw new Error("Listing is not active");

  const available = BigInt(listing.inventoryDeposited) - BigInt(listing.inventoryLocked);
  if (tokenAmount < BigInt(listing.minOrderAmount) || tokenAmount > BigInt(listing.maxOrderAmount)) {
    throw new Error("Order amount is outside listing limits");
  }
  if (tokenAmount > available) throw new Error("Insufficient listing inventory");

  const state: BuyState = { stage: "VALIDATING", listingId, tokenAmount };
  onState?.({ ...state });

  const orderTx = await escrow.createOrder(listingId, tokenAmount);
  state.stage = "ORDER_PENDING";
  state.transactionHash = orderTx.hash;
  onState?.({ ...state });
  const receipt = await orderTx.wait();
  if (!receipt) throw new Error("Order transaction was not mined");

  const parsed = receipt.logs
    .map((log: unknown) => {
      try { return escrow.interface.parseLog(log as never); } catch { return null; }
    })
    .find((event: { name: string } | null) => event?.name === "OrderCreated");
  if (!parsed) throw new Error("OrderCreated event not found");

  const orderId = BigInt(parsed.args[0]);
  state.orderId = orderId;

  const order = await escrow.getOrder(orderId);
  const paymentTokenAddress = String(order.paymentToken);
  const grossPayment = BigInt(order.grossPayment);
  if (paymentTokenAddress.toLowerCase() !== String(listing.paymentToken).toLowerCase()) {
    throw new Error("Payment token does not match listing");
  }

  const paymentToken = new Contract(paymentTokenAddress, ERC20_ABI, signer);
  const allowance = BigInt(await paymentToken.allowance(buyer, frontendConfig.escrowAddress));
  if (allowance < grossPayment) {
    const approvalTx = await paymentToken.approve(frontendConfig.escrowAddress, grossPayment);
    state.stage = "APPROVAL_PENDING";
    state.transactionHash = approvalTx.hash;
    onState?.({ ...state });
    await approvalTx.wait();
    const confirmedAllowance = BigInt(await paymentToken.allowance(buyer, frontendConfig.escrowAddress));
    if (confirmedAllowance < grossPayment) throw new Error("Payment allowance was not confirmed");
  }

  const fundTx = await escrow.fundOrder(orderId);
  state.stage = "FUNDING_PENDING";
  state.transactionHash = fundTx.hash;
  onState?.({ ...state });
  await fundTx.wait();

  const funded = await escrow.getOrder(orderId);
  if (Number(funded.state) !== 1) throw new Error("Order was not funded");

  const completeTx = await escrow.completeOrder(orderId);
  state.stage = "COMPLETION_PENDING";
  state.transactionHash = completeTx.hash;
  onState?.({ ...state });
  await completeTx.wait();

  const completed = await escrow.getOrder(orderId);
  if (Number(completed.state) !== 2) throw new Error("Order was not completed");

  state.stage = "COMPLETE";
  state.transactionHash = completeTx.hash;
  onState?.({ ...state });
  return state;
}
