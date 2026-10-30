"use client";

import React, { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import {
  UploadCloud,
  Star,
  Trash2,
  Loader2,
  AlertCircle,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface UploadedImageItem {
  image_url: string;
  is_primary: boolean;
  order_index: number;
}

interface MultiImageUploaderProps {
  value: UploadedImageItem[];
  onChange: (items: UploadedImageItem[]) => void;
  error?: string;
}

interface PendingUpload {
  id: string;
  fileName: string;
  progressText: string;
}

export default function MultiImageUploader({
  value = [],
  onChange,
  error,
}: MultiImageUploaderProps) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Menormalisasi urutan array foto:
   * Foto pada posisi pertama (index 0) selalu menjadi Cover Utama (is_primary = true)
   * agar urutan #1, #2, #3 di Admin selalu 100% sama dengan yang tampil di halaman pengunjung.
   */
  const normalizeOrderedList = (
    items: UploadedImageItem[]
  ): UploadedImageItem[] => {
    return items.map((item, idx) => ({
      ...item,
      is_primary: idx === 0,
      order_index: idx,
    }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    const fileArray = Array.from(files);

    // Buat daftar indikator loading per file
    const newPending: PendingUpload[] = fileArray.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      fileName: file.name,
      progressText: "Mengompresi WebP...",
    }));

    setPendingUploads((prev) => [...prev, ...newPending]);

    const uploadedResults: UploadedImageItem[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const pendingId = newPending[i].id;

      try {
        // 1. Kompresi di sisi browser (< 200KB, maxWidthOrHeight: 1200px, WebP)
        const compressedBlob = await imageCompression(file, {
          maxSizeMB: 0.19, // ~195 KB (< 200KB)
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: "image/webp",
          initialQuality: 0.82,
        });

        setPendingUploads((prev) =>
          prev.map((item) =>
            item.id === pendingId
              ? { ...item, progressText: "Mengunggah ke Supabase..." }
              : item
          )
        );

        // 2. Buat nama file unik .webp
        const cleanBaseName = file.name
          .replace(/\.[^/.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .slice(0, 40);
        const filePath = `products/${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}-${cleanBaseName}.webp`;

        // 3. Unggah ke Supabase Storage bucket `product-media`
        const { error: storageError } = await supabasePublic.storage
          .from("product-media")
          .upload(filePath, compressedBlob, {
            contentType: "image/webp",
            cacheControl: "3600",
            upsert: false,
          });

        if (storageError) {
          throw new Error(storageError.message);
        }

        // 4. Dapatkan Public URL
        const { data: publicUrlData } = supabasePublic.storage
          .from("product-media")
          .getPublicUrl(filePath);

        if (!publicUrlData?.publicUrl) {
          throw new Error("Gagal mendapatkan URL publik gambar.");
        }

        uploadedResults.push({
          image_url: publicUrlData.publicUrl,
          is_primary: false,
          order_index: value.length + uploadedResults.length,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal mengunggah gambar ke storage.";
        setUploadError(`Gagal memproses "${file.name}": ${message}`);
      } finally {
        setPendingUploads((prev) =>
          prev.filter((item) => item.id !== pendingId)
        );
      }
    }

    if (uploadedResults.length > 0) {
      const merged = [...value, ...uploadedResults];
      onChange(normalizeOrderedList(merged));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Menjadikan foto sebagai Cover Utama sekaligus memindahkannya ke urutan #1
   */
  const handleSetPrimary = (targetIndex: number) => {
    if (targetIndex === 0) return;
    const next = [...value];
    const [picked] = next.splice(targetIndex, 1);
    next.unshift(picked);
    onChange(normalizeOrderedList(next));
  };

  /**
   * Menggeser urutan foto ke kiri atau ke kanan
   */
  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(normalizeOrderedList(next));
  };

  const handleRemoveImage = async (targetIndex: number) => {
    const targetItem = value[targetIndex];

    // Hapus dari bucket jika berasal dari product-media
    const marker = "/storage/v1/object/public/product-media/";
    const markerIdx = targetItem.image_url.indexOf(marker);
    if (markerIdx !== -1) {
      const storagePath = decodeURIComponent(
        targetItem.image_url.slice(markerIdx + marker.length)
      );
      await supabasePublic.storage.from("product-media").remove([storagePath]);
    }

    const remaining = value.filter((_, idx) => idx !== targetIndex);
    onChange(normalizeOrderedList(remaining));
  };

  return (
    <div className="space-y-4">
      {/* Dropzone / Trigger Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all",
          error
            ? "border-red-300 bg-red-50/40 hover:border-red-400"
            : "border-slate-300 bg-slate-50/60 hover:border-slate-900 hover:bg-slate-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-transform group-hover:scale-105">
          <UploadCloud className="h-6 w-6 text-slate-700" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Klik untuk memilih beberapa foto produk
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Otomatis dikompresi ke WebP (Maks. 1200px, &lt; 200KB). Geser panah
          atau drag foto untuk mengatur urutan.
        </p>
      </div>

      {/* Pesan Error Validasi atau Upload */}
      {(error || uploadError) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{uploadError || error}</span>
        </div>
      )}

      {/* Grid Pratinjau Thumbnail */}
      {(value.length > 0 || pendingUploads.length > 0) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {value.map((item, index) => (
            <div
              key={`${item.image_url}-${index}`}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedIndex !== null && draggedIndex !== index) {
                  handleMoveImage(draggedIndex, index);
                }
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className={cn(
                "group relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-slate-100 transition-all active:cursor-grabbing",
                item.is_primary
                  ? "ring-2 ring-slate-900 border-slate-900 shadow-sm"
                  : "border-slate-200",
                draggedIndex === index && "opacity-50 scale-95"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url}
                alt={`Foto produk ${index + 1}`}
                className="h-full w-full object-cover pointer-events-none"
              />

              {/* Badge Nomor Urut & Cover Utama di Bagian Atas */}
              <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-1">
                {item.is_primary ? (
                  <div className="flex items-center gap-1 rounded-full bg-slate-900/90 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    Cover Utama
                  </div>
                ) : (
                  <span />
                )}

                <span className="rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                  #{index + 1}
                </span>
              </div>

              {/* Tombol Geser Kiri / Kanan & Set Cover / Hapus di Bagian Bawah */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <div className="flex items-center justify-between gap-1">
                  {/* Geser Kiri & Kanan */}
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveImage(index, index - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-900 shadow-2xs transition hover:bg-white disabled:opacity-30"
                      title="Geser ke kiri"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === value.length - 1}
                      onClick={() => handleMoveImage(index, index + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-900 shadow-2xs transition hover:bg-white disabled:opacity-30"
                      title="Geser ke kanan"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Set Cover Utama */}
                  {!item.is_primary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(index)}
                      className="flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-2xs transition hover:bg-white"
                      title="Jadikan Cover Utama (#1)"
                    >
                      <Star className="h-3 w-3 text-amber-500" />
                      Cover
                    </button>
                  )}

                  {/* Hapus Foto */}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600/90 text-white shadow-2xs transition hover:bg-red-600"
                    title="Hapus Foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Indikator Loading untuk File yang Sedang Dikompresi/Diunggah */}
          {pendingUploads.map((pending) => (
            <div
              key={pending.id}
              className="flex aspect-square flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center"
            >
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-700" />
              <p className="line-clamp-1 w-full text-xs font-medium text-slate-700">
                {pending.fileName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {pending.progressText}
              </p>
            </div>
          ))}

          {/* Tombol Cepat Tambah Foto Lagi */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
          >
            <ImagePlus className="mb-1.5 h-6 w-6" />
            <span className="text-xs font-medium">Tambah Foto</span>
          </button>
        </div>
      )}
    </div>
  );
}
