"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileUp,
  Download,
  Info,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import {
  parseProductImportFile,
  ParsedProductImportRow,
  downloadProductsExcel,
} from "@/lib/excel";
import {
  bulkImportProductsAction,
  BulkImportProductItem,
} from "@/app/actions/product";
import { formatIDR, cn } from "@/lib/utils";

interface AdminExcelImportModalProps {
  products: Product[];
  categories: Category[];
  isOpen?: boolean;
  onClose?: () => void;
  showTrigger?: boolean;
}

export default function AdminExcelImportModal({
  products,
  categories,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showTrigger = true,
}: AdminExcelImportModalProps) {
  const router = useRouter();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = typeof controlledIsOpen === "boolean";
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedProductImportRow[]>([]);
  const [forceDraftForNew, setForceDraftForNew] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set existing slugs & names untuk live deteksi Baru vs Update
  const existingSlugSet = new Set(products.map((p) => p.slug.toLowerCase()));
  const existingNameSet = new Set(
    products.map((p) => p.name.trim().toLowerCase())
  );

  const handleOpen = () => {
    if (!isControlled) {
      setInternalIsOpen(true);
    }
    setParseError(null);
    setParsedRows([]);
    setFileName("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
    setParseError(null);
    setParsedRows([]);
    setFileName("");
  };

  const processFile = async (file: File) => {
    setParseError(null);
    setIsParsing(true);
    setFileName(file.name);

    try {
      const result = await parseProductImportFile(file);
      if (result.rows.length === 0) {
        throw new Error("Tidak ada data produk yang ditemukan di dalam file.");
      }
      setParsedRows(result.rows);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Gagal membaca file Excel."
      );
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset file input agar bisa upload file yang sama jika diinginkan
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const validRows = parsedRows.filter((r) => !r.error && r.name.trim());
  const errorRows = parsedRows.filter((r) => r.error);

  const newProductsCount = validRows.filter((r) => {
    const isBySlug = r.slug && existingSlugSet.has(r.slug.toLowerCase());
    const isByName = existingNameSet.has(r.name.trim().toLowerCase());
    return !isBySlug && !isByName;
  }).length;

  const updateProductsCount = validRows.length - newProductsCount;

  const handleConfirmImport = async () => {
    if (validRows.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setParseError(null);

    const payload: BulkImportProductItem[] = validRows.map((r) => ({
      sourceUrl: r.sourceUrl,
      slug: r.slug,
      name: r.name,
      categoryName: r.categoryName,
      status: r.status,
      yuanPrice: r.yuanPrice,
      yuanMultiplier: r.yuanMultiplier,
      actualWeightGrams: r.actualWeightGrams,
      weightGrams: r.weightGrams,
      ratePerKg: r.ratePerKg,
      finalPrice: r.finalPrice,
      description: r.description,
    }));

    const res = await bulkImportProductsAction(payload, {
      forceDraftForNew,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setParseError(res.error || "Gagal mengimpor produk.");
      return;
    }

    alert(
      `Sukses! Berhasil menambahkan ${res.data?.createdCount || 0} produk baru dan memperbarui ${res.data?.updatedCount || 0} produk.`
    );
    handleClose();
    router.refresh();
  };

  return (
    <>
      {/* Tombol Pemicu di Header Admin (jika tidak dipanggil lewat menu gabungan) */}
      {showTrigger && (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
        >
          <Upload className="h-4 w-4 text-sky-600" />
          <span>Upload Excel</span>
        </button>
      )}

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative my-8 flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Upload &amp; Import Produk Massal via Excel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mendukung file .xlsx dan .csv dengan kalkulasi harga Jastip otomatis
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Isi Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Alert Error */}
              {parseError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p className="mt-0.5">{parseError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setParseError(null)}
                    className="text-red-500 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* TAHAP 1: Dropzone File (Tampil saat belum ada file yang diparsing) */}
              {parsedRows.length === 0 && (
                <div className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition cursor-pointer",
                      isParsing
                        ? "border-sky-300 bg-sky-50/50 pointer-events-none"
                        : "border-slate-300 bg-slate-50/50 hover:border-sky-500 hover:bg-sky-50/30"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-sky-600 group-hover:scale-105 transition">
                      {isParsing ? (
                        <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
                      ) : (
                        <FileUp className="h-7 w-7" />
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {isParsing
                          ? `Sedang membaca file ${fileName}...`
                          : "Klik untuk memilih file atau geser file ke sini"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Format file: <span className="font-bold">.xlsx</span> atau{" "}
                        <span className="font-bold">.csv</span>
                      </p>
                    </div>
                  </div>

                  {/* Bantuan Download Template */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <div className="flex items-center gap-2.5">
                      <Info className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        Belum punya formatnya? Download template kosong untuk langsung diisi:
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadProductsExcel([], categories, {
                          isTemplateOnly: true,
                          filenamePrefix: "Template-Upload-Flypick-Catalog",
                        })
                      }
                      className="inline-flex items-center gap-1.5 font-bold text-sky-700 hover:text-sky-900 underline underline-offset-2 shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Template Kosong (.xlsx)
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP 2: Preview & Tinjauan Data Sebelum Disimpan */}
              {parsedRows.length > 0 && (
                <div className="space-y-5">
                  {/* Summary Bar */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          File:
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {fileName}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                          🟢 {newProductsCount} Produk Baru
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">
                          🔵 {updateProductsCount} Update Produk Lama
                        </span>
                        {errorRows.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 font-semibold text-red-800">
                            ⚠️ {errorRows.length} Baris Tidak Lengkap
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setParsedRows([]);
                        setFileName("");
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 self-start sm:self-center"
                    >
                      Ganti File
                    </button>
                  </div>

                  {/* Opsi Status untuk Produk Baru */}
                  {newProductsCount > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900">
                      <input
                        id="forceDraft"
                        type="checkbox"
                        checked={forceDraftForNew}
                        onChange={(e) => setForceDraftForNew(e.target.checked)}
                        className="h-4 w-4 mt-0.5 cursor-pointer rounded border-amber-300 text-slate-900 focus:ring-slate-900"
                      />
                      <label htmlFor="forceDraft" className="cursor-pointer">
                        <span className="font-bold">
                          Simpan produk baru dengan status &ldquo;Draft&rdquo; (Disarankan)
                        </span>
                        <p className="mt-0.5 text-amber-800/80">
                          Produk baru tidak akan langsung tayang ke publik sehingga Anda bisa mengecek dan melengkapi foto produknya terlebih dahulu.
                        </p>
                      </label>
                    </div>
                  )}

                  {/* Tabel Preview */}
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="max-h-80 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 border-b border-slate-200 bg-slate-100 text-slate-600 uppercase font-semibold">
                          <tr>
                            <th className="py-2.5 px-3 text-center">Tipe</th>
                            <th className="py-2.5 px-3">Nama Produk</th>
                            <th className="py-2.5 px-3">Kategori</th>
                            <th className="py-2.5 px-3">Harga Yuan</th>
                            <th className="py-2.5 px-3">Berat Tagihan</th>
                            <th className="py-2.5 px-3">Harga Jual (Rp)</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.map((row, idx) => {
                            const isBySlug =
                              row.slug && existingSlugSet.has(row.slug.toLowerCase());
                            const isByName = existingNameSet.has(
                              row.name.trim().toLowerCase()
                            );
                            const isExisting = isBySlug || isByName;
                            const isErr = Boolean(row.error);

                            return (
                              <tr
                                key={idx}
                                className={cn(
                                  isErr
                                    ? "bg-red-50/50"
                                    : isExisting
                                    ? "hover:bg-sky-50/30"
                                    : "hover:bg-emerald-50/30"
                                )}
                              >
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {isErr ? (
                                    <span className="inline-block rounded px-1.5 py-0.5 font-bold bg-red-100 text-red-800 text-[10px]">
                                      Error
                                    </span>
                                  ) : isExisting ? (
                                    <span className="inline-block rounded px-1.5 py-0.5 font-bold bg-sky-100 text-sky-800 text-[10px]">
                                      Update
                                    </span>
                                  ) : (
                                    <span className="inline-block rounded px-1.5 py-0.5 font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                                      Baru
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-900">
                                    {row.name || (
                                      <span className="text-red-500 italic">
                                        (Nama Kosong)
                                      </span>
                                    )}
                                  </div>
                                  {row.slug && (
                                    <div className="text-[10px] text-slate-400">
                                      /{row.slug}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                  {row.categoryName || (
                                    <span className="italic text-slate-400">
                                      Tanpa Kategori
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                                  {row.yuanPrice > 0 ? (
                                    <span>
                                      &yen;{row.yuanPrice.toLocaleString("id-ID")}{" "}
                                      <span className="text-[10px] text-slate-400">
                                        (&times;{row.yuanMultiplier})
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                                  {row.weightGrams} gr
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900">
                                  {formatIDR(row.finalPrice)}
                                  {row.isPriceCalculated && (
                                    <span className="block text-[10px] font-normal text-sky-600">
                                      (Dihitung Otomatis)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span
                                    className={cn(
                                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                                      row.status === "published"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-amber-50 text-amber-700"
                                    )}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal Action */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Batal
              </button>

              {parsedRows.length > 0 && (
                <button
                  type="button"
                  disabled={validRows.length === 0 || isSubmitting}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sedang Menyimpan Data...
                    </>
                  ) : (
                    <>
                      <span>Simpan {validRows.length} Produk Sekarang</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

