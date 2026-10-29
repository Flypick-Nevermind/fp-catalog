import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${process.env.NEXT_PUBLIC_STORE_NAME || "FP Catalog"} — Katalog Produk Resmi`,
    template: `%s | ${process.env.NEXT_PUBLIC_STORE_NAME || "FP Catalog"}`,
  },
  description:
    "Katalog produk modern dan responsif. Lihat spesifikasi lengkap dan pesan langsung melalui WhatsApp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

