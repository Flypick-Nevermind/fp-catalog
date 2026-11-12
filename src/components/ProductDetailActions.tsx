"use client";

import React, { useState, useEffect } from "react";
import { MessageCircle, ShoppingBag, Plus, Check } from "lucide-react";
import { useInquiryCart } from "@/context/InquiryCartContext";
import { cn } from "@/lib/utils";

interface ProductDetailActionsProps {
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    coverUrl: string | null;
    categoryName?: string;
  };
  phoneNumber?: string;
}

export default function ProductDetailActions({
  product,
  phoneNumber,
}: ProductDetailActionsProps) {
  const { addItem, isInCart, setIsDrawerOpen, totalCount } = useInquiryCart();
  const [pageUrl, setPageUrl] = useState<string>("");
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(window.location.href);
    }
  }, []);

  const fallbackSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const resolvedUrl = pageUrl || `${fallbackSiteUrl}/product/${product.slug}`;

  const rawPhone =
    phoneNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const digitsOnly = rawPhone.replace(/[^0-9]/g, "");
  const cleanPhone = digitsOnly.startsWith("0")
    ? `62${digitsOnly.slice(1)}`
    : digitsOnly;

  const singleMessage = `Halo admin, saya tertarik dengan produk ${product.name} (Link: ${resolvedUrl})`;
  const singleWhatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    singleMessage
  )}`;

  const inCart = isInCart(product.id);

  const handleAddOrOpenCart = () => {
    if (inCart) {
      setIsDrawerOpen(true);
    } else {
      addItem({
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        coverUrl: product.coverUrl,
        categoryName: product.categoryName,
      });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    }
  };

  return (
    <>
      {/* Tombol Aksi di Kolom Detail Produk (Inline Desktop & Tablet/Mobile) */}
      <div className="space-y-3 pt-2">
        {/* Tombol Utama: Pesan Langsung via WhatsApp (1 Produk) */}
        <a
          href={singleWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.99]"
        >
          <MessageCircle className="h-5 w-5 fill-current" />
          <span>Pesan via WhatsApp Sekarang</span>
        </a>

        {/* Tombol Kedua: Tambah ke Titipan / Lihat Titipan */}
        <button
          type="button"
          onClick={handleAddOrOpenCart}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition-all active:scale-[0.99]",
            inCart || justAdded
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-slate-300 bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          {justAdded ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              <span>✓ Berhasil Ditambahkan ke Titipan!</span>
            </>
          ) : inCart ? (
            <>
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
              <span>✓ Sudah di Daftar Titipan (Klik untuk Buka)</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>+ Tambah ke Daftar Titipan (Multi-Produk)</span>
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500">
          Anda bisa titip beberapa produk sekaligus sebelum dikirim ke WhatsApp admin.
        </p>
      </div>

      {/* Sticky Mobile Bottom Bar (Khusus Layar Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5">
          {/* Tombol Titip / Keranjang */}
          <button
            type="button"
            onClick={handleAddOrOpenCart}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs font-bold transition active:scale-95",
              inCart
                ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
            )}
          >
            {inCart ? (
              <>
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                <span>Titipan ({totalCount})</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>+ Titip</span>
              </>
            )}
          </button>

          {/* Tombol Pesan WA Langsung */}
          <a
            href={singleWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-95"
          >
            <MessageCircle className="h-4 w-4 fill-current" />
            <span>Pesan Langsung</span>
          </a>
        </div>
      </div>
    </>
  );
}

