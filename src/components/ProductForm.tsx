"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Sparkles,
  ArrowLeft,
  FolderPlus,
  Calculator,
  Scale,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import MultiImageUploader from "@/components/MultiImageUploader";
import {
  saveProductAction,
  createCategoryAction,
} from "@/app/actions/product";
import { Category, Product } from "@/types/database";
import { formatIDR, slugify } from "@/lib/utils";

const DEFAULT_RATE_PER_KG = 220000; // Rp 220.000 / kg sesuai aturan Jastip
const DEFAULT_PROXY_COST_PER_KG = 200000; // Rp 200.000 / kg biaya proxy
const MIN_CHARGEABLE_KG = 0.2; // Minimum 200 gram (0,2 kg)

const formSchema = z.object({
  name: z.string().min(2, "Nama produk minimal 2 karakter"),
  slug: z.string().min(2, "Slug wajib diisi"),
  category_id: z.string().nullable().optional(),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  status: z.enum(["published", "draft"]),
  description: z.string().default(""),
  attributes: z.array(
    z.object({
      key: z.string().min(1, "Nama atribut wajib diisi"),
      value: z.string().min(1, "Nilai atribut wajib diisi"),
    })
  ),
  images: z
    .array(
      z.object({
        image_url: z.string().url(),
        is_primary: z.boolean(),
        order_index: z.number(),
      })
    )
    .min(1, "Minimal unggah 1 foto produk"),
});

type ProductFormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
  initialData?: Product | null;
  categories: Category[];
}

/**
 * Mengekstrak angka gram dari atribut "Berat" jika sedang mode Edit Produk
 */
function extractInitialWeightGrams(product?: Product | null): number {
  if (!product?.attributes) return 200;
  const weightAttr = product.attributes.find(
    (a) => a.key.toLowerCase().includes("berat")
  );
  if (!weightAttr) return 200;

  const val = weightAttr.value.toLowerCase();
  const numMatch = val.match(/(\d+([.,]\d+)?)/);
  if (!numMatch) return 200;

  const parsed = parseFloat(numMatch[1].replace(",", "."));
  if (val.includes("kg") && !val.includes("gr")) {
    return Math.round(parsed * 1000);
  }
  return Math.round(parsed);
}

