import type { Metadata } from "next";
import Script from "next/script";
import Providers from "./providers";
import "./globals.css";
import "./buy-modal.css";
import "../components/BuyModalStyles.css";
import "../components/HideBuyTxList.css";
import "../components/SystemInfoStyles.css";
import "../components/LivingMinimalStyles.css";
import "../components/MobileResponsive.css";

export const metadata: Metadata = {
  title: "USTETU — Own What’s Next.",
  description: "USTETU Web3 marketplace on Base Mainnet.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ustetu-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HDRSBE7EW9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HDRSBE7EW9');
          `}
        </Script>
      </body>
    </html>
  );
}
