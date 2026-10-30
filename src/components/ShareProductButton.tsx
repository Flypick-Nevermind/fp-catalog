"use client";

import React, { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { formatIDR } from "@/lib/utils";

interface ShareProductButtonProps {
  productName: string;
  productSlug: string;
  productPrice: number;
}

export default function ShareProductButton({
  productName,
  productSlug,
  productPrice,
}: ShareProductButtonProps) {
  const [copied, setCopied] = useState(false);

  const getProductUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return `${baseUrl}/product/${productSlug}`;
  };

  const handleCopyLink = async () => {
    const url = getProductUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback jika clipboard API tidak diizinkan
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    const url = getProductUrl();
    const shareTitle = `${productName} — ${formatIDR(productPrice)}`;
    const shareText = `Cek produk ${productName} (${formatIDR(
      productPrice
    )}) di katalog kami:`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url,
        });
        return;
      } catch {
        // Pengguna membatalkan dialog share native
        return;
      }
    }

    // Fallback ke share WhatsApp jika browser tidak mendukung Web Share API
    const waShareUrl = `https://wa.me/?text=${encodeURIComponent(
      `${shareText}\n${url}`
    )}`;
    window.open(waShareUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700">Link Tersalin!</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 text-slate-500" />
            <span>Salin Link</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleNativeShare}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        <Share2 className="h-3.5 w-3.5 text-slate-500" />
        <span>Bagikan</span>
      </button>
    </div>
  );
}
