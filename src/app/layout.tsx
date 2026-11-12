import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { InquiryCartProvider } from "@/context/InquiryCartContext";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${process.env.NEXT_PUBLIC_STORE_NAME || "FP Catalog"} — Katalog Produk Resmi`,
    template: `%s | ${process.env.NEXT_PUBLIC_STORE_NAME || "FP Catalog"}`,
  },
  description:
    "Katalog produk modern dan responsif. Lihat spesifikasi lengkap dan pesan langsung melalui WhatsApp.",
  icons: {
    icon: "/assets/flypick-logo.png",
    apple: "/assets/flypick-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={plusJakartaSans.className}>
        <InquiryCartProvider>{children}</InquiryCartProvider>
      </body>
    </html>
  );
}

