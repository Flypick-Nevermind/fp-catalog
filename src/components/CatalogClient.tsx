"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  X,
  ArrowUpRight,
  PackageOpen,
  Sparkles,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import { formatIDR, cn } from "@/lib/utils";

type SortOption =
  | "oldest"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "name-desc";

const ITEMS_PER_LOAD = 12; // Kelipatan 2, 3, dan 4 agar baris grid selalu rata di semua ukuran layar

interface CatalogClientProps {
  products: Product[];
  categories: Category[];
  storeName?: string;
}

export default function CatalogClient({
  products,
  categories,
  storeName = process.env.NEXT_PUBLIC_STORE_NAME || "FP Catalog",
}: CatalogClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("oldest");
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_LOAD);

  // Reset jumlah produk yang tampil ke 12 setiap kali filter/pencarian/urutan berubah
  useEffect(() => {
    setVisibleCount(ITEMS_PER_LOAD);
  }, [searchQuery, selectedCategory, sortBy]);

  const filteredAndSortedProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" ||
        product.category_id === selectedCategory ||
        product.categories?.slug === selectedCategory;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;

      const matchesName = product.name.toLowerCase().includes(query);
      const matchesDesc = product.description?.toLowerCase().includes(query);
      const matchesCategoryName = product.categories?.name
        .toLowerCase()
        .includes(query);

      return (
        matchesCategory && (matchesName || matchesDesc || matchesCategoryName)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest": {
          const timeDiff =
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
        }
        case "oldest": {
          const timeDiff =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
        }
        case "price-asc":
          return Number(a.price) - Number(b.price);
        case "price-desc":
          return Number(b.price) - Number(a.price);
        case "name-asc":
          return a.name.localeCompare(b.name, "id-ID");
        case "name-desc":
          return b.name.localeCompare(a.name, "id-ID");
        default:
          return 0;
      }
    });
  }, [products, selectedCategory, searchQuery, sortBy]);

  const totalFiltered = filteredAndSortedProducts.length;
  const visibleProducts = filteredAndSortedProducts.slice(0, visibleCount);
  const hasMore = visibleCount < totalFiltered;
  const remainingCount = Math.max(0, totalFiltered - visibleCount);

  const getCoverImage = (product: Product): string | null => {
    const imgs = product.product_images;
    if (!imgs || imgs.length === 0) return null;
    const primary = imgs.find((i) => i.is_primary);
    if (primary) return primary.image_url;
    const sorted = [...imgs].sort((a, b) => a.order_index - b.order_index);
    return sorted[0]?.image_url || null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      {/* Header Minimalis dengan Brand & Instant Search Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200/80 transition-transform group-hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/flypick-logo.png"
                alt={storeName}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                {storeName}
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Official Product Catalog
              </span>
            </div>
          </Link>

          {/* Search Bar Instan */}
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk, kategori, atau bahan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-100/80 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Bersihkan pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Banner Singkat & Elegan */}
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm sm:p-10">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Koleksi Pilihan Terbaik
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
              Eksplorasi Katalog Produk Kami
            </h1>
            <p className="text-sm text-slate-300 sm:text-base">
              Temukan spesifikasi lengkap setiap produk dan pesan langsung
              dengan mudah melalui layanan WhatsApp kami.
            </p>
          </div>
        </div>

        {/* Baris Filter Kategori & Dropdown Sorting Produk */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter Chips / Tabs Kategori Dinamis */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all",
                selectedCategory === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              Semua Produk ({products.length})
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    isSelected
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Dropdown Sorting Produk */}
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <div className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Urutkan produk"
                className="cursor-pointer rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 focus:border-slate-900 focus:outline-none"
              >
                <option value="oldest">Urutan: Terlama – Terbaru</option>
                <option value="newest">Urutan: Terbaru – Terlama</option>
                <option value="price-asc">Harga: Termurah – Termahal</option>
                <option value="price-desc">Harga: Termahal – Termurah</option>
                <option value="name-asc">Nama: A – Z</option>
                <option value="name-desc">Nama: Z – A</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid Katalog Produk Responsif (1 kolom mobile, 3-4 kolom desktop) */}
        {totalFiltered === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 px-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <PackageOpen className="h-7 w-7" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              Produk Tidak Ditemukan
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Tidak ada produk yang cocok dengan kata kunci atau filter kategori
              yang Anda pilih.
            </p>
            {(searchQuery || selectedCategory !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Reset Filter Pencarian
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const coverUrl = getCoverImage(product);
                const categoryName =
                  product.categories?.name || "Koleksi Umum";

                return (
                  <article
                    key={product.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    {/* Gambar Cover (Aspect Square) */}
                    <Link
                      href={`/product/${product.slug}`}
                      className="relative aspect-square w-full overflow-hidden bg-slate-100"
                    >
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          Tanpa Foto
                        </div>
                      )}

                      {/* Badge Kategori */}
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-sm">
                        {categoryName}
                      </span>
                    </Link>

                    {/* Body Card */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <Link href={`/product/${product.slug}`}>
                          <h2 className="line-clamp-2 text-base font-semibold text-slate-900 transition-colors group-hover:text-slate-700">
                            {product.name}
                          </h2>
                        </Link>
                        <p className="mt-2 text-lg font-bold text-slate-900">
                          {formatIDR(Number(product.price))}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100">
                        <Link
                          href={`/product/${product.slug}`}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          <span>Lihat Detail</span>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Bagian Load More & Indikator Jumlah Produk */}
            <div className="mt-12 flex flex-col items-center justify-center gap-4">
              <p className="text-xs font-medium text-slate-500">
                Menampilkan{" "}
                <span className="font-bold text-slate-900">
                  {visibleProducts.length}
                </span>{" "}
                dari{" "}
                <span className="font-bold text-slate-900">
                  {totalFiltered}
                </span>{" "}
                produk
              </p>

              {/* Progress Bar Visual */}
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((visibleProducts.length / totalFiltered) * 100)
                    )}%`,
                  }}
                />
              </div>

              {hasMore ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) => prev + ITEMS_PER_LOAD)
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-xs font-bold text-slate-900 shadow-2xs transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-[0.99]"
                >
                  <span>
                    Muat Lebih Banyak (
                    {Math.min(ITEMS_PER_LOAD, remainingCount)} Produk Lagi)
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              ) : (
                totalFiltered > ITEMS_PER_LOAD && (
                  <button
                    type="button"
                    onClick={() => {
                      setVisibleCount(ITEMS_PER_LOAD);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    <span>Tampilkan Lebih Sedikit</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer Minimalis */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} {storeName}. Seluruh hak cipta
            dilindungi.
          </p>
          <p>Pemesanan cepat & resmi terhubung langsung melalui WhatsApp.</p>
        </div>
      </footer>
    </div>
  );
}
