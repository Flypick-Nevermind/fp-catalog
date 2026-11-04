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
  FolderInput,
  CheckSquare,
  FileSpreadsheet,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import {
  deleteProductAction,
  toggleProductStatusAction,
  duplicateProductAction,
  bulkUpdateProductStatusAction,
  bulkUpdateProductCategoryAction,
  bulkDeleteProductsAction,
} from "@/app/actions/product";
import AdminCategoryManager from "@/components/AdminCategoryManager";
import AdminBulkKursModal from "@/components/AdminBulkKursModal";
import AdminExcelMenu from "@/components/AdminExcelMenu";
import { downloadProductsExcel } from "@/lib/excel";
import { extractJastipCalcMeta } from "@/lib/jastip-calc";
import { formatIDR, cn } from "@/lib/utils";

type StatusFilter = "all" | "published" | "draft";

export const ADMIN_TABLE_STATE_KEY = "fp_admin_table_state";
export const ADMIN_LAST_EDITED_ID_KEY = "fp_admin_last_edited_id";

interface SavedTableState {
  currentPage: number;
  pageSize: number;
  statusFilter: StatusFilter;
  searchQuery: string;
}

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

  // State Bulk Actions (Centang Banyak Produk Sekaligus)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  // State Filter Status, Pencarian & Pagination (diinisialisasi dari sessionStorage agar tidak reset ke page 1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const saved = sessionStorage.getItem(ADMIN_TABLE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedTableState>;
        if (
          parsed.statusFilter === "all" ||
          parsed.statusFilter === "published" ||
          parsed.statusFilter === "draft"
        ) {
          return parsed.statusFilter;
        }
      }
    } catch {
      // ignore
    }
    return "all";
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = sessionStorage.getItem(ADMIN_TABLE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedTableState>;
        return parsed.searchQuery || "";
      }
    } catch {
      // ignore
    }
    return "";
  });

  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 10;
    try {
      const saved = sessionStorage.getItem(ADMIN_TABLE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedTableState>;
        if (parsed.pageSize && [10, 20, 50].includes(parsed.pageSize)) {
          return parsed.pageSize;
        }
      }
    } catch {
      // ignore
    }
    return 10;
  });

  const [currentPage, setCurrentPage] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = sessionStorage.getItem(ADMIN_TABLE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SavedTableState>;
        if (parsed.currentPage && parsed.currentPage >= 1) {
          return parsed.currentPage;
        }
      }
    } catch {
      // ignore
    }
    return 1;
  });

  const [highlightedProductId, setHighlightedProductId] = useState<
    string | null
  >(null);

  // Simpan perubahan state halaman/filter ke sessionStorage setiap kali berubah
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stateToSave: SavedTableState = {
        currentPage,
        pageSize,
        statusFilter,
        searchQuery,
      };
      sessionStorage.setItem(
        ADMIN_TABLE_STATE_KEY,
        JSON.stringify(stateToSave)
      );
    } catch {
      // ignore
    }
  }, [currentPage, pageSize, statusFilter, searchQuery]);

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

  // Jika baru selesai Edit Produk tertentu, pastikan otomatis membuka halaman tempat produk tersebut berada
  useEffect(() => {
    if (typeof window === "undefined") return;
    const editedId = sessionStorage.getItem(ADMIN_LAST_EDITED_ID_KEY);
    if (!editedId) return;

    sessionStorage.removeItem(ADMIN_LAST_EDITED_ID_KEY);
    setHighlightedProductId(editedId);

    const idxInFiltered = filteredProducts.findIndex((p) => p.id === editedId);
    if (idxInFiltered !== -1) {
      const targetPage = Math.floor(idxInFiltered / pageSize) + 1;
      setCurrentPage(targetPage);
    }

    const timer = setTimeout(() => {
      setHighlightedProductId(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [filteredProducts, pageSize]);

  // Pastikan currentPage tetap valid saat filter atau jumlah produk berkurang
  useEffect(() => {
    if (totalItems > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, totalItems]);

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

    setSelectedIds((prev) => prev.filter((id) => id !== confirmDeleteProduct.id));
    setConfirmDeleteProduct(null);
    router.refresh();
  };

  // Bersihkan ID yang sudah tidak ada di daftar produk terbaru
  useEffect(() => {
    const validSet = new Set(products.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [products]);

  const currentPageIds = useMemo(
    () => paginatedProducts.map((p) => p.id),
    [paginatedProducts]
  );

  const isAllCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedIds.includes(id));

  const isSomeCurrentPageSelected =
    currentPageIds.some((id) => selectedIds.includes(id)) &&
    !isAllCurrentPageSelected;

  const handleToggleSelectRow = (productId: string) => {
    setSelectedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleToggleSelectCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id))
      );
    } else {
      setSelectedIds((prev) => {
        const merged = new Set([...prev, ...currentPageIds]);
        return Array.from(merged);
      });
    }
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredProducts.map((p) => p.id);
    setSelectedIds(allFilteredIds);
  };

  const showNotice = (msg: string) => {
    setBulkNotice(msg);
    setTimeout(() => {
      setBulkNotice((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const handleBulkStatusChange = async (newStatus: "published" | "draft") => {
    if (selectedIds.length === 0 || isBulkProcessing) return;
    setIsBulkProcessing(true);
    const res = await bulkUpdateProductStatusAction(selectedIds, newStatus);
    setIsBulkProcessing(false);

    if (!res.success) {
      alert(res.error || "Gagal mengubah status produk secara massal.");
      return;
    }

    showNotice(
      `Berhasil mengubah ${res.data?.updatedCount || selectedIds.length} produk menjadi ${
        newStatus === "published" ? "Published" : "Draft"
      }.`
    );
    setSelectedIds([]);
    router.refresh();
  };

  const handleBulkMoveCategory = async () => {
    if (selectedIds.length === 0 || !bulkCategoryId || isBulkProcessing) return;
    const targetCategoryId =
      bulkCategoryId === "__NONE__" ? null : bulkCategoryId;
    const categoryName =
      bulkCategoryId === "__NONE__"
        ? "Tanpa Kategori"
        : categories.find((c) => c.id === bulkCategoryId)?.name || "Kategori baru";

    setIsBulkProcessing(true);
    const res = await bulkUpdateProductCategoryAction(
      selectedIds,
      targetCategoryId
    );
    setIsBulkProcessing(false);

    if (!res.success) {
      alert(res.error || "Gagal memindahkan kategori produk secara massal.");
      return;
    }

    showNotice(
      `Berhasil memindahkan ${res.data?.updatedCount || selectedIds.length} produk ke "${categoryName}".`
    );
    setBulkCategoryId("");
    setSelectedIds([]);
    router.refresh();
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0 || isBulkProcessing) return;
    setIsBulkProcessing(true);
    const res = await bulkDeleteProductsAction(selectedIds);
    setIsBulkProcessing(false);

    if (!res.success) {
      alert(res.error || "Gagal menghapus produk secara massal.");
      return;
    }

    showNotice(
      `Berhasil menghapus ${res.data?.deletedCount || selectedIds.length} produk secara permanen.`
    );
    setShowBulkDeleteConfirm(false);
    setSelectedIds([]);
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

        <div className="flex flex-wrap items-center gap-2">
          <AdminExcelMenu
            allProducts={products}
            filteredProducts={filteredProducts}
            selectedIds={selectedIds}
            categories={categories}
            isFiltered={statusFilter !== "all" || Boolean(searchQuery.trim())}
          />
          <AdminBulkKursModal products={products} categories={categories} />
          <AdminCategoryManager categories={categories} products={products} />
          <Link
            href="/admin/products/new"
            prefetch={false}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800"
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
          {/* Notifikasi Sukses Bulk Action */}
          {bulkNotice && (
            <div className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50/90 px-6 py-3 text-xs font-medium text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{bulkNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setBulkNotice(null)}
                className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Toolbar Bulk Actions (Muncul saat ada produk yang dicentang) */}
          {selectedIds.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-sky-200 bg-sky-50/90 px-6 py-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                  <CheckSquare className="h-3.5 w-3.5" />
                  {selectedIds.length} produk dipilih
                </span>

                {selectedIds.length < filteredProducts.length && (
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={handleSelectAllFiltered}
                    className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                  >
                    Pilih Semua ({filteredProducts.length})
                  </button>
                )}

                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => setSelectedIds([])}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900 disabled:opacity-50"
                >
                  Batal Pilih
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Bulk Publish */}
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkStatusChange("published")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isBulkProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Jadikan Published
                </button>

                {/* Bulk Draft */}
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkStatusChange("draft")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-amber-600 disabled:opacity-50"
                >
                  {isBulkProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileEdit className="h-3.5 w-3.5" />
                  )}
                  Jadikan Draft
                </button>

                {/* Bulk Move Category */}
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
                  <FolderInput className="ml-1.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <select
                    value={bulkCategoryId}
                    disabled={isBulkProcessing}
                    onChange={(e) => setBulkCategoryId(e.target.value)}
                    className="bg-transparent py-0.5 pr-2 text-xs font-medium text-slate-800 focus:outline-none"
                  >
                    <option value="">Pindah ke Kategori...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                    <option value="__NONE__">— Tanpa Kategori —</option>
                  </select>
                  <button
                    type="button"
                    disabled={!bulkCategoryId || isBulkProcessing}
                    onClick={handleBulkMoveCategory}
                    className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Pindahkan
                  </button>
                </div>

                {/* Bulk Export Excel */}
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => {
                    const selected = products.filter((p) =>
                      selectedIds.includes(p.id)
                    );
                    downloadProductsExcel(selected, categories, {
                      filenamePrefix: `Produk-Terpilih-${selected.length}-Flypick-Catalog`,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs transition hover:bg-emerald-50 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Export Excel ({selectedIds.length})
                </button>

                {/* Bulk Delete */}
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus ({selectedIds.length})
                </button>
              </div>
            </div>
          )}

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
                  <th className="w-12 pl-6 pr-2 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeCurrentPageSelected;
                      }}
                      onChange={handleToggleSelectCurrentPage}
                      title="Pilih semua produk di halaman ini"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                  </th>
                  <th className="w-12 px-3 py-4 text-center">No</th>
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
                      colSpan={7}
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
                    const isHighlighted = highlightedProductId === product.id;
                    const isSelected = selectedIds.includes(product.id);
                    const calcMeta = extractJastipCalcMeta(product);

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "transition-colors duration-300",
                          isSelected
                            ? "bg-sky-50/70"
                            : isHighlighted
                            ? "bg-sky-50/90 ring-1 ring-inset ring-sky-300"
                            : "hover:bg-slate-50/70"
                        )}
                      >
                        <td className="pl-6 pr-2 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(product.id)}
                            aria-label={`Pilih ${product.name}`}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                        </td>
                        <td className="px-3 py-4 text-center text-xs font-semibold text-slate-500">
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

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {formatIDR(Number(product.price))}
                          </div>
                          {calcMeta.yuanPrice > 0 && (
                            <div className="mt-0.5 text-[11px] font-medium text-sky-700">
                              &yen;{calcMeta.yuanPrice.toLocaleString("id-ID")}{" "}
                              &bull; {calcMeta.weightGrams}gr{" "}
                              <span className="text-slate-400">
                                (&times;
                                {calcMeta.yuanMultiplier.toLocaleString("id-ID")}
                                )
                              </span>
                            </div>
                          )}
                          {calcMeta.actualWeightGrams > 0 && (
                            <div className="text-[10px] text-slate-400">
                              Berat Riil: {calcMeta.actualWeightGrams}gr
                            </div>
                          )}
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
                          <div className="inline-flex items-center gap-1.5">
                            {product.status === "published" && (
                              <Link
                                href={`/product/${product.slug}`}
                                prefetch={false}
                                target="_blank"
                                title="Lihat di Katalog Publik"
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 shadow-2xs"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}

                            <button
                              type="button"
                              disabled={isDuplicating}
                              onClick={() => handleDuplicateProduct(product)}
                              title="Duplikat Produk Ini"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                            >
                              {isDuplicating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-slate-400" />
                              )}
                              <span>Duplikat</span>
                            </button>

                            <Link
                              href={`/admin/products/${product.id}`}
                              prefetch={false}
                              title="Edit Produk"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                              <span>Edit</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProduct(product)}
                              title="Hapus Produk"
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50/60 p-1.5 text-red-600 transition hover:bg-red-100 shadow-2xs"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

      {/* Modal Konfirmasi Hapus Massal (Bulk Delete) */}
      {showBulkDeleteConfirm && selectedIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Hapus {selectedIds.length} Produk Sekaligus?
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="font-bold text-slate-900">
                    {selectedIds.length} produk yang dipilih
                  </span>{" "}
                  secara permanen? Seluruh foto produk terkait di Supabase
                  Storage juga akan dihapus.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isBulkProcessing}
                onClick={handleConfirmBulkDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isBulkProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menghapus {selectedIds.length} Produk...
                  </>
                ) : (
                  `Ya, Hapus ${selectedIds.length} Produk`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
