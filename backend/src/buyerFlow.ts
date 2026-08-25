import { Contract, type BrowserProvider, type Signer } from "ethers";
import { ESCROW_ABI } from "./abi.js";

export type BuyerFlowStage =
  | "READY"
  | "APPROVAL_PENDING"
  | "ORDER_PENDING"
  | "FUNDING_PENDING"
  | "COMPLETION_PENDING"
  | "COMPLETE";

export interface BuyerFlowState {
  stage: BuyerFlowStage;
  listingId: bigint;
  tokenAmount: bigint;
  orderId?: bigint;
  transactionHash?: string;
}

export interface BuyerFlowOptions {
  provider: BrowserProvider;
  escrowAddress: string;
  paymentTokenAddress: string;
  tokenAmount: bigint;
}

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
] as const;

export async function purchaseListing(
  options: BuyerFlowOptions,
  listingId: bigint,
  onState?: (state: BuyerFlowState) => void
): Promise<BuyerFlowState> {
  const signer: Signer = await options.provider.getSigner();
  const buyer = await signer.getAddress();
  const escrow = new Contract(options.escrowAddress, ESCROW_ABI, signer);
  const paymentToken = new Contract(options.paymentTokenAddress, ERC20_ABI, signer);

  const listing = await escrow.getListing(listingId);
  if (Number(listing.status) !== 1) throw new Error("Listing is not active");

  const amount = options.tokenAmount;
  if (amount < BigInt(listing.minOrderAmount) || amount > BigInt(listing.maxOrderAmount)) {
    throw new Error("Order amount is outside listing limits");
  }

  const available = BigInt(listing.inventoryDeposited) - BigInt(listing.inventoryLocked);
  if (available < amount) throw new Error("Insufficient listing inventory");

  const state: BuyerFlowState = { stage: "READY", listingId, tokenAmount: amount };
  onState?.(state);

  // Create the order first. The escrow contract is the authority for the exact
  // gross payment, fee, and seller proceeds; the frontend never guesses them.
  const orderTx = await escrow.createOrder(listingId, amount);
  state.stage = "ORDER_PENDING";
  state.transactionHash = orderTx.hash;
  onState?.({ ...state });
  const orderReceipt = await orderTx.wait();
  if (!orderReceipt) throw new Error("Order transaction was not mined");

  const orderCreated = orderReceipt.logs
    .map((log: unknown) => {
      try { return escrow.interface.parseLog(log as never); } catch { return null; }
    })
    .find((parsed: { name: string } | null) => parsed?.name === "OrderCreated");
  if (!orderCreated) throw new Error("OrderCreated event not found");

  const orderId = BigInt(orderCreated.args[0]);
  state.orderId = orderId;

  const order = await escrow.getOrder(orderId);
  const grossPayment = BigInt(order.grossPayment);
  const paymentTokenFromOrder = String(order.paymentToken).toLowerCase();
  if (paymentTokenFromOrder !== options.paymentTokenAddress.toLowerCase()) {
    throw new Error("Payment token changed or does not match listing");
  }

  // Exact approval only: never grant unlimited allowance.
  const allowance = BigInt(await paymentToken.allowance(buyer, options.escrowAddress));
  if (allowance < grossPayment) {
    const approval = await paymentToken.approve(options.escrowAddress, grossPayment);
    state.stage = "APPROVAL_PENDING";
    state.transactionHash = approval.hash;
    onState?.({ ...state });
    await approval.wait();

    const verifiedAllowance = BigInt(await paymentToken.allowance(buyer, options.escrowAddress));
    if (verifiedAllowance < grossPayment) throw new Error("Exact payment allowance was not confirmed");
  }

  const fundTx = await escrow.fundOrder(orderId);
  state.stage = "FUNDING_PENDING";
  state.transactionHash = fundTx.hash;
  onState?.({ ...state });
  await fundTx.wait();

  const orderAfterFunding = await escrow.getOrder(orderId);
  if (Number(orderAfterFunding.state) !== 1) throw new Error("Order was not funded");

  const completeTx = await escrow.completeOrder(orderId);
  state.stage = "COMPLETION_PENDING";
  state.transactionHash = completeTx.hash;
  onState?.({ ...state });
  await completeTx.wait();

  const finalOrder = await escrow.getOrder(orderId);
  if (Number(finalOrder.state) !== 2) throw new Error("Order was not completed");

  state.stage = "COMPLETE";
  state.transactionHash = completeTx.hash;
  onState?.({ ...state });
  return state;
}
