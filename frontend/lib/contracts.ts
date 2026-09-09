export const USTETU_REGISTRY_ADDRESS = "0x72ca75932e5Bd1364A889DD6329D6016f78e17A7" as const;
export const USTETU_ESCROW_ADDRESS = "0xe1ffd5c09a65af5Eab1c911e8162722640BC9EcE" as const;
export const USTETU_TOKEN_ADDRESS = "0xF9843db152623AB8B3f164Ea297956261D31434c" as const;
export const USDC_BASE_SEPOLIA_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const USTETU_TOKEN_ID = "0xf19bf134998f50d4a944b0f33819be5eb2a2fc364a99f434399283336e427b10" as const;

export const escrowAbi = [
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        name: "listing",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "seller", type: "address" },
          { name: "paymentToken", type: "address" },
          { name: "price", type: "uint256" },
          { name: "inventoryDeposited", type: "uint256" },
          { name: "inventoryLocked", type: "uint256" },
          { name: "minOrderAmount", type: "uint256" },
          { name: "maxOrderAmount", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
        ],
      },
    ],
  },
] as const;

export const registryAbi = [
  {
    type: "function",
    name: "getToken",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "bytes32" }],
    outputs: [
      {
        name: "token",
        type: "tuple",
        components: [
          { name: "chainId", type: "uint256" },
          { name: "contractAddress", type: "address" },
          { name: "decimalsSnapshot", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "registeredBy", type: "address" },
          { name: "registeredAt", type: "uint64" },
        ],
      },
    ],
  },
] as const;

export const erc20MetadataAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
