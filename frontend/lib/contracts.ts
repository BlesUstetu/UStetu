export const USTETU_REGISTRY_ADDRESS = "0x72ca75932e5Bd1364A889DD6329D6016f78e17A7" as const;
export const USTETU_SELLER_REGISTRY_ADDRESS = "0x8982d7109aF7917c33f0D0D09C67f0461242AC88" as const;
export const USTETU_ESCROW_ADDRESS = "0x3c97fc6c63Dc2E1aA1F0f4e36fF3cdFd9Cc6dd2e" as const;
export const USTETU_TOKEN_ADDRESS = "0xF9843db152623AB8B3f164Ea297956261D31434c" as const;
export const USDC_BASE_SEPOLIA_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const USTETU_TOKEN_ID = "0xf19bf134998f50d4a944b0f33819be5eb2a2fc364a99f434399283336e427b10" as const;

export const escrowAbi = [
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [{ name: "listing", type: "tuple", components: [
      { name: "tokenId", type: "uint256" }, { name: "seller", type: "address" }, { name: "paymentToken", type: "address" },
      { name: "price", type: "uint256" }, { name: "inventoryDeposited", type: "uint256" }, { name: "inventoryLocked", type: "uint256" },
      { name: "minOrderAmount", type: "uint256" }, { name: "maxOrderAmount", type: "uint256" }, { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint64" }, { name: "updatedAt", type: "uint64" }
    ] }],
  },
  {
    type: "function",
    name: "getOrder",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [{ name: "order", type: "tuple", components: [
      { name: "listingId", type: "uint256" }, { name: "buyer", type: "address" }, { name: "seller", type: "address" },
      { name: "recipient", type: "address" }, { name: "token", type: "address" }, { name: "paymentToken", type: "address" },
      { name: "tokenAmount", type: "uint256" }, { name: "unitPrice", type: "uint256" }, { name: "grossPayment", type: "uint256" },
      { name: "marketplaceFee", type: "uint256" }, { name: "sellerProceeds", type: "uint256" }, { name: "state", type: "uint8" },
      { name: "createdAt", type: "uint64" }, { name: "paidAt", type: "uint64" }, { name: "completedAt", type: "uint64" },
      { name: "refundedAt", type: "uint64" }, { name: "expiresAt", type: "uint64" }, { name: "disputeId", type: "uint256" }
    ] }],
  },
  {
    type: "function", name: "createListingAndDeposit", stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" }, { name: "tokenId", type: "bytes32" }, { name: "seller", type: "address" },
      { name: "paymentToken", type: "address" }, { name: "price", type: "uint256" }, { name: "inventoryAmount", type: "uint256" },
      { name: "minOrderAmount", type: "uint256" }, { name: "maxOrderAmount", type: "uint256" }
    ], outputs: [],
  },
  {
    type: "function", name: "addListingInventory", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [],
  },
  {
    type: "function", name: "withdrawListingInventory", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [],
  },
  {
    type: "function", name: "updateListingPrice", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }, { name: "newPrice", type: "uint256" }], outputs: [],
  },
  {
    type: "function", name: "updateListingOrderLimits", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }, { name: "newMinOrderAmount", type: "uint256" }, { name: "newMaxOrderAmount", type: "uint256" }], outputs: [],
  },
  { type: "function", name: "pauseListing", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "resumeListing", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "closeListing", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  {
    type: "function", name: "claimable", stateMutability: "view",
    inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "withdrawClaimable", stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }], outputs: [],
  },
  {
    type: "function", name: "createOrder", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }, { name: "tokenAmount", type: "uint256" }], outputs: [{ name: "orderId", type: "uint256" }],
  },
  { type: "function", name: "fundOrder", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { type: "function", name: "completeOrder", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { type: "function", name: "autoReleaseOrder", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { type: "function", name: "expireOrder", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  {
    type: "event", name: "OrderCreated", anonymous: false,
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" }, { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "buyer", type: "address" }, { indexed: false, name: "seller", type: "address" },
      { indexed: false, name: "recipient", type: "address" }, { indexed: false, name: "tokenAmount", type: "uint256" },
      { indexed: false, name: "unitPrice", type: "uint256" }, { indexed: false, name: "grossPayment", type: "uint256" },
      { indexed: false, name: "paymentToken", type: "address" },
    ],
  },
] as const;

export const registryAbi = [
  {
    type: "function", name: "getToken", stateMutability: "view", inputs: [{ name: "tokenId", type: "bytes32" }],
    outputs: [{ name: "token", type: "tuple", components: [
      { name: "chainId", type: "uint256" }, { name: "contractAddress", type: "address" }, { name: "decimalsSnapshot", type: "uint8" },
      { name: "status", type: "uint8" }, { name: "registeredBy", type: "address" }, { name: "registeredAt", type: "uint64" }
    ] }],
  },
] as const;

export const erc20MetadataAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export const erc20PaymentAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;
