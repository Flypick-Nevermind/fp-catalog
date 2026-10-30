"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handlePrev = useCallback(() => {
    setIsZoomed(false);
    setActiveIndex((prev) =>
      prev === 0 ? sortedImages.length - 1 : prev - 1
    );
  }, [sortedImages.length]);

  const handleNext = useCallback(() => {
    setIsZoomed(false);
    setActiveIndex((prev) =>
      prev === sortedImages.length - 1 ? 0 : prev + 1
    );
  }, [sortedImages.length]);

  // Navigasi keyboard (ArrowLeft, ArrowRight, Escape) saat Lightbox Fullscreen terbuka
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
        setIsZoomed(false);
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, handlePrev, handleNext]);

  if (sortedImages.length === 0) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400">
        <ImageOff className="mb-2 h-12 w-12 stroke-[1.5]" />
        <span className="text-sm">Belum ada foto produk</span>
      </div>
    );
  }

  const activeImage = sortedImages[activeIndex] || sortedImages[0];

  return (
    <>
      <div className="space-y-4">
        {/* Gambar Utama Besar (Klik untuk Buka Fullscreen Lightbox) */}
        <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage.image_url}
            alt={`${productName} - Foto ${activeIndex + 1}`}
            onClick={() => {
              setIsZoomed(false);
              setIsLightboxOpen(true);
            }}
            className="h-full w-full cursor-zoom-in object-cover transition-all duration-300 group-hover:scale-[1.01]"
          />

          {/* Tombol Perbesar / Fullscreen di Pojok Kanan Atas */}
          <button
            type="button"
            onClick={() => {
              setIsZoomed(false);
              setIsLightboxOpen(true);
            }}
            aria-label="Perbesar foto layar penuh"
            title="Klik untuk memperbesar foto"
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-sm transition hover:bg-white"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Perbesar</span>
          </button>

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

      {/* Modal Fullscreen Lightbox & Zoom */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md"
          onClick={() => {
            setIsLightboxOpen(false);
            setIsZoomed(false);
          }}
        >
          {/* Top Bar Lightbox */}
          <div
            className="flex items-center justify-between px-4 py-4 text-white sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-medium text-slate-300 sm:text-sm">
              <span className="font-semibold text-white">{productName}</span>{" "}
              <span className="ml-2 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                {activeIndex + 1} / {sortedImages.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsZoomed((z) => !z)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                title={isZoomed ? "Perkecil (1x)" : "Perbesar (2x)"}
              >
                {isZoomed ? (
                  <>
                    <ZoomOut className="h-4 w-4" />
                    <span>Perkecil</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-4 w-4" />
                    <span>Zoom 2x</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setIsZoomed(false);
                }}
                aria-label="Tutup tampilan layar penuh"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Area Gambar Utama Fullscreen */}
          <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.image_url}
              alt={`${productName} - Fullscreen ${activeIndex + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed((z) => !z);
              }}
              className={cn(
                "max-h-[75vh] max-w-full rounded-lg object-contain transition-transform duration-300 select-none",
                isZoomed
                  ? "scale-150 sm:scale-[1.85] cursor-zoom-out"
                  : "scale-100 cursor-zoom-in"
              )}
            />

            {sortedImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  aria-label="Foto sebelumnya"
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  aria-label="Foto berikutnya"
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {/* Baris Thumbnail Bawah di dalam Lightbox */}
          {sortedImages.length > 1 && (
            <div
              className="flex justify-center gap-2.5 overflow-x-auto px-4 py-4"
              onClick={(e) => e.stopPropagation()}
            >
              {sortedImages.map((img, idx) => (
                <button
                  key={img.id || `lb-${idx}`}
                  type="button"
                  onClick={() => {
                    setIsZoomed(false);
                    setActiveIndex(idx);
                  }}
                  className={cn(
                    "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                    idx === activeIndex
                      ? "border-white scale-105 opacity-100"
                      : "border-transparent opacity-50 hover:opacity-80"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.image_url}
                    alt={`Thumb ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
