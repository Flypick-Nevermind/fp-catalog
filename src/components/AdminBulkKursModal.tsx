"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import {
  DEFAULT_CALC_WEIGHT_GRAMS,
  DEFAULT_RATE_PER_KG,
  DEFAULT_YUAN_MULTIPLIER,
  extractJastipCalcMeta,
  computeJastipFinalPrice,
} from "@/lib/jastip-calc";
import { bulkUpdateKursAction } from "@/app/actions/product";
import { formatIDR } from "@/lib/utils";

interface AdminBulkKursModalProps {
  products: Product[];
  categories: Category[];
}

export default function AdminBulkKursModal({
  products,
  categories,
}: AdminBulkKursModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Deteksi kurs rata-rata/terakhir yang sedang dipakai produk saat ini
  const currentDefaultMultiplier = useMemo(() => {
    for (const p of products) {
      const meta = extractJastipCalcMeta(p);
      if (meta.yuanPrice > 0 && meta.yuanMultiplier > 0) {
        return meta.yuanMultiplier;
      }
    }
    return DEFAULT_YUAN_MULTIPLIER;
  }, [products]);

  const [newMultiplier, setNewMultiplier] = useState<number>(
    currentDefaultMultiplier
  );
  const [overrideRate, setOverrideRate] = useState<boolean>(false);
  const [newRatePerKg, setNewRatePerKg] = useState<number>(DEFAULT_RATE_PER_KG);
  const [overrideWeight, setOverrideWeight] = useState<boolean>(false);
  const [newWeightGrams, setNewWeightGrams] = useState<number>(
    DEFAULT_CALC_WEIGHT_GRAMS
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Daftar produk yang memiliki data Harga Yuan (¥) sesuai filter kategori
  const previewRows = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategoryId === "all") return true;
        if (selectedCategoryId === "uncategorized") return !p.category_id;
        return p.category_id === selectedCategoryId;
      })
      .map((product) => {
        const meta = extractJastipCalcMeta(product);
        const targetRate = overrideRate ? newRatePerKg : meta.ratePerKg;
        const targetWeightGrams = overrideWeight
          ? newWeightGrams
          : meta.weightGrams;

        const { chargeableKg, finalPrice } = computeJastipFinalPrice({
          weightGrams: targetWeightGrams,
          yuanPrice: meta.yuanPrice,
          yuanMultiplier: Number(newMultiplier) || 0,
          ratePerKg: targetRate,
        });

        const oldPrice = Number(product.price) || 0;
        const diff = finalPrice - oldPrice;

        return {
          product,
          meta,
          targetWeightGrams,
          chargeableKg,
          oldPrice,
          newPrice: finalPrice,
          diff,
          eligible: meta.useAutoCalc && meta.yuanPrice > 0,
        };
      })
      .filter((row) => row.eligible);
  }, [
    products,
    selectedCategoryId,
    newMultiplier,
    overrideRate,
    newRatePerKg,
    overrideWeight,
    newWeightGrams,
  ]);

  const handleOpen = () => {
    setNewMultiplier(currentDefaultMultiplier);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsOpen(true);
  };

  const handleApplyBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewRows.length === 0) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await bulkUpdateKursAction({
      newYuanMultiplier: Number(newMultiplier),
      newRatePerKg: overrideRate ? Number(newRatePerKg) : null,
      newWeightGrams: overrideWeight ? Number(newWeightGrams) : null,
      categoryId: selectedCategoryId,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Gagal memperbarui kurs secara massal.");
      return;
    }

    setSuccessMsg(
      `Berhasil memperbarui harga pada ${res.data?.updatedCount || 0} produk!`
    );
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-2.5 text-xs font-semibold text-sky-800 shadow-2xs transition hover:border-sky-300 hover:bg-sky-100/80"
      >
        <Calculator className="h-4 w-4 text-sky-600" />
        <span>Update Kurs Massal</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Update Kurs Yuan, Berat Tagihan &amp; Tarif Jastip Massal
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hitung ulang otomatis Harga Jual Final (IDR) seluruh produk
                    tanpa perlu edit satu per satu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body Modal */}
            <form
              onSubmit={handleApplyBulkUpdate}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="space-y-4 overflow-y-auto p-6">
                {errorMsg && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Form Pengaturan Kurs & Filter */}
                <div className="grid grid-cols-1 gap-3.5 rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* 1. Pengali Kurs Yuan Baru */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        Pengali Kurs Yuan
                      </label>
                      {newMultiplier !== DEFAULT_YUAN_MULTIPLIER && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewMultiplier(DEFAULT_YUAN_MULTIPLIER)
                          }
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:underline"
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                          Reset 2800
                        </button>
                      )}
                    </div>
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3 focus-within:border-sky-600">
                      <span className="text-xs font-semibold text-slate-400">
                        Rp/&yen;
                      </span>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        required
                        value={newMultiplier}
                        onChange={(e) =>
                          setNewMultiplier(Number(e.target.value) || 0)
                        }
                        className="w-full bg-transparent px-2 py-2 text-sm font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 2. Filter Kategori */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Target Kategori
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-sky-600 focus:outline-none"
                    >
                      <option value="all">Semua Kategori</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          Kategori: {cat.name}
                        </option>
                      ))}
                      <option value="uncategorized">Tanpa Kategori</option>
                    </select>
                  </div>

                  {/* 3. Opsional: Samakan Berat Tagihan (Default 1000g / 1kg) */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={overrideWeight}
                          onChange={(e) => setOverrideWeight(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                        />
                        <span>Set Berat Tagihan</span>
                      </label>
                      {overrideWeight && (
                        <button
                          type="button"
                          onClick={() => setNewWeightGrams(1000)}
                          className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        >
                          1 kg
                        </button>
                      )}
                    </div>
                    <div
                      className={`flex items-center rounded-xl border px-3 ${
                        overrideWeight
                          ? "border-slate-300 bg-white"
                          : "border-slate-200 bg-slate-100 opacity-60"
                      }`}
                    >
                      <input
                        type="number"
                        min={200}
                        step="any"
                        disabled={!overrideWeight}
                        value={newWeightGrams}
                        onChange={(e) =>
                          setNewWeightGrams(Number(e.target.value) || 1000)
                        }
                        className="w-full bg-transparent py-2 text-sm font-semibold text-slate-900 focus:outline-none disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-medium text-slate-400">
                        gr
                      </span>
                    </div>
                  </div>

                  {/* 4. Opsional: Ubah Tarif Jastip / KG */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={overrideRate}
                          onChange={(e) => setOverrideRate(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                        />
                        <span>Ubah Tarif / KG</span>
                      </label>
                      {overrideRate && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setNewRatePerKg(220000)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              newRatePerKg === 220000
                                ? "bg-sky-600 text-white"
                                : "bg-white text-slate-600"
                            }`}
                          >
                            220rb
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewRatePerKg(240000)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              newRatePerKg === 240000
                                ? "bg-sky-600 text-white"
                                : "bg-white text-slate-600"
                            }`}
                          >
                            240rb
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      className={`flex items-center rounded-xl border px-3 ${
                        overrideRate
                          ? "border-slate-300 bg-white"
                          : "border-slate-200 bg-slate-100 opacity-60"
                      }`}
                    >
                      <span className="text-xs font-medium text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={!overrideRate}
                        value={newRatePerKg}
                        onChange={(e) =>
                          setNewRatePerKg(Number(e.target.value) || 0)
                        }
                        className="w-full bg-transparent px-2 py-2 text-sm font-semibold text-slate-900 focus:outline-none disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabel Preview Perubahan Harga */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Pratinjau Perubahan Harga ({previewRows.length} Produk
                      Terdeteksi Memiliki Harga Yuan)
                    </h4>
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-[11px] font-semibold uppercase text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5">Produk</th>
                          <th className="px-3 py-2.5">
                            Yuan &bull; Berat Riil &bull; Tagihan
                          </th>
                          <th className="px-3 py-2.5 text-right">
                            Harga Saat Ini
                          </th>
                          <th className="px-4 py-2.5 text-right">
                            Harga Baru (Rp)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-8 text-center text-slate-400"
                            >
                              Tidak ada produk dengan data Harga Yuan (¥) pada
                              kategori ini.
                            </td>
                          </tr>
                        ) : (
                          previewRows.map((row) => (
                            <tr
                              key={row.product.id}
                              className="hover:bg-slate-50/80"
                            >
                              <td className="px-4 py-2.5 font-medium text-slate-900">
                                <span className="line-clamp-1">
                                  {row.product.name}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                                <span className="font-semibold text-sky-700">
                                  &yen;
                                  {row.meta.yuanPrice.toLocaleString("id-ID")}
                                </span>{" "}
                                &bull;{" "}
                                <span className="text-slate-500">
                                  Riil: {row.meta.actualWeightGrams || "-"}gr
                                </span>{" "}
                                &bull;{" "}
                                <span className="font-medium text-slate-800">
                                  Tagihan: {row.targetWeightGrams}gr
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-500">
                                {formatIDR(row.oldPrice)}
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                                  <ArrowRight className="h-3 w-3 text-slate-400" />
                                  <span>{formatIDR(row.newPrice)}</span>
                                  {row.diff !== 0 && (
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                        row.diff > 0
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-emerald-50 text-emerald-700"
                                      }`}
                                    >
                                      {row.diff > 0 ? "+" : ""}
                                      {row.diff.toLocaleString("id-ID")}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
                <p className="text-xs text-slate-500">
                  Rumus:{" "}
                  <strong className="text-slate-700">
                    (&yen; &times; {Number(newMultiplier).toLocaleString("id-ID")}) + (kg &times; Tarif)
                  </strong>
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || previewRows.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memperbarui...</span>
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4" />
                        <span>
                          Terapkan ke {previewRows.length} Produk
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
