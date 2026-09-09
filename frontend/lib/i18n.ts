export const languages = {
  en: "English",
  id: "Bahasa Indonesia",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
} as const;

export type Language = keyof typeof languages;

export const translations: Record<Language, Record<string, string>> = {
  en: {
    tagline: "Own What’s Next.",
    marketplace: "Marketplace",
    language: "Language",
    network: "Base Sepolia",
    connect: "Connect Wallet",
    foundation: "USTETU Web3 Marketplace",
  },
  id: {
    tagline: "Own What’s Next.",
    marketplace: "Marketplace",
    language: "Bahasa",
    network: "Base Sepolia",
    connect: "Hubungkan Wallet",
    foundation: "Marketplace Web3 USTETU",
  },
  zh: {
    tagline: "Own What’s Next.",
    marketplace: "市场",
    language: "语言",
    network: "Base Sepolia",
    connect: "连接钱包",
    foundation: "USTETU Web3 市场",
  },
  ja: {
    tagline: "Own What’s Next.",
    marketplace: "マーケットプレイス",
    language: "言語",
    network: "Base Sepolia",
    connect: "ウォレット接続",
    foundation: "USTETU Web3 マーケットプレイス",
  },
  ko: {
    tagline: "Own What’s Next.",
    marketplace: "마켓플레이스",
    language: "언어",
    network: "Base Sepolia",
    connect: "지갑 연결",
    foundation: "USTETU Web3 마켓플레이스",
  },
};

export const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("ustetu-language") as Language | null;
  return saved && saved in languages ? saved : "en";
};
