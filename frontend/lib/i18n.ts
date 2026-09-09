export const languages = {
  en: "English",
  id: "Indonesian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
} as const;

export type Language = keyof typeof languages;

const en: Record<string, string> = {
  tagline: "Own What’s Next.", marketplace: "Marketplace", language: "Language", network: "Base Sepolia", connect: "Connect Wallet",
  foundation: "USTETU Web3 Marketplace", marketplaceEyebrow: "USTETU MARKETPLACE", findNext: "Find what’s next.", verifiedListings: "Verified token listings on Base Sepolia.",
  searchPlaceholder: "Search contract, token name or symbol", loading: "Loading blockchain data…", listing: "verified listing", listings: "listings", live: "Live",
  token: "Token", seller: "Seller", available: "Available", price: "Price", networkLabel: "Network", view: "View", unableRead: "Unable to read Base Sepolia data.",
  readingListing: "Reading Listing #1 from Escrow…", noMatch: "No matching token found.", verifiedToken: "VERIFIED TOKEN", name: "Name", symbol: "Symbol", decimals: "Decimals", contractAddress: "Contract Address", status: "Status", approved: "APPROVED", copyAddress: "Copy Address", baseScan: "BaseScan ↗", buy: "Buy", systemInfo: "SYSTEM INFORMATION", systemInfoSubtitle: "Understand the transaction flow before you trade.",
  howToBuy: "HOW TO BUY", chooseToken: "Choose Token", enterAmount: "Enter Amount", createOrder: "Create Order", approveUsdc: "Approve USDC", payment: "Payment", complete: "Complete", tokenToWallet: "USTETU → Buyer Wallet", approvalNote: "Approve USDC is only required when the current allowance is insufficient.",
  escrowProtection: "ESCROW PROTECTION", paymentWindow: "Payment window: 15 minutes", paymentWindowDesc: "If payment is not completed, the order expires and locked tokens return to available inventory.", autoRelease: "Auto Release: 24 hours", autoReleaseDesc: "After payment is escrowed, the buyer has 24 hours to complete the order. If not, the escrow can be auto-released.",
  howToSell: "HOW TO SELL", deposit: "Deposit USTETU", createListing: "Create Listing", buyerOrder: "Buyer Order", locked: "Token Locked", receiveUsdc: "Receive USDC", sellerFlow: "Seller funds remain claimable after settlement.", beforeTrade: "BEFORE YOU TRADE", beforeTradeDesc: "A wallet may ask for several confirmations. Complete each required transaction and do not submit the same order again while the current transaction is pending.",
  transactionProgress: "Transaction Progress", buyToken: "Buy Token", amount: "Amount", totalPayment: "Total payment", purchased: "Purchased", txNote: "Transactions are processed directly through the USTETU Escrow smart contract on Base Sepolia.",
  connecting: "Connecting…", close: "Close", systemClose: "Close system information",
};

const id: Record<string, string> = {
  ...en, tagline: "Own What’s Next.", marketplace: "Marketplace", language: "Bahasa", connect: "Hubungkan Wallet", foundation: "Marketplace Web3 USTETU",
  marketplaceEyebrow: "USTETU MARKETPLACE", findNext: "Temukan yang berikutnya.", verifiedListings: "Listing token terverifikasi di Base Sepolia.", searchPlaceholder: "Cari contract, nama token atau simbol", loading: "Memuat data blockchain…", listing: "listing terverifikasi", listings: "listing", live: "Live",
  token: "Token", seller: "Penjual", available: "Tersedia", price: "Harga", networkLabel: "Jaringan", view: "Lihat", unableRead: "Tidak dapat membaca data Base Sepolia.", readingListing: "Membaca Listing #1 dari Escrow…", noMatch: "Token tidak ditemukan.", verifiedToken: "TOKEN TERVERIFIKASI", name: "Nama", symbol: "Simbol", decimals: "Desimal", contractAddress: "Alamat Contract", status: "Status", approved: "DISETUJUI", copyAddress: "Salin Alamat", baseScan: "BaseScan ↗", buy: "Beli", systemInfo: "INFORMASI SISTEM", systemInfoSubtitle: "Pahami alur transaksi sebelum melakukan transaksi.",
  howToBuy: "CARA MEMBELI", chooseToken: "Pilih Token", enterAmount: "Masukkan Jumlah", createOrder: "Buat Order", approveUsdc: "Approve USDC", payment: "Pembayaran", complete: "Selesai", tokenToWallet: "USTETU → Wallet Buyer", approvalNote: "Approve USDC hanya diperlukan jika allowance saat ini tidak mencukupi.", escrowProtection: "PERLINDUNGAN ESCROW", paymentWindow: "Batas pembayaran: 15 menit", paymentWindowDesc: "Jika pembayaran tidak dilakukan, order kedaluwarsa dan token yang terkunci kembali ke inventory tersedia.", autoRelease: "Auto Release: 24 jam", autoReleaseDesc: "Setelah pembayaran masuk escrow, buyer memiliki 24 jam untuk menyelesaikan order. Jika tidak, escrow dapat melakukan auto-release.", howToSell: "CARA MENJUAL", deposit: "Deposit USTETU", createListing: "Buat Listing", buyerOrder: "Order Buyer", locked: "Token Terkunci", receiveUsdc: "Terima USDC", sellerFlow: "Dana seller menjadi claimable setelah settlement.", beforeTrade: "SEBELUM BERTRANSAKSI", beforeTradeDesc: "Wallet dapat meminta beberapa konfirmasi. Selesaikan setiap transaksi yang diperlukan dan jangan mengirim order yang sama lagi saat transaksi sebelumnya masih pending.", transactionProgress: "Progress Transaksi", buyToken: "Beli Token", amount: "Jumlah", totalPayment: "Total pembayaran", purchased: "Sudah Dibeli", txNote: "Transaksi diproses langsung melalui smart contract USTETU Escrow di Base Sepolia.", connecting: "Menghubungkan…", close: "Tutup", systemClose: "Tutup informasi sistem",
};

const zh: Record<string, string> = { ...en, language: "Language", connect: "Connect Wallet", findNext: "Find what’s next.", verifiedListings: "Verified token listings on Base Sepolia.", systemInfo: "SYSTEM INFORMATION", systemInfoSubtitle: "Understand the transaction flow before you trade.", howToBuy: "HOW TO BUY", howToSell: "HOW TO SELL", beforeTrade: "BEFORE YOU TRADE" };
const ja: Record<string, string> = { ...en, language: "Language", connect: "Connect Wallet", findNext: "Find what’s next.", verifiedListings: "Verified token listings on Base Sepolia.", systemInfo: "SYSTEM INFORMATION", systemInfoSubtitle: "Understand the transaction flow before you trade.", howToBuy: "HOW TO BUY", howToSell: "HOW TO SELL", beforeTrade: "BEFORE YOU TRADE" };
const ko: Record<string, string> = { ...en, language: "Language", connect: "Connect Wallet", findNext: "Find what’s next.", verifiedListings: "Verified token listings on Base Sepolia.", systemInfo: "SYSTEM INFORMATION", systemInfoSubtitle: "Understand the transaction flow before you trade.", howToBuy: "HOW TO BUY", howToSell: "HOW TO SELL", beforeTrade: "BEFORE YOU TRADE" };

export const translations: Record<Language, Record<string, string>> = { en, id, zh, ja, ko };

export const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("ustetu-language") as Language | null;
  return saved && saved in languages ? saved : "en";
};
