import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

const ESCROW = "0x0ffE00bAe47d6b4AD9d6A12ec649dd8866f130ae";
const REGISTRY = "0x237023EC6A39e59CEbd1D231777308c354ba542F";
const DNA = "0xDff883676E664E3DBF8ad5F8c00171340efe84FF";
const LISTING_ID = 1217269210020521323519107504975999989n;
const TX = "0x206c22f6d90416b5217f6e55d72886d9f1548ecc8b6f3c08c59c59289ee69c0";

const client = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org", { timeout: 20000, retryCount: 2 })
});
const escrowAbi = parseAbi([
  "function getListing(uint256 listingId) view returns ((uint256 tokenId,address seller,uint256 price,uint256 inventoryDeposited,uint256 inventoryLocked,uint256 minOrderAmount,uint256 maxOrderAmount,uint8 status,uint64 createdAt,uint64 updatedAt) listing)"
]);
const registryAbi = parseAbi([
  "function getTokenId(uint256 chainId,address token) view returns (bytes32)",
  "function getToken(bytes32 tokenId) view returns ((uint256 chainId,address contractAddress,uint8 decimalsSnapshot,address registeredBy,uint64 registeredAt) token)"
]);

const [chainId, listing, expectedId] = await Promise.all([
  client.getChainId(),
  client.readContract({ address: ESCROW, abi: escrowAbi, functionName: "getListing", args: [LISTING_ID] }),
  client.readContract({ address: REGISTRY, abi: registryAbi, functionName: "getTokenId", args: [8453n, DNA] })
]);

// Locate the InventoryDeposited event at the reported block independently
// of the malformed transaction hash, including the actual emitting address.
const reportedBlock = 52063083n;
const paddedListingId = `0x${LISTING_ID.toString(16).padStart(64, "0")}`;
try {
  const logs = await client.getLogs({
    fromBlock: reportedBlock,
    toBlock: reportedBlock,
    topics: [null, paddedListingId]
  });
  console.log("BLOCK_LISTING_ID_LOGS", JSON.stringify(logs.map((log) => ({
    address: log.address,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber?.toString(),
    topics: log.topics,
    data: log.data
  }))));
} catch (error) {
  console.log("BLOCK_LISTING_ID_LOGS_ERROR", String(error));
}

// Do not let a malformed copied transaction hash prevent the authoritative
// Escrow and Registry state reads from completing.
let receipt = null;
if (/^0x[0-9a-fA-F]{64}$/.test(TX)) {
  try {
    receipt = await client.getTransactionReceipt({ hash: TX });
  } catch (error) {
    console.log("TX_RECEIPT_ERROR", String(error));
  }
} else {
  console.log("TX_HASH_INVALID", JSON.stringify({ tx: TX, hexDigits: TX.startsWith("0x") ? TX.length - 2 : TX.length, expectedHexDigits: 64 }));
}

console.log("CHAIN_ID", chainId);
console.log("ESCROW", ESCROW);
console.log("LISTING_ID", LISTING_ID.toString());
console.log("GET_LISTING", JSON.stringify({
  tokenId: listing.tokenId.toString(),
  seller: listing.seller,
  price: listing.price.toString(),
  inventoryDeposited: listing.inventoryDeposited.toString(),
  inventoryLocked: listing.inventoryLocked.toString(),
  minOrderAmount: listing.minOrderAmount.toString(),
  maxOrderAmount: listing.maxOrderAmount.toString(),
  status: Number(listing.status),
  createdAt: listing.createdAt.toString(),
  updatedAt: listing.updatedAt.toString()
}));
console.log("REGISTRY_DERIVED_DNA_TOKEN_ID", expectedId);
try {
  const token = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: "getToken", args: [listing.tokenId === 0n ? expectedId : `0x${listing.tokenId.toString(16).padStart(64, "0")}`] });
  console.log("REGISTRY_GET_TOKEN", JSON.stringify({
    chainId: token.chainId.toString(),
    contractAddress: token.contractAddress,
    decimalsSnapshot: Number(token.decimalsSnapshot),
    registeredBy: token.registeredBy,
    registeredAt: token.registeredAt.toString()
  }));
} catch (error) {
  console.log("REGISTRY_GET_TOKEN_ERROR", String(error));
}
if (receipt) {
  console.log("TX_RECEIPT", JSON.stringify({
    status: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
    to: receipt.to,
    from: receipt.from,
    logs: receipt.logs.map((log) => ({ address: log.address, topics: log.topics, data: log.data }))
  }));
}
