"use client";

import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  productName: string;
  productSlug: string;
  phoneNumber?: string;
}

export default function WhatsAppButton({
  productName,
  productSlug,
  phoneNumber,
}: WhatsAppButtonProps) {
  const [pageUrl, setPageUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(window.location.href);
    }
  }, []);

  const fallbackSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const resolvedUrl = pageUrl || `${fallbackSiteUrl}/product/${productSlug}`;

  const rawPhone =
    phoneNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "6281234567890";
  const cleanPhone = rawPhone.replace(/[^0-9]/g, "");

  // Format pesan sesuai spesifikasi:
  // "Halo, saya tertarik dengan produk [Nama Produk] (Link: [URL Halaman])"
  const message = `Halo, saya tertarik dengan produk ${productName} (Link: ${resolvedUrl})`;
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    message
  )}`;

  return (
    <>
      {/* Tombol CTA Utama di Dalam Konten */}
      <div className="pt-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.99]"
        >
          <MessageCircle className="h-5 w-5 fill-current" />
          <span>Pesan via WhatsApp Sekarang</span>
        </a>
        <p className="mt-2 text-center text-xs text-slate-500">
          Anda akan terhubung langsung dengan admin kami melalui WhatsApp
        </p>
      </div>

      {/* Floating / Sticky CTA Button di Layar Mobile & Desktop */}
      <div className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Tanyakan produk ${productName} via WhatsApp`}
          className="group flex items-center gap-2.5 rounded-full bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-900/25 ring-4 ring-white transition-all hover:bg-emerald-700 hover:pr-6"
        >
          <MessageCircle className="h-5 w-5 fill-current transition-transform group-hover:scale-110" />
          <span>Tanya via WhatsApp</span>
        </a>
      </div>
    </>
  );
}

