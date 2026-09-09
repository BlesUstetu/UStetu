import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";
import "../components/BuyModalStyles.css";
import "../components/SystemInfoStyles.css";

export const metadata: Metadata = {
  title: "USTETU — Own What’s Next.",
  description: "USTETU Web3 marketplace on Base Sepolia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
