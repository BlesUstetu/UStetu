export const BASE_MAINNET_CHAIN_ID = 8453 as const;
export const BASE_MAINNET_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

// VERIFIED USTETU BASE MAINNET V1 DEPLOYMENT — DO NOT OVERRIDE.
export const USTETU_REGISTRY_ADDRESS = "0x237023EC6A39e59CEbd1D231777308c354ba542F" as const;
export const USTETU_SELLER_REGISTRY_ADDRESS = "0x2e8512a3c9953E5B2f061a4FF694637f78740468" as const;
export const USTETU_ESCROW_ADDRESS = "0x0ffE00bAe47d6b4AD9d6A12ec649dd8866f130ae" as const;
export const USTETU_TOKEN_ADDRESS = "0xdF9Fa2E56c97C91090E1bAe422e830E19A94c557" as const;
export const USTETU_TOKEN_ID = "0xfb1118b849730343ccf4b6788efa54f47c8693399be5911efcd39d65dd290715" as const;

// Current production bootstrap listing. Discovery can be replaced by the indexer
// without changing any escrow transaction flow.
export const USTETU_BOOTSTRAP_LISTING_ID = 1n;
export const USTETU_BOOTSTRAP_SELLER = "0x52dF1Ff4c9CD41869a691627cb1c903e68a3863b" as const;

