// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUStetuRegistry} from "../interfaces/IUStetuRegistry.sol";
import {UStetuTypes} from "../libraries/UStetuTypes.sol";
import {UStetuErrors} from "../libraries/UStetuErrors.sol";
import {UStetuMath} from "../libraries/UStetuMath.sol";

/**
 * @title UStetuEscrow
 * @notice Initial escrow core for UStetu v1.
 * @dev This first implementation intentionally exposes only inventory deposit
 *      and deterministic order/payment accounting. Dispute, settlement, refund,
 *      and withdrawal paths are added only after their dedicated tests are in place.
 */
contract UStetuEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant FEE_BPS = 100;

    IUStetuRegistry public immutable registry;

    uint256 private _nextOrderId = 1;

    mapping(uint256 => UStetuTypes.Listing) private _listings;
    mapping(uint256 => UStetuTypes.Order) private _orders;

    // Seller => token => amount deposited and not yet withdrawn.
    mapping(address => mapping(address => uint256)) public sellerInventory;

    // Listing => seller-owned inventory currently locked against orders.
    mapping(uint256 => uint256) public listingLockedInventory;

    // Payment token => seller => claimable settlement proceeds.
    mapping(address => mapping(address => uint256)) public claimable;

    event InventoryDeposited(
        uint256 indexed listingId,
        address indexed seller,
        address indexed token,
        uint256 amount
    );
    event OrderCreated(
        uint256 indexed orderId,
        uint256 indexed listingId,
        address indexed buyer,
        address seller,
        address recipient,
        uint256 tokenAmount,
        uint256 unitPrice,
        uint256 grossPayment,
        address paymentToken
    );
    event PaymentEscrowed(uint256 indexed orderId, address indexed buyer, uint256 amount);

    constructor(address registryAddress) {
        if (registryAddress == address(0)) revert UStetuErrors.InvalidAddress();
        registry = IUStetuRegistry(registryAddress);
    }

    /**
     * @notice Registers a listing in escrow and deposits seller inventory.
     * @dev Marketplace will call this function after its listing validation.
     *      The escrow verifies the token against the registry and measures the
     *      seller's actual balance delta to avoid silently accepting short deposits.
     */
    function createListingAndDeposit(
        uint256 listingId,
        bytes32 tokenId,
        address seller,
        address paymentToken,
        uint256 price,
        uint256 inventoryAmount,
        uint256 minOrderAmount,
        uint256 maxOrderAmount
    ) external nonReentrant {
        if (seller == address(0) || paymentToken == address(0)) {
            revert UStetuErrors.InvalidAddress();
        }
        if (listingId == 0 || inventoryAmount == 0) revert UStetuErrors.InvalidAmount();
        if (price == 0) revert UStetuErrors.InvalidPrice();
        if (minOrderAmount == 0 || maxOrderAmount < minOrderAmount) {
            revert UStetuErrors.InvalidOrderLimits();
        }
        if (!registry.isApprovedToken(tokenId)) revert UStetuErrors.TokenNotApproved();
        if (!registry.isSupportedPaymentToken(paymentToken)) {
            revert UStetuErrors.UnsupportedPaymentToken();
        }
        if (_listings[listingId].seller != address(0)) revert UStetuErrors.AlreadyRegistered();

        UStetuTypes.Token memory tokenInfo = registry.getToken(tokenId);
        IERC20 token = IERC20(tokenInfo.contractAddress);

        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(seller, address(this), inventoryAmount);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 received = balanceAfter - balanceBefore;

        // v1 only accepts exact-transfer ERC-20 behavior.
        if (received != inventoryAmount) revert UStetuErrors.UnsupportedToken();

        _listings[listingId] = UStetuTypes.Listing({
            tokenId: uint256(tokenId),
            seller: seller,
            paymentToken: paymentToken,
            price: price,
            inventoryDeposited: received,
            inventoryLocked: 0,
            minOrderAmount: minOrderAmount,
            maxOrderAmount: maxOrderAmount,
            status: UStetuTypes.ListingStatus.ACTIVE,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        sellerInventory[seller][tokenInfo.contractAddress] += received;

        emit InventoryDeposited(listingId, seller, tokenInfo.contractAddress, received);
    }

    /**
     * @notice Creates an order and locks the requested seller inventory.
     * @dev Payment is intentionally a separate transaction in this first stage.
     */
    function createOrder(uint256 listingId, uint256 tokenAmount)
        external
        nonReentrant
        returns (uint256 orderId)
    {
        UStetuTypes.Listing storage listing = _listings[listingId];
        if (listing.seller == address(0)) revert UStetuErrors.InvalidListingState();
        if (listing.status != UStetuTypes.ListingStatus.ACTIVE) {
            revert UStetuErrors.InvalidListingState();
        }
        if (tokenAmount < listing.minOrderAmount || tokenAmount > listing.maxOrderAmount) {
            revert UStetuErrors.InvalidAmount();
        }

        uint256 available = listing.inventoryDeposited - listing.inventoryLocked;
        if (available < tokenAmount) revert UStetuErrors.InsufficientInventory();

        uint256 grossPayment = UStetuMath.calculateGrossPayment(tokenAmount, listing.price);
        uint256 fee = UStetuMath.calculateFee(grossPayment, FEE_BPS);

        orderId = _nextOrderId++;
        _orders[orderId] = UStetuTypes.Order({
            listingId: listingId,
            buyer: msg.sender,
            seller: listing.seller,
            recipient: msg.sender,
            token: IUStetuRegistry(address(registry)).getToken(bytes32(listing.tokenId)).contractAddress,
            paymentToken: listing.paymentToken,
            tokenAmount: tokenAmount,
            unitPrice: listing.price,
            grossPayment: grossPayment,
            marketplaceFee: fee,
            sellerProceeds: grossPayment - fee,
            state: UStetuTypes.OrderState.PAYMENT_PENDING,
            createdAt: uint64(block.timestamp),
            paidAt: 0,
            completedAt: 0,
            refundedAt: 0,
            expiresAt: uint64(block.timestamp + 1 days),
            disputeId: 0
        });

        listing.inventoryLocked += tokenAmount;
        listingLockedInventory[listingId] += tokenAmount;

        emit OrderCreated(
            orderId,
            listingId,
            msg.sender,
            listing.seller,
            msg.sender,
            tokenAmount,
            listing.price,
            grossPayment,
            listing.paymentToken
        );
    }

    /**
     * @notice Funds an order with the exact configured payment amount.
     */
    function fundOrder(uint256 orderId) external nonReentrant {
        UStetuTypes.Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert UStetuErrors.InvalidOrderState();
        if (order.state != UStetuTypes.OrderState.PAYMENT_PENDING) {
            revert UStetuErrors.InvalidOrderState();
        }
        if (msg.sender != order.buyer) revert UStetuErrors.Unauthorized();
        if (block.timestamp >= order.expiresAt) revert UStetuErrors.DeadlineExpired();

        IERC20 paymentToken = IERC20(order.paymentToken);
        paymentToken.safeTransferFrom(msg.sender, address(this), order.grossPayment);

        order.state = UStetuTypes.OrderState.PAID;
        order.paidAt = uint64(block.timestamp);

        emit PaymentEscrowed(orderId, msg.sender, order.grossPayment);
    }

    function getListing(uint256 listingId) external view returns (UStetuTypes.Listing memory) {
        return _listings[listingId];
    }

    function getOrder(uint256 orderId) external view returns (UStetuTypes.Order memory) {
        return _orders[orderId];
    }
}
