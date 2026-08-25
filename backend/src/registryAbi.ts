export const REGISTRY_ABI = [
  "function getToken(bytes32 tokenId) view returns (uint256 chainId,address contractAddress,uint8 decimalsSnapshot,uint8 status,address registeredBy,uint64 registeredAt)"
] as const;