export const escrowAbi = [
  { type:"function", name:"paymentToken", stateMutability:"view", inputs:[], outputs:[{name:"",type:"address"}] },
  { type:"function", name:"getListing", stateMutability:"view", inputs:[{name:"listingId",type:"uint256"}], outputs:[{name:"listing",type:"tuple",components:[
    {name:"tokenId",type:"uint256"},{name:"seller",type:"address"},{name:"price",type:"uint256"},{name:"inventoryDeposited",type:"uint256"},{name:"inventoryLocked",type:"uint256"},{name:"minOrderAmount",type:"uint256"},{name:"maxOrderAmount",type:"uint256"},{name:"status",type:"uint8"},{name:"createdAt",type:"uint64"},{name:"updatedAt",type:"uint64"}
  ]}]},
  { type:"function", name:"getOrder", stateMutability:"view", inputs:[{name:"orderId",type:"uint256"}], outputs:[{name:"order",type:"tuple",components:[
    {name:"listingId",type:"uint256"},{name:"buyer",type:"address"},{name:"seller",type:"address"},{name:"recipient",type:"address"},{name:"token",type:"address"},{name:"paymentToken",type:"address"},{name:"tokenAmount",type:"uint256"},{name:"unitPrice",type:"uint256"},{name:"grossPayment",type:"uint256"},{name:"marketplaceFee",type:"uint256"},{name:"sellerProceeds",type:"uint256"},{name:"state",type:"uint8"},{name:"createdAt",type:"uint64"},{name:"paidAt",type:"uint64"},{name:"completedAt",type:"uint64"},{name:"expiresAt",type:"uint64"}
  ]}]},
  { type:"function", name:"createListingAndDeposit", stateMutability:"nonpayable", inputs:[
    {name:"listingId",type:"uint256"},{name:"tokenId",type:"bytes32"},{name:"seller",type:"address"},{name:"price",type:"uint256"},{name:"inventoryAmount",type:"uint256"},{name:"minOrderAmount",type:"uint256"},{name:"maxOrderAmount",type:"uint256"}], outputs:[] },
  { type:"function", name:"addListingInventory",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"},{name:"amount",type:"uint256"}],outputs:[]},
  { type:"function", name:"withdrawListingInventory",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"},{name:"amount",type:"uint256"}],outputs:[]},
  { type:"function", name:"updateListingPrice",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"},{name:"newPrice",type:"uint256"}],outputs:[]},
  { type:"function", name:"updateListingOrderLimits",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"},{name:"newMinOrderAmount",type:"uint256"},{name:"newMaxOrderAmount",type:"uint256"}],outputs:[]},
  { type:"function", name:"pauseListing",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"}],outputs:[]},
  { type:"function", name:"resumeListing",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"}],outputs:[]},
  { type:"function", name:"closeListing",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"}],outputs:[]},
  { type:"function", name:"claimable",stateMutability:"view",inputs:[{name:"",type:"address"},{name:"",type:"address"}],outputs:[{name:"",type:"uint256"}]},
  { type:"function", name:"withdrawClaimable",stateMutability:"nonpayable",inputs:[],outputs:[]},
  { type:"function", name:"withdrawMarketplaceFee",stateMutability:"nonpayable",inputs:[],outputs:[]},
  { type:"function", name:"createOrder",stateMutability:"nonpayable",inputs:[{name:"listingId",type:"uint256"},{name:"tokenAmount",type:"uint256"}],outputs:[{name:"orderId",type:"uint256"}]},
  { type:"function", name:"fundOrder",stateMutability:"nonpayable",inputs:[{name:"orderId",type:"uint256"}],outputs:[]},
  { type:"function", name:"completeOrder",stateMutability:"nonpayable",inputs:[{name:"orderId",type:"uint256"}],outputs:[]},
  { type:"function", name:"autoReleaseOrder",stateMutability:"nonpayable",inputs:[{name:"orderId",type:"uint256"}],outputs:[]},
  { type:"function", name:"expireOrder",stateMutability:"nonpayable",inputs:[{name:"orderId",type:"uint256"}],outputs:[]},
  { type:"event", name:"OrderCreated", anonymous:false, inputs:[
    {indexed:true,name:"orderId",type:"uint256"},{indexed:true,name:"listingId",type:"uint256"},{indexed:true,name:"buyer",type:"address"},{indexed:false,name:"seller",type:"address"},{indexed:false,name:"recipient",type:"address"},{indexed:false,name:"tokenAmount",type:"uint256"},{indexed:false,name:"unitPrice",type:"uint256"},{indexed:false,name:"grossPayment",type:"uint256"},{indexed:false,name:"paymentToken",type:"address"}]},
  { type:"event", name:"OrderCompleted", anonymous:false, inputs:[
    {indexed:true,name:"orderId",type:"uint256"},{indexed:true,name:"buyer",type:"address"},{indexed:true,name:"seller",type:"address"},{indexed:false,name:"tokenAmount",type:"uint256"}]}
] as const;

export const registryAbi = [
  {type:"function",name:"getToken",stateMutability:"view",inputs:[{name:"tokenId",type:"bytes32"}],outputs:[{name:"token",type:"tuple",components:[
    {name:"chainId",type:"uint256"},{name:"contractAddress",type:"address"},{name:"decimalsSnapshot",type:"uint8"},{name:"registeredBy",type:"address"},{name:"registeredAt",type:"uint64"}]}]},
  {type:"function",name:"isRegisteredToken",stateMutability:"view",inputs:[{name:"tokenId",type:"bytes32"}],outputs:[{name:"",type:"bool"}]},
] as const;

export const erc20MetadataAbi = [
  {type:"function",name:"name",stateMutability:"view",inputs:[],outputs:[{name:"",type:"string"}]},
  {type:"function",name:"symbol",stateMutability:"view",inputs:[],outputs:[{name:"",type:"string"}]},
  {type:"function",name:"decimals",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint8"}]},
] as const;

export const erc20PaymentAbi = [
  {type:"function",name:"approve",stateMutability:"nonpayable",inputs:[{name:"spender",type:"address"},{name:"value",type:"uint256"}],outputs:[{name:"",type:"bool"}]},
  {type:"function",name:"allowance",stateMutability:"view",inputs:[{name:"owner",type:"address"},{name:"spender",type:"address"}],outputs:[{name:"",type:"uint256"}]},
  {type:"function",name:"balanceOf",stateMutability:"view",inputs:[{name:"account",type:"address"}],outputs:[{name:"",type:"uint256"}]},
  {type:"function",name:"decimals",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint8"}]},
] as const;

export const sellerRegistryAbi = [
  {type:"function",name:"isRegisteredSeller",stateMutability:"view",inputs:[{name:"seller",type:"address"}],outputs:[{name:"",type:"bool"}]},
  {type:"function",name:"getSeller",stateMutability:"view",inputs:[{name:"seller",type:"address"}],outputs:[{name:"seller",type:"tuple",components:[
    {name:"wallet",type:"address"},{name:"withdrawalWallet",type:"address"},{name:"registeredAt",type:"uint64"},{name:"withdrawalWalletChangeEffectiveAt",type:"uint64"}]}]},
  {type:"function",name:"getPendingWithdrawalWallet",stateMutability:"view",inputs:[{name:"seller",type:"address"}],outputs:[{name:"",type:"address"}]},
  {type:"function",name:"registerSeller",stateMutability:"nonpayable",inputs:[{name:"withdrawalWallet",type:"address"}],outputs:[]},
  {type:"function",name:"requestWithdrawalWalletChange",stateMutability:"nonpayable",inputs:[{name:"newWallet",type:"address"}],outputs:[]},
  {type:"function",name:"activateWithdrawalWalletChange",stateMutability:"nonpayable",inputs:[],outputs:[]},
] as const;
