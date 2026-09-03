// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts@5.4.0/utils/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts@5.4.0/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts@5.4.0/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.4.0/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts@5.4.0/token/ERC20/IERC20.sol";
import {IUStetuRegistry} from "../contracts/interfaces/IUStetuRegistry.sol";
import {UStetuTypes} from "../contracts/libraries/UStetuTypes.sol";
import {UStetuErrors} from "../contracts/libraries/UStetuErrors.sol";
import {UStetuMath} from "../contracts/libraries/UStetuMath.sol";

contract UStetuEscrow is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_FEE_BPS = 100;
    uint256 public constant MIN_FEE_BPS = 0;
    uint256 public constant MAX_FEE_BPS = 500;
    uint256 public feeBps = DEFAULT_FEE_BPS;
    uint64 public constant PAYMENT_WINDOW = 15 minutes;
    uint64 public constant AUTO_RELEASE_WINDOW = 24 hours;
    uint64 public constant ORDER_EXPIRY = PAYMENT_WINDOW;

    IUStetuRegistry public immutable registry;
    address public immutable feeRecipient;
    uint256 private _nextOrderId = 1;

    mapping(uint256 => UStetuTypes.Listing) private _listings;
    mapping(uint256 => UStetuTypes.Order) private _orders;
    mapping(address => mapping(address => uint256)) public sellerInventory;
    mapping(uint256 => uint256) public listingLockedInventory;
    mapping(address => mapping(address => uint256)) public claimable;

    event InventoryDeposited(uint256 indexed listingId, address indexed seller, address indexed token, uint256 amount);
    event InventoryWithdrawn(uint256 indexed listingId, address indexed seller, address indexed token, uint256 amount);
    event ListingPriceUpdated(uint256 indexed listingId, address indexed seller, uint256 oldPrice, uint256 newPrice);
    event ListingOrderLimitsUpdated(uint256 indexed listingId, address indexed seller, uint256 oldMinOrderAmount, uint256 oldMaxOrderAmount, uint256 newMinOrderAmount, uint256 newMaxOrderAmount);
    event ListingPaused(uint256 indexed listingId, address indexed seller);
    event ListingResumed(uint256 indexed listingId, address indexed seller);
    event ListingClosed(uint256 indexed listingId, address indexed seller);
    event FeeBpsUpdated(address indexed admin, uint256 oldFeeBps, uint256 newFeeBps);
    event OrderCreated(uint256 indexed orderId, uint256 indexed listingId, address indexed buyer, address seller, address recipient, uint256 tokenAmount, uint256 unitPrice, uint256 grossPayment, address paymentToken);
    event PaymentEscrowed(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event OrderCompleted(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 tokenAmount);
    event OrderExpired(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 tokenAmount);
    event AutoReleased(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 tokenAmount);
    event ClaimableWithdrawn(address indexed account, address indexed token, uint256 amount);

    constructor(address registryAddress, address feeRecipientAddress) Ownable(msg.sender) {
        if (registryAddress == address(0) || feeRecipientAddress == address(0)) revert UStetuErrors.InvalidAddress();
        registry = IUStetuRegistry(registryAddress);
        feeRecipient = feeRecipientAddress;
    }

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps < MIN_FEE_BPS || newFeeBps > MAX_FEE_BPS) revert UStetuErrors.InvalidAmount();
        uint256 oldFeeBps = feeBps;
        feeBps = newFeeBps;
        emit FeeBpsUpdated(msg.sender, oldFeeBps, newFeeBps);
    }

    function createListingAndDeposit(uint256 listingId, bytes32 tokenId, address seller, address paymentToken, uint256 price, uint256 inventoryAmount, uint256 minOrderAmount, uint256 maxOrderAmount) external nonReentrant {
        if (msg.sender != seller) revert UStetuErrors.Unauthorized();
        if (seller == address(0) || paymentToken == address(0)) revert UStetuErrors.InvalidAddress();
        if (listingId == 0 || inventoryAmount == 0) revert UStetuErrors.InvalidAmount();
        if (price == 0) revert UStetuErrors.InvalidPrice();
        if (minOrderAmount == 0 || maxOrderAmount < minOrderAmount) revert UStetuErrors.InvalidOrderLimits();
        if (!registry.isApprovedToken(tokenId)) revert UStetuErrors.TokenNotApproved();
        if (!registry.isSupportedPaymentToken(paymentToken)) revert UStetuErrors.UnsupportedPaymentToken();
        if (_listings[listingId].seller != address(0)) revert UStetuErrors.AlreadyRegistered();

        UStetuTypes.Token memory tokenInfo = registry.getToken(tokenId);
        IERC20 token = IERC20(tokenInfo.contractAddress);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(seller, address(this), inventoryAmount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received != inventoryAmount) revert UStetuErrors.UnsupportedToken();

        _listings[listingId] = UStetuTypes.Listing({
            tokenId: uint256(tokenId), seller: seller, paymentToken: paymentToken, price: price,
            inventoryDeposited: received, inventoryLocked: 0, minOrderAmount: minOrderAmount,
            maxOrderAmount: maxOrderAmount, status: UStetuTypes.ListingStatus.ACTIVE,
            createdAt: uint64(block.timestamp), updatedAt: uint64(block.timestamp)
        });
        sellerInventory[seller][tokenInfo.contractAddress] += received;
        emit InventoryDeposited(listingId, seller, tokenInfo.contractAddress, received);
    }

    function addListingInventory(uint256 listingId, uint256 amount) external nonReentrant {
        UStetuTypes.Listing storage listing = _listings[listingId];
        _requireSeller(listing);
        if (amount == 0) revert UStetuErrors.InvalidAmount();
        if (listing.status == UStetuTypes.ListingStatus.CLOSED || listing.status == UStetuTypes.ListingStatus.SUSPENDED) revert UStetuErrors.InvalidListingState();
        UStetuTypes.Token memory tokenInfo = registry.getToken(bytes32(listing.tokenId));
        IERC20 token = IERC20(tokenInfo.contractAddress);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert UStetuErrors.UnsupportedToken();
        listing.inventoryDeposited += received;
        listing.updatedAt = uint64(block.timestamp);
        sellerInventory[msg.sender][tokenInfo.contractAddress] += received;
        emit InventoryDeposited(listingId, msg.sender, tokenInfo.contractAddress, received);
    }

    function withdrawListingInventory(uint256 listingId, uint256 amount) external nonReentrant {
        UStetuTypes.Listing storage listing = _listings[listingId];
        _requireSeller(listing);
        if (amount == 0) revert UStetuErrors.InvalidAmount();
        if (listing.inventoryDeposited - listing.inventoryLocked < amount) revert UStetuErrors.InsufficientInventory();
        UStetuTypes.Token memory tokenInfo = registry.getToken(bytes32(listing.tokenId));
        listing.inventoryDeposited -= amount;
        listing.updatedAt = uint64(block.timestamp);
        sellerInventory[msg.sender][tokenInfo.contractAddress] -= amount;
        IERC20(tokenInfo.contractAddress).safeTransfer(msg.sender, amount);
        emit InventoryWithdrawn(listingId, msg.sender, tokenInfo.contractAddress, amount);
    }

    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        UStetuTypes.Listing storage listing = _listings[listingId];
        _requireSeller(listing);
        if (newPrice == 0) revert UStetuErrors.InvalidPrice();
        if (listing.status == UStetuTypes.ListingStatus.CLOSED || listing.status == UStetuTypes.ListingStatus.SUSPENDED) revert UStetuErrors.InvalidListingState();
        uint256 oldPrice = listing.price;
        listing.price = newPrice;
        listing.updatedAt = uint64(block.timestamp);
        emit ListingPriceUpdated(listingId, msg.sender, oldPrice, newPrice);
    }

    function updateListingOrderLimits(uint256 listingId, uint256 newMinOrderAmount, uint256 newMaxOrderAmount) external {
        UStetuTypes.Listing storage listing = _listings[listingId];
        _requireSeller(listing);
        if (newMinOrderAmount == 0 || newMaxOrderAmount < newMinOrderAmount) revert UStetuErrors.InvalidOrderLimits();
        if (listing.status == UStetuTypes.ListingStatus.CLOSED || listing.status == UStetuTypes.ListingStatus.SUSPENDED) revert UStetuErrors.InvalidListingState();
        uint256 oldMin = listing.minOrderAmount;
        uint256 oldMax = listing.maxOrderAmount;
        listing.minOrderAmount = newMinOrderAmount;
        listing.maxOrderAmount = newMaxOrderAmount;
        listing.updatedAt = uint64(block.timestamp);
        emit ListingOrderLimitsUpdated(listingId, msg.sender, oldMin, oldMax, newMinOrderAmount, newMaxOrderAmount);
    }

    function pauseListing(uint256 listingId) external {
        UStetuTypes.Listing storage listing = _listings[listingId];
        _requireSeller(listing);
        if (listing.status != UStetuTypes.ListingStatus.ACTIVE) revert UStetuErrors.InvalidListingState();
        listing.status = UStetuTypes.ListingStatus.PAUSED;
        listing.updatedAt = uint64(block.timestamp);
        emit ListingPaused(listingId, msg.sender);
    }

    function resumeListing(uint256 listingId) external {
        UStetuTypes.Listing storage listing = _listings[listingId];
        _requireSeller(listing);
        if (listing.status != UStetuTypes.ListingStatus.PAUSED) revert UStetuErrors.InvalidListingState();
        listing.status = UStetuTypes.ListingStatus.ACTIVE;
        listing.updatedAt = uint64(block.timestamp);
        emit ListingResumed(listingId, msg.sender);
    }

    function closeListing(uint256 listingId) external {
        UStetuTypes.Listing storage listing = _listings[listingId];
        _requireSeller(listing);
        if (listing.status == UStetuTypes.ListingStatus.CLOSED || listing.status == UStetuTypes.ListingStatus.SUSPENDED) revert UStetuErrors.InvalidListingState();
        listing.status = UStetuTypes.ListingStatus.CLOSED;
        listing.updatedAt = uint64(block.timestamp);
        emit ListingClosed(listingId, msg.sender);
    }

    function createOrder(uint256 listingId, uint256 tokenAmount) external nonReentrant returns (uint256 orderId) {
        UStetuTypes.Listing storage listing = _listings[listingId];
        if (listing.seller == address(0) || listing.status != UStetuTypes.ListingStatus.ACTIVE) revert UStetuErrors.InvalidListingState();
        if (tokenAmount < listing.minOrderAmount || tokenAmount > listing.maxOrderAmount) revert UStetuErrors.InvalidAmount();
        uint256 available = listing.inventoryDeposited - listing.inventoryLocked;
        if (available < tokenAmount) revert UStetuErrors.InsufficientInventory();

        UStetuTypes.Token memory tokenInfo = registry.getToken(bytes32(listing.tokenId));
        uint256 grossPayment = UStetuMath.calculateGrossPayment(tokenAmount, listing.price, tokenInfo.decimalsSnapshot);
        (uint256 fee, uint256 sellerProceeds) = UStetuMath.calculateFee(grossPayment, feeBps);
        orderId = _nextOrderId++;
        _orders[orderId] = UStetuTypes.Order({
            listingId: listingId, buyer: msg.sender, seller: listing.seller, recipient: msg.sender,
            token: tokenInfo.contractAddress, paymentToken: listing.paymentToken, tokenAmount: tokenAmount,
            unitPrice: listing.price, grossPayment: grossPayment, marketplaceFee: fee, sellerProceeds: sellerProceeds,
            state: UStetuTypes.OrderState.PAYMENT_PENDING, createdAt: uint64(block.timestamp), paidAt: 0,
            completedAt: 0, refundedAt: 0, expiresAt: uint64(block.timestamp + PAYMENT_WINDOW), disputeId: 0
        });
        listing.inventoryLocked += tokenAmount;
        listingLockedInventory[listingId] += tokenAmount;
        emit OrderCreated(orderId, listingId, msg.sender, listing.seller, msg.sender, tokenAmount, listing.price, grossPayment, listing.paymentToken);
    }

    function fundOrder(uint256 orderId) external nonReentrant {
        UStetuTypes.Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert UStetuErrors.InvalidOrderState();
        if (order.state != UStetuTypes.OrderState.PAYMENT_PENDING) revert UStetuErrors.InvalidOrderState();
        if (msg.sender != order.buyer) revert UStetuErrors.Unauthorized();
        if (block.timestamp >= order.expiresAt) revert UStetuErrors.DeadlineExpired();
        IERC20(order.paymentToken).safeTransferFrom(msg.sender, address(this), order.grossPayment);
        order.state = UStetuTypes.OrderState.PAID;
        order.paidAt = uint64(block.timestamp);
        order.expiresAt = uint64(block.timestamp + AUTO_RELEASE_WINDOW);
        emit PaymentEscrowed(orderId, msg.sender, order.grossPayment);
    }

    function completeOrder(uint256 orderId) external nonReentrant {
        UStetuTypes.Order storage order = _orders[orderId];
        if (order.state != UStetuTypes.OrderState.PAID) revert UStetuErrors.InvalidOrderState();
        if (msg.sender != order.buyer) revert UStetuErrors.Unauthorized();
        if (block.timestamp >= order.expiresAt) revert UStetuErrors.DeadlineExpired();
        _settleOrder(orderId, order, false);
    }

    function autoReleaseOrder(uint256 orderId) external nonReentrant {
        UStetuTypes.Order storage order = _orders[orderId];
        if (order.state != UStetuTypes.OrderState.PAID) revert UStetuErrors.InvalidOrderState();
        if (block.timestamp < order.expiresAt) revert UStetuErrors.DeadlineNotReached();
        _settleOrder(orderId, order, true);
    }

    function expireOrder(uint256 orderId) external nonReentrant {
        UStetuTypes.Order storage order = _orders[orderId];
        if (order.state != UStetuTypes.OrderState.PAYMENT_PENDING) revert UStetuErrors.InvalidOrderState();
        if (block.timestamp < order.expiresAt) revert UStetuErrors.DeadlineNotReached();
        UStetuTypes.Listing storage listing = _listings[order.listingId];
        if (listing.inventoryLocked < order.tokenAmount) revert UStetuErrors.InsufficientInventory();
        listing.inventoryLocked -= order.tokenAmount;
        listingLockedInventory[order.listingId] -= order.tokenAmount;
        order.state = UStetuTypes.OrderState.EXPIRED;
        order.refundedAt = uint64(block.timestamp);
        emit OrderExpired(orderId, order.buyer, order.seller, order.tokenAmount);
    }

    function withdrawClaimable(address token) external nonReentrant {
        uint256 amount = claimable[msg.sender][token];
        if (amount == 0) revert UStetuErrors.InvalidAmount();
        claimable[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit ClaimableWithdrawn(msg.sender, token, amount);
    }

    function getListing(uint256 listingId) external view returns (UStetuTypes.Listing memory) { return _listings[listingId]; }
    function getOrder(uint256 orderId) external view returns (UStetuTypes.Order memory) { return _orders[orderId]; }

    function _settleOrder(uint256 orderId, UStetuTypes.Order storage order, bool automatic) internal {
        UStetuTypes.Listing storage listing = _listings[order.listingId];
        if (listing.inventoryLocked < order.tokenAmount) revert UStetuErrors.InsufficientInventory();
        listing.inventoryLocked -= order.tokenAmount;
        listing.inventoryDeposited -= order.tokenAmount;
        listingLockedInventory[order.listingId] -= order.tokenAmount;
        sellerInventory[order.seller][order.token] -= order.tokenAmount;
        IERC20(order.token).safeTransfer(order.recipient, order.tokenAmount);
        claimable[order.seller][order.paymentToken] += order.sellerProceeds;
        claimable[feeRecipient][order.paymentToken] += order.marketplaceFee;
        order.state = UStetuTypes.OrderState.COMPLETED;
        order.completedAt = uint64(block.timestamp);
        emit OrderCompleted(orderId, order.buyer, order.seller, order.tokenAmount);
        if (automatic) emit AutoReleased(orderId, order.buyer, order.seller, order.tokenAmount);
    }

    function _requireSeller(UStetuTypes.Listing storage listing) internal view {
        if (listing.seller == address(0)) revert UStetuErrors.InvalidListingState();
        if (msg.sender != listing.seller) revert UStetuErrors.Unauthorized();
    }
}
