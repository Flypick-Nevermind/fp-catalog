"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackToCatalogButtonProps {
  className?: string;
  label?: string;
}

export default function BackToCatalogButton({
  className = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:text-slate-900 active:scale-[0.98]",
  label = "Kembali ke Katalog",
}: BackToCatalogButtonProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    // Prioritaskan router.back() jika ada riwayat halaman di sesi browser yang sama,
    // sehingga posisi scroll dan status filter beranda tetap terjaga
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