export default function ProductForm({
  initialData,
  categories: initialCategories,
}: ProductFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [serverError, setServerError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  // State Kalkulator Otomatis Jastip (Berat & Harga)
  const [useAutoCalc, setUseAutoCalc] = useState<boolean>(!initialData);
  const [weightGrams, setWeightGrams] = useState<number>(() =>
    extractInitialWeightGrams(initialData)
  );
  const [ratePerKg, setRatePerKg] = useState<number>(DEFAULT_RATE_PER_KG);
  const [baseItemPrice, setBaseItemPrice] = useState<number>(0);

  const defaultImages =
    initialData?.product_images
      ?.slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((img, idx) => ({
        image_url: img.image_url,
        is_primary: img.is_primary,
        order_index: idx,
      })) || [];

  const defaultAttributes =
    initialData?.attributes && initialData.attributes.length > 0
      ? initialData.attributes
      : [
          { key: "Berat", value: "200 gram" },
          { key: "Bahan", value: "" },
        ];

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      category_id: initialData?.category_id || "",
      price: initialData?.price ?? 44000,
      status: initialData?.status || "published",
      description: initialData?.description || "",
      attributes: defaultAttributes,
      images: defaultImages,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "attributes",
  });

  // Rumus Perhitungan Jastip sesuai Infografis:
  // Berat dikenakan = max(berat_kg, 0.2 kg)
  // Biaya Berat = Berat dikenakan * Tarif per KG (Rp 220.000)
  // Total Harga = Harga Dasar Barang + Biaya Berat
  const actualKg = Math.max(0, (Number(weightGrams) || 0) / 1000);
  const chargeableKg =
    weightGrams > 0 ? Math.max(actualKg, MIN_CHARGEABLE_KG) : 0;
  const isMinWeightApplied =
    weightGrams > 0 && actualKg < MIN_CHARGEABLE_KG;

  const weightCostBuyer = Math.round(chargeableKg * (Number(ratePerKg) || 0));
  const weightCostProxy = Math.round(
    chargeableKg * DEFAULT_PROXY_COST_PER_KG
  );
  const estimatedMargin = weightCostBuyer - weightCostProxy;
  const calculatedTotalPrice =
    Math.round(Number(baseItemPrice) || 0) + weightCostBuyer;

  // Sinkronkan hasil kalkulasi ke field `price` dan atribut `Berat` secara otomatis
  useEffect(() => {
    if (!useAutoCalc) return;

    setValue("price", calculatedTotalPrice, { shouldValidate: true });

    // Update juga baris spesifikasi "Berat" jika ada
    const currentAttrs = getValues("attributes") || [];
    const weightIdx = currentAttrs.findIndex(
      (attr) => attr.key.trim().toLowerCase() === "berat"
    );

    if (weightIdx !== -1 && weightGrams > 0) {
      const formattedWeight =
        weightGrams >= 1000
          ? `${(weightGrams / 1000).toLocaleString("id-ID")} kg (${weightGrams} gr)`
          : `${weightGrams} gram`;
      setValue(`attributes.${weightIdx}.value`, formattedWeight);
    }
  }, [
    useAutoCalc,
    calculatedTotalPrice,
    weightGrams,
    setValue,
    getValues,
  ]);

  const watchedName = watch("name");

  const handleAutoSlug = () => {
    if (watchedName) {
      setValue("slug", slugify(watchedName), { shouldValidate: true });
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsCreatingCategory(true);
    const res = await createCategoryAction(newCategoryName);
    setIsCreatingCategory(false);

    if (res.success && res.data) {
      const created: Category = {
        ...res.data,
        created_at: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, created]);
      setValue("category_id", created.id);
      setNewCategoryName("");
      setShowNewCategoryInput(false);
    } else {
      alert(res.error || "Gagal membuat kategori.");
    }
  };

  const onSubmit = async (values: ProductFormValues) => {
    setServerError(null);

    const response = await saveProductAction({
      id: initialData?.id,
      ...values,
      category_id: values.category_id || null,
    });

    if (!response.success) {
      setServerError(response.error || "Gagal menyimpan produk.");
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Kolom Kiri (2/3): Informasi Dasar, Spesifikasi Dinamis, Deskripsi */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card Info Dasar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-slate-900">
              Informasi Produk
            </h2>

            {/* Nama Produk */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Sepatu Sneakers Limited Edition"
                {...register("name", {
                  onChange: (e) => {
                    if (!initialData) {
                      setValue("slug", slugify(e.target.value), {
                        shouldValidate: true,
                      });
                    }
                  },
                })}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Slug URL */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Slug URL <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoSlug}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate dari Nama
                </button>
              </div>
              <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3.5">
                <span className="text-xs text-slate-400 select-none">
                  /product/
                </span>
                <input
                  type="text"
                  placeholder="sepatu-sneakers-limited-edition"
                  {...register("slug")}
                  className="w-full bg-transparent px-2 py-2.5 text-sm text-slate-900 focus:outline-none"
                />
              </div>
              {errors.slug && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.slug.message}
                </p>
              )}
            </div>

            {/* Deskripsi Produk */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Deskripsi Lengkap
              </label>
              <textarea
                rows={5}
                placeholder="Tuliskan deskripsi detail produk, estimasi PO/Jastip, ukuran, atau catatan pemesanan..."
                {...register("description")}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          {/* Card Dynamic Specification Builder */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Spesifikasi Produk (Atribut Dinamis)
                </h2>
                <p className="text-xs text-slate-500">
                  Atribut &ldquo;Berat&rdquo; otomatis tersinkronisasi saat Anda mengubah
                  berat di kalkulator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => append({ key: "", value: "" })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Tambah Baris
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                Belum ada spesifikasi produk. Klik &ldquo;Tambah Baris&rdquo; untuk
                menambahkan.
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-start gap-3 rounded-xl bg-slate-50/70 p-2.5"
                  >
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Label (mis: Berat / Bahan)"
                        {...register(`attributes.${index}.key`)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                      {errors.attributes?.[index]?.key && (
                        <p className="mt-1 text-[11px] text-red-600">
                          {errors.attributes[index]?.key?.message}
                        </p>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Nilai (mis: 500 gram)"
                        {...register(`attributes.${index}.value`)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                      {errors.attributes?.[index]?.value && (
                        <p className="mt-1 text-[11px] text-red-600">
                          {errors.attributes[index]?.value?.message}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Hapus baris spesifikasi"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card Multi-Image Uploader */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Galeri Foto Produk <span className="text-red-500">*</span>
              </h2>
              <p className="text-xs text-slate-500">
                Unggah satu atau beberapa foto produk. Klik &ldquo;Set Cover&rdquo; untuk
                memilih foto utama katalog.
              </p>
            </div>

            <Controller
              control={control}
              name="images"
              render={({ field }) => (
                <MultiImageUploader
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.images?.message}
                />
              )}
            />
          </div>
        </div>

        {/* Kolom Kanan (1/3): Kalkulator Berat Jastip, Harga, Kategori & Tombol Simpan */}
        <div className="space-y-6">
          {/* KALKULATOR OTOMATIS JASTIP & BERAT */}
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/70 to-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Kalkulator Jastip (Per KG)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Rumus: max(berat, 0,2 kg) &times; Tarif/kg
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={useAutoCalc}
                  onChange={(e) => setUseAutoCalc(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                Otomatis
              </label>
            </div>

            {useAutoCalc && (
              <div className="space-y-4 pt-1">
                {/* 1. Input Berat Barang (Gram) */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Berat Barang (Gram)
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700">
                      <Scale className="h-3 w-3" />
                      Dikenakan:{" "}
                      <strong>
                        {chargeableKg.toLocaleString("id-ID")} kg
                      </strong>
                      {isMinWeightApplied && " (Min 200gr)"}
                    </span>
                  </div>
                  <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-sky-600">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={weightGrams}
                      onChange={(e) => setWeightGrams(Number(e.target.value))}
                      placeholder="Contoh: 500"
                      className="w-full bg-transparent py-2 text-sm font-semibold text-slate-900 focus:outline-none"
                    />
                    <span className="text-xs font-medium text-slate-400">
                      gram
                    </span>
                  </div>

                  {/* Preset Cepat Berat Sesuai Tabel Infografis */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { label: "100 gr", val: 100 },
                      { label: "200 gr", val: 200 },
                      { label: "500 gr", val: 500 },
                      { label: "1 kg", val: 1000 },
                      { label: "2,5 kg", val: 2500 },
                      { label: "5 kg", val: 5000 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setWeightGrams(preset.val)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                          weightGrams === preset.val
                            ? "bg-sky-600 text-white shadow-2xs"
                            : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Input Harga Asli Barang (Opsional) */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Harga Barang Dasar (Rp){" "}
                    <span className="font-normal text-slate-400">
                      (Isi 0 jika hanya hitung tarif berat)
                    </span>
                  </label>
                  <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-sky-600">
                    <span className="text-xs font-medium text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={baseItemPrice}
                      onChange={(e) =>
                        setBaseItemPrice(Number(e.target.value))
                      }
                      placeholder="0"
                      className="w-full bg-transparent px-2 py-2 text-sm text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. Tarif Jastip per KG (Default Rp 220.000/kg) */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Tarif Jastip per KG
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRatePerKg(220000)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          ratePerKg === 220000
                            ? "bg-sky-100 text-sky-800"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        220rb (Standar)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRatePerKg(240000)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          ratePerKg === 240000
                            ? "bg-sky-100 text-sky-800"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        240rb (Margin Sehat)
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-sky-600">
                    <span className="text-xs font-medium text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={ratePerKg}
                      onChange={(e) => setRatePerKg(Number(e.target.value))}
                      className="w-full bg-transparent px-2 py-2 text-sm text-slate-900 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">/kg</span>
                  </div>
                </div>

                {/* Ringkasan Hitungan & Estimasi Untung */}
                <div className="rounded-xl border border-sky-200/80 bg-white p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      Biaya Berat ({chargeableKg.toLocaleString("id-ID")} kg &times;{" "}
                      {formatIDR(ratePerKg)})
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatIDR(weightCostBuyer)}
                    </span>
                  </div>

                  {baseItemPrice > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Harga Barang Dasar</span>
                      <span className="font-semibold text-slate-900">
                        {formatIDR(baseItemPrice)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-emerald-700">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Est. Untung Berat (vs Proxy 200rb/kg)
                    </span>
                    <span className="font-bold">
                      +{formatIDR(estimatedMargin)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-slate-900">
              Publikasi & Harga Final
            </h2>

            {/* Harga Jual Final (IDR) */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Harga Jual Final (IDR) <span className="text-red-500">*</span>
                </label>
                {useAutoCalc && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                    Terisi Otomatis
                  </span>
                )}
              </div>
              <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900">
                <span className="text-sm font-medium text-slate-400">Rp</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="44000"
                  {...register("price", {
                    onChange: () => {
                      // Jika admin mengetik langsung di kolom harga final, matikan auto-override
                      setUseAutoCalc(false);
                    },
                  })}
                  className="w-full bg-transparent px-2.5 py-2.5 text-base font-bold text-slate-900 focus:outline-none"
                />
              </div>
              {errors.price && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.price.message}
                </p>
              )}
            </div>

            {/* Status Produk */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Status Katalog
              </label>
              <select
                {...register("status")}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="published">Published (Tampil di Publik)</option>
                <option value="draft">Draft (Disembunyikan)</option>
              </select>
            </div>

            {/* Kategori Dropdown + Tambah Kategori Cepat */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Kategori
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCategoryInput((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Kategori Baru
                </button>
              </div>

              <select
                {...register("category_id")}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="">-- Tanpa Kategori --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {showNewCategoryInput && (
                <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nama kategori..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isCreatingCategory}
                    onClick={handleCreateCategory}
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isCreatingCategory ? "..." : "Tambah"}
                  </button>
                </div>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan Produk...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {initialData ? "Simpan Perubahan" : "Terbitkan Produk"}
                  </>
                )}
              </button>

              <Link
                href="/admin"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Batal & Kembali
              </Link>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
