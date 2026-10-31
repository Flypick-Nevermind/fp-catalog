"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Copy,
  CheckCircle2,
  FileEdit,
  Plus,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import {
  deleteProductAction,
  toggleProductStatusAction,
  duplicateProductAction,
} from "@/app/actions/product";
import AdminCategoryManager from "@/components/AdminCategoryManager";
import { formatIDR, cn } from "@/lib/utils";

type StatusFilter = "all" | "published" | "draft";

interface AdminProductTableProps {
  products: Product[];
  categories?: Category[];
}

export default function AdminProductTable({
  products,
  categories = [],
}: AdminProductTableProps) {
  const router = useRouter();
  const [confirmDeleteProduct, setConfirmDeleteProduct] =
    useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State Loading untuk Quick Toggle Status & Duplicate per Produk
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // State Filter Status (dari klik Card di atas), Pencarian & Pagination
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sinkronisasi daftar produk otomatis untuk multi-user (saat tab fokus atau setiap 5 detik)
  useEffect(() => {
    router.refresh();

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, 5000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      clearInterval(interval);
    };
  }, [router]);

  const totalProducts = products.length;
  const publishedCount = useMemo(
    () => products.filter((p) => p.status === "published").length,
    [products]
  );
  const draftCount = useMemo(
    () => products.filter((p) => p.status === "draft").length,
    [products]
  );

  // Filter berdasarkan Card Status (All / Published / Draft) + Pencarian Cepat
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;
      if (!matchesStatus) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.categories?.name || "").toLowerCase().includes(q)
      );
    });
  }, [products, statusFilter, searchQuery]);

  // Hitung total halaman & potong data sesuai halaman aktif
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Pastikan currentPage tetap valid saat filter atau jumlah produk berubah
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + pageSize
  );

  const handleSelectStatusCard = (target: StatusFilter) => {
    setStatusFilter((prev) =>
      target !== "all" && prev === target ? "all" : target
    );
    setCurrentPage(1);
  };

  const getCoverImage = (product: Product): string | null => {
    const imgs = product.product_images;
    if (!imgs || imgs.length === 0) return null;
    const primary = imgs.find((i) => i.is_primary);
    if (primary) return primary.image_url;
    return imgs[0]?.image_url || null;
  };

  const handleQuickToggleStatus = async (product: Product) => {
    const nextStatus =
      product.status === "published" ? "draft" : "published";
    setTogglingId(product.id);
    const res = await toggleProductStatusAction(product.id, nextStatus);
    setTogglingId(null);

    if (!res.success) {
      alert(res.error || "Gagal mengubah status produk.");
      return;
    }
    router.refresh();
  };

  const handleDuplicateProduct = async (product: Product) => {
    setDuplicatingId(product.id);
    const res = await duplicateProductAction(product.id);
    setDuplicatingId(null);

    if (!res.success) {
      alert(res.error || "Gagal menduplikasi produk.");
      return;
    }
    router.refresh();
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteProduct) return;
    setIsDeleting(true);
    const res = await deleteProductAction(confirmDeleteProduct.id);
    setIsDeleting(false);

    if (!res.success) {
      alert(res.error || "Gagal menghapus produk.");
      return;
    }

    setConfirmDeleteProduct(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* 3 Card Ringkasan Statistik Produk (Dapat Diklik untuk Filter) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Total Produk */}
        <button
          type="button"
          onClick={() => handleSelectStatusCard("all")}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border bg-white p-6 text-left transition-all",
            statusFilter === "all"
              ? "border-slate-900 ring-2 ring-slate-900/15 shadow-sm"
              : "border-slate-200 shadow-2xs hover:border-slate-300 hover:bg-slate-50/50"
          )}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Produk
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {totalProducts}
            </p>
            <span className="mt-2 inline-block text-[11px] font-medium text-slate-400">
              {statusFilter === "all"
                ? "Menampilkan semua produk"
                : "Klik untuk tampilkan semua"}
            </span>
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl transition",
              statusFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            )}
          >
            <Package className="h-6 w-6" />
          </div>
        </button>

        {/* Card 2: Produk Aktif (Published) */}
        <button
          type="button"
          onClick={() => handleSelectStatusCard("published")}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border bg-white p-6 text-left transition-all",
            statusFilter === "published"
              ? "border-emerald-600 ring-2 ring-emerald-600/20 shadow-sm"
              : "border-slate-200 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/20"
          )}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Produk Aktif (Published)
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {publishedCount}
            </p>
            <span className="mt-2 inline-block text-[11px] font-medium text-emerald-600/80">
              {statusFilter === "published"
                ? "Sedang difilter (Klik untuk reset)"
                : "Klik untuk lihat produk aktif"}
            </span>
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl transition",
              statusFilter === "published"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-600"
            )}
          >
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </button>

        {/* Card 3: Produk Draft */}
        <button
          type="button"
          onClick={() => handleSelectStatusCard("draft")}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border bg-white p-6 text-left transition-all",
            statusFilter === "draft"
              ? "border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
              : "border-slate-200 shadow-2xs hover:border-amber-300 hover:bg-amber-50/20"
          )}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Produk Draft
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {draftCount}
            </p>
            <span className="mt-2 inline-block text-[11px] font-medium text-amber-600/80">
              {statusFilter === "draft"
                ? "Sedang difilter (Klik untuk reset)"
                : "Klik untuk lihat produk draft"}
            </span>
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl transition",
              statusFilter === "draft"
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-600"
            )}
          >
            <FileEdit className="h-6 w-6" />
          </div>
        </button>
      </div>

      {/* Header Daftar Produk + CTA Kelola Kategori & Tambah Produk */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900">Daftar Produk</h2>
            {statusFilter !== "all" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  statusFilter === "published"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                )}
              >
                Filter: {statusFilter === "published" ? "Published" : "Draft"}
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                  title="Hapus filter status"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Kelola informasi produk, klik badge status untuk ubah cepat, atau
            duplikat produk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <AdminCategoryManager categories={categories} products={products} />
          <Link
            href="/admin/products/new"
            prefetch={false}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Produk</span>
          </Link>
        </div>
      </div>

      {/* Tabel Daftar Produk */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Belum Ada Produk
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Mulai tambahkan produk pertama Anda ke katalog melalui tombol Tambah
            Produk di atas.
          </p>
          <Link
            href="/admin/products/new"
            prefetch={false}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            + Tambah Produk Baru
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Toolbar Atas Tabel: Pencarian Cepat & Pilihan Jumlah Baris */}
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama produk atau kategori..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-slate-900 focus:outline-none"
              >
                <option value={10}>10 baris</option>
                <option value={20}>20 baris</option>
                <option value={50}>50 baris</option>
              </select>
            </div>
          </div>

          {/* Tabel */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-14 px-6 py-4 text-center">No</th>
                  <th className="px-6 py-4">Produk</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Harga</th>
                  <th className="px-6 py-4">Status (Klik Ubah)</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-xs text-slate-400"
                    >
                      Tidak ada produk{" "}
                      {statusFilter !== "all"
                        ? `berstatus "${
                            statusFilter === "published" ? "Published" : "Draft"
                          }" `
                        : ""}
                      {searchQuery
                        ? `yang cocok dengan pencarian "${searchQuery}".`
                        : "pada kategori ini."}
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product, idx) => {
                    const rowNumber = startIndex + idx + 1;
                    const coverUrl = getCoverImage(product);
                    const isToggling = togglingId === product.id;
                    const isDuplicating = duplicatingId === product.id;

                    return (
                      <tr
                        key={product.id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4 text-center text-xs font-semibold text-slate-500">
                          {rowNumber}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3.5">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                              {coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={coverUrl}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                  No Img
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">
                                {product.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                /{product.slug}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-600">
                          {product.categories?.name || (
                            <span className="text-slate-400 italic">
                              Tanpa Kategori
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 font-medium text-slate-900">
                          {formatIDR(Number(product.price))}
                        </td>

                        <td className="px-6 py-4">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleQuickToggleStatus(product)}
                            title={`Klik untuk ubah menjadi ${
                              product.status === "published"
                                ? "Draft"
                                : "Published"
                            }`}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition hover:scale-105 active:scale-95 disabled:opacity-50",
                              product.status === "published"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 hover:bg-amber-100"
                            )}
                          >
                            {isToggling ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  product.status === "published"
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                                )}
                              />
                            )}
                            {product.status === "published"
                              ? "Published"
                              : "Draft"}
                          </button>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {product.status === "published" && (
                              <Link
                                href={`/product/${product.slug}`}
                                prefetch={false}
                                target="_blank"
                                title="Lihat di Katalog Publik"
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            )}

                            <button
                              type="button"
                              disabled={isDuplicating}
                              onClick={() => handleDuplicateProduct(product)}
                              title="Duplikat Produk Ini"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                            >
                              {isDuplicating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Duplikat
                            </button>

                            <Link
                              href={`/admin/products/${product.id}`}
                              prefetch={false}
                              title="Edit Produk"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </Link>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProduct(product)}
                              title="Hapus Produk"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-4 sm:flex-row">
            <p className="text-xs text-slate-500">
              Menampilkan{" "}
              <span className="font-semibold text-slate-900">
                {totalItems === 0 ? 0 : startIndex + 1}
              </span>{" "}
              –{" "}
              <span className="font-semibold text-slate-900">
                {Math.min(startIndex + pageSize, totalItems)}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-slate-900">{totalItems}</span>{" "}
              produk
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Sebelumnya
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                  )
                  .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                      acc.push("ellipsis");
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1.5 text-xs text-slate-400"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={cn(
                          "h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold transition",
                          currentPage === item
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Berikutnya
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Hapus Produk Ini?
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="font-semibold text-slate-900">
                    &ldquo;{confirmDeleteProduct.name}&rdquo;
                  </span>
                  ? Seluruh foto terkait di Supabase Storage juga akan dihapus
                  permanen.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteProduct(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus Permanen"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
