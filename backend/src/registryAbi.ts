export const REGISTRY_ABI = [
  "function getToken(bytes32 tokenId) view returns (uint256 chainId,address contractAddress,uint8 decimalsSnapshot,address registeredBy,uint64 registeredAt)",
  "function isRegisteredToken(bytes32 tokenId) view returns (bool)"
] as const;
