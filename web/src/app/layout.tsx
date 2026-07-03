import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

// Keeps the mobile browser chrome in the ink color instead of default white.
export const viewport: Viewport = {
  themeColor: "#0b0e14",
};

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["400", "500", "600"] });

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
      <body className="min-h-full bg-ink text-fg font-sans flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
