import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

// Keeps the mobile browser chrome in the paper color instead of default white.
export const viewport: Viewport = {
  themeColor: "#f4f1e9",
};

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Variable font: the display uses weight 550 (docs/UI_DESIGN_SYSTEM.md, ceiling
// 600) and the optical-size axis for the large hero setting.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Conclave: confidential governance",
  description:
    "Cast encrypted governance votes on Ethereum. Only the outcome is ever revealed, and a passing ballot pays its beneficiary a confidential amount.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink font-sans flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
