"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import Link from "next/link";
import MultiImageUploader from "@/components/MultiImageUploader";
import {
  saveProductAction,
  createCategoryAction,
} from "@/app/actions/product";
import { Category, Product } from "@/types/database";
import { slugify } from "@/lib/utils";

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
      : [{ key: "Bahan", value: "" }];

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      category_id: initialData?.category_id || "",
      price: initialData?.price ?? 0,
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
                placeholder="Contoh: Kemeja Linen Oversize Premium"
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
                  placeholder="kemeja-linen-oversize-premium"
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
                rows={6}
                placeholder="Tuliskan deskripsi detail produk, keunggulan bahan, panduan ukuran, atau cara perawatan..."
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
                  Tambahkan pasangan atribut seperti Bahan, Ukuran, Warna, atau
                  Berat.
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
                        placeholder="Label (mis: Bahan)"
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
                        placeholder="Nilai (mis: Katun Jepang 100%)"
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

        {/* Kolom Kanan (1/3): Status, Harga, Kategori & Tombol Simpan */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-slate-900">
              Publikasi & Harga
            </h2>

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

            {/* Harga IDR */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Harga (IDR) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3.5 focus-within:border-slate-900">
                <span className="text-sm font-medium text-slate-400">Rp</span>
                <input
                  type="number"
                  min={0}
                  step="1000"
                  placeholder="249000"
                  {...register("price")}
                  className="w-full bg-transparent px-2.5 py-2.5 text-sm text-slate-900 focus:outline-none"
                />
              </div>
              {errors.price && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.price.message}
                </p>
              )}
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

