export const ESCROW_ABI = [
  "event InventoryDeposited(uint256 indexed listingId,address indexed seller,address indexed token,uint256 amount)",
  "event InventoryWithdrawn(uint256 indexed listingId,address indexed seller,address indexed token,uint256 amount)",
  "event ListingPriceUpdated(uint256 indexed listingId,address indexed seller,uint256 oldPrice,uint256 newPrice)",
  "event ListingOrderLimitsUpdated(uint256 indexed listingId,address indexed seller,uint256 oldMinOrderAmount,uint256 oldMaxOrderAmount,uint256 newMinOrderAmount,uint256 newMaxOrderAmount)",
  "event ListingPaused(uint256 indexed listingId,address indexed seller)",
  "event ListingResumed(uint256 indexed listingId,address indexed seller)",
  "event ListingClosed(uint256 indexed listingId,address indexed seller)",
  "event OrderCreated(uint256 indexed orderId,uint256 indexed listingId,address indexed buyer,address seller,address recipient,uint256 tokenAmount,uint256 unitPrice,uint256 grossPayment,address paymentToken)",
  "event PaymentEscrowed(uint256 indexed orderId,address indexed buyer,uint256 amount)",
  "event OrderCompleted(uint256 indexed orderId,address indexed buyer,address indexed seller,uint256 tokenAmount)",
  "event OrderExpired(uint256 indexed orderId,address indexed buyer,address indexed seller,uint256 tokenAmount)",
  "event AutoReleased(uint256 indexed orderId,address indexed buyer,address indexed seller,uint256 tokenAmount)",
  "event ClaimableWithdrawn(address indexed account,address indexed token,uint256 amount)",
  "event SellerWithdrawal(address indexed seller,address indexed token,address indexed withdrawalWallet,uint256 amount)",
  "event MarketplaceFeeWithdrawn(address indexed feeRecipient,address indexed token,uint256 amount)",
  "function paymentToken() view returns (address)",
  "function getListing(uint256 listingId) view returns (uint256 tokenId,address seller,uint256 price,uint256 inventoryDeposited,uint256 inventoryLocked,uint256 minOrderAmount,uint256 maxOrderAmount,uint8 status,uint64 createdAt,uint64 updatedAt)"
] as const;
