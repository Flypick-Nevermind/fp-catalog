"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { ProductImage } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export default function ProductGallery({
  images,
  productName,
}: ProductGalleryProps) {
  // Urutkan gambar: is_primary di urutan pertama, lalu berdasarkan order_index
  const sortedImages = useMemo(() => {
    if (!images || images.length === 0) return [];
    return [...images].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.order_index - b.order_index;
    });
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);

  if (sortedImages.length === 0) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400">
        <ImageOff className="mb-2 h-12 w-12 stroke-[1.5]" />
        <span className="text-sm">Belum ada foto produk</span>
      </div>
    );
  }

  const activeImage = sortedImages[activeIndex] || sortedImages[0];

  const handlePrev = () => {
    setActiveIndex((prev) =>
      prev === 0 ? sortedImages.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setActiveIndex((prev) =>
      prev === sortedImages.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <div className="space-y-4">
      {/* Gambar Utama Besar */}
      <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeImage.image_url}
          alt={`${productName} - Foto ${activeIndex + 1}`}
          className="h-full w-full object-cover transition-all duration-300"
        />

        {/* Navigasi Panah jika gambar lebih dari 1 */}
        {sortedImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Foto sebelumnya"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Foto berikutnya"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 right-3 rounded-full bg-slate-900/75 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {activeIndex + 1} / {sortedImages.length}
            </div>
          </>
        )}
      </div>

      {/* Carousel Baris Thumbnail */}
      {sortedImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
          {sortedImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={img.id || `${img.image_url}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border transition-all",
                  isActive
                    ? "border-slate-900 ring-2 ring-slate-900/20 scale-[1.02]"
                    : "border-slate-200 opacity-70 hover:opacity-100"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.image_url}
                  alt={`Thumbnail ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

