"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  ShoppingBag,
  Plus,
  Check,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import { formatIDR, cn } from "@/lib/utils";
import { useInquiryCart } from "@/context/InquiryCartContext";

type SortOption =
  | "random"
  | "newest"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "name-desc";

type PriceRangeOption =
  | "all"
  | "under-100k"
  | "100k-250k"
  | "250k-500k"
  | "above-500k";

const PRICE_RANGE_OPTIONS: { value: PriceRangeOption; label: string }[] = [
  { value: "all", label: "Semua Harga" },
  { value: "under-100k", label: "Di bawah Rp 100 rb" },
  { value: "100k-250k", label: "Rp 100 rb – 250 rb" },
  { value: "250k-500k", label: "Rp 250 rb – 500 rb" },
  { value: "above-500k", label: "Di atas Rp 500 rb" },
];

const ITEMS_PER_LOAD = 12; // Kelipatan 2 dan 3 agar baris grid 2-kolom & 3-kolom selalu rata

/**
 * Menghasilkan hash skor deterministik untuk produk berdasarkan seed acak.
 * Memastikan urutan acak tetap stabil selama sesi berlangsung dan saat kembali dari detail produk.
 */
function getProductRandomScore(id: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return hash;
}

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
  const { addItem, isInCart, setIsDrawerOpen, totalCount, items: cartItems } =
    useInquiryCart();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<PriceRangeOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("random");
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_LOAD);
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const [randomSeed, setRandomSeed] = useState<number | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const isRestoringRef = useRef(true);
  const isInitialMountRef = useRef(true);
  const catalogContentRef = useRef<HTMLDivElement>(null);

  // 1. Pulihkan posisi scroll, filter kategori, harga, pencarian, dan pagination dari sessionStorage
  useEffect(() => {
    let rafId: number | null = null;
    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;
    let t3: ReturnType<typeof setTimeout> | null = null;
    let highlightTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      // Jika halaman di-refresh/reload langsung, mulai ulang dari filter & sorting default
      const navEntries = performance.getEntriesByType?.("navigation") as
        | PerformanceNavigationTiming[]
        | undefined;
      if (navEntries?.[0]?.type === "reload") {
        sessionStorage.removeItem("fp_catalog_scroll_state");
        isRestoringRef.current = false;
        setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
        return;
      }

      const raw = sessionStorage.getItem("fp_catalog_scroll_state");
      if (!raw) {
        isRestoringRef.current = false;
        setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
        return;
      }

      const saved = JSON.parse(raw);
      // Valid jika disimpan kurang dari 3 jam yang lalu
      if (!saved || Date.now() - (saved.timestamp || 0) > 3 * 60 * 60 * 1000) {
        sessionStorage.removeItem("fp_catalog_scroll_state");
        isRestoringRef.current = false;
        setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
        return;
      }

      isRestoringRef.current = true;
      if (typeof saved.searchQuery === "string") {
        setSearchQuery(saved.searchQuery);
      }
      if (typeof saved.selectedCategory === "string") {
        setSelectedCategory(saved.selectedCategory);
      }
      if (typeof saved.priceRange === "string") {
        setPriceRange(saved.priceRange as PriceRangeOption);
      }
      if (saved.sortBy) {
        setSortBy(saved.sortBy);
      }
      if (saved.randomSeed !== undefined && saved.randomSeed !== null) {
        setRandomSeed(saved.randomSeed);
      } else {
        setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
      }
      if (
        typeof saved.visibleCount === "number" &&
        saved.visibleCount > ITEMS_PER_LOAD
      ) {
        setVisibleCount(saved.visibleCount);
      }
      if (saved.lastClickedSlug) {
        setHighlightedSlug(saved.lastClickedSlug);
      }

      const targetSlug = saved.lastClickedSlug;
      const targetScrollY = saved.scrollY;

      const performScroll = () => {
        if (targetSlug) {
          const el = document.getElementById(`product-${targetSlug}`);
          if (el) {
            el.scrollIntoView({ block: "center", behavior: "auto" });
            return true;
          }
        }
        if (typeof targetScrollY === "number" && targetScrollY > 0) {
          window.scrollTo({ top: targetScrollY, behavior: "auto" });
          return true;
        }
        return false;
      };

      // Eksekusi pemulihan scroll segera setelah render dan beberapa delay pendek
      rafId = requestAnimationFrame(() => {
        performScroll();
        t1 = setTimeout(performScroll, 50);
        t2 = setTimeout(performScroll, 150);
        t3 = setTimeout(() => {
          isRestoringRef.current = false;
          // Konsumsi state satu kali agar refresh atau kunjungan ulang berikutnya kembali ke default
          try {
            sessionStorage.removeItem("fp_catalog_scroll_state");
          } catch {}
        }, 400);
      });

      // Hilangkan penanda highlight produk setelah 2.5 detik
      if (targetSlug) {
        highlightTimer = setTimeout(() => {
          setHighlightedSlug(null);
        }, 2500);
      }
    } catch (e) {
      console.error("Gagal merestorasi status katalog:", e);
      isRestoringRef.current = false;
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
      if (highlightTimer) clearTimeout(highlightTimer);
    };
  }, []);

  // 2. Reset jumlah produk yang tampil ke 12 HANYA jika pengguna manual mengubah filter/pencarian
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (isRestoringRef.current) {
      return;
    }
    setVisibleCount(ITEMS_PER_LOAD);
  }, [searchQuery, selectedCategory, priceRange, sortBy]);

  // Helper scroll halus ke awal daftar produk saat filter diklik dari sidebar
  const scrollToCatalogTop = useCallback(() => {
    if (!catalogContentRef.current) return;
    const rect = catalogContentRef.current.getBoundingClientRect();
    // Jika bagian atas daftar produk sudah terlewat ke atas layar, scroll kembali ke atas katalog
    if (rect.top < 80) {
      catalogContentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      setSelectedCategory(categoryId);
      scrollToCatalogTop();
    },
    [scrollToCatalogTop]
  );

  const handleSelectPriceRange = useCallback(
    (range: PriceRangeOption) => {
      setPriceRange(range);
      scrollToCatalogTop();
    },
    [scrollToCatalogTop]
  );

  // Simpan status katalog sebelum pengguna berpindah ke halaman detail produk
  const handleProductClick = useCallback(
    (slug: string) => {
      try {
        const state = {
          searchQuery,
          selectedCategory,
          priceRange,
          sortBy,
          visibleCount,
          scrollY: window.scrollY,
          lastClickedSlug: slug,
          randomSeed,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(
          "fp_catalog_scroll_state",
          JSON.stringify(state)
        );
      } catch {
        // ignore
      }
    },
    [searchQuery, selectedCategory, priceRange, sortBy, visibleCount, randomSeed]
  );

  // Reset filter pencarian, kategori, harga, & urutan ke default
  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("all");
    setPriceRange("all");
    setSortBy("random");
    setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
    try {
      sessionStorage.removeItem("fp_catalog_scroll_state");
    } catch {}
    scrollToCatalogTop();
  }, [scrollToCatalogTop]);

  // Reset katalog secara penuh jika pengguna mengklik Logo FP Catalog di navbar
  const handleResetCatalog = useCallback(() => {
    try {
      sessionStorage.removeItem("fp_catalog_scroll_state");
    } catch {}
    isRestoringRef.current = false;
    setSearchQuery("");
    setSelectedCategory("all");
    setPriceRange("all");
    setSortBy("random");
    setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
    setVisibleCount(ITEMS_PER_LOAD);
    setHighlightedSlug(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategory === "all"
          ? true
          : selectedCategory === "inquiry_cart"
          ? cartItems.some((ci) => ci.id === product.id)
          : product.category_id === selectedCategory ||
            product.categories?.slug === selectedCategory;

      if (!matchesCategory) return false;

      // Filter rentang harga
      if (priceRange !== "all") {
        const price = Number(product.price);
        if (priceRange === "under-100k" && price >= 100000) return false;
        if (
          priceRange === "100k-250k" &&
          (price < 100000 || price > 250000)
        )
          return false;
        if (
          priceRange === "250k-500k" &&
          (price <= 250000 || price > 500000)
        )
          return false;
        if (priceRange === "above-500k" && price <= 500000) return false;
      }

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const matchesName = product.name.toLowerCase().includes(query);
      const matchesDesc = product.description?.toLowerCase().includes(query);
      const matchesCategoryName = product.categories?.name
        .toLowerCase()
        .includes(query);

      return matchesName || matchesDesc || matchesCategoryName;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "random": {
          if (randomSeed === null) return 0;
          const scoreA = getProductRandomScore(a.id, randomSeed);
          const scoreB = getProductRandomScore(b.id, randomSeed);
          return scoreA !== scoreB ? scoreA - scoreB : a.id.localeCompare(b.id);
        }
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
  }, [
    products,
    selectedCategory,
    priceRange,
    searchQuery,
    sortBy,
    randomSeed,
    cartItems,
  ]);

  const totalFiltered = filteredAndSortedProducts.length;
  const visibleProducts = filteredAndSortedProducts.slice(0, visibleCount);
  const hasMore = visibleCount < totalFiltered;
  const remainingCount = Math.max(0, totalFiltered - visibleCount);

  // Hitung total produk per kategori untuk label filter
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
      if (p.categories?.slug) {
        counts[p.categories.slug] = (counts[p.categories.slug] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const activeCategoryLabel = useMemo(() => {
    if (selectedCategory === "all") return "Semua Produk";
    if (selectedCategory === "inquiry_cart") return "Titipan Saya";
    return (
      categories.find(
        (c) => c.id === selectedCategory || c.slug === selectedCategory
      )?.name || "Kategori"
    );
  }, [selectedCategory, categories]);

  const activePriceLabel = useMemo(() => {
    if (priceRange === "all") return null;
    return (
      PRICE_RANGE_OPTIONS.find((opt) => opt.value === priceRange)?.label || null
    );
  }, [priceRange]);

  const hasActiveFilter =
    selectedCategory !== "all" ||
    priceRange !== "all" ||
    searchQuery.trim() !== "" ||
    sortBy !== "random";

  const activeMobileFilterCount =
    (selectedCategory !== "all" ? 1 : 0) + (priceRange !== "all" ? 1 : 0);

  const getCoverImage = (product: Product): string | null => {
    const imgs = product.product_images;
    if (!imgs || imgs.length === 0) return null;
    const primary = imgs.find((i) => i.is_primary);
    if (primary) return primary.image_url;
    const sorted = [...imgs].sort((a, b) => a.order_index - b.order_index);
    return sorted[0]?.image_url || null;
  };

  // Komponen Isi Filter Sidebar (dipakai baik di Desktop Sidebar maupun Mobile Drawer)
  const renderFilterSections = (isMobile = false) => (
    <div className="space-y-6">
      {/* Bagian Kategori */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          Kategori Produk
        </h3>
        <div
          className={cn(
            "space-y-1",
            !isMobile && "max-h-[340px] overflow-y-auto pr-1"
          )}
        >
          <button
            type="button"
            onClick={() => {
              handleSelectCategory("all");
              if (isMobile) setIsMobileFilterOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-all",
              selectedCategory === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            <span className="truncate">Semua Produk</span>
            <span
              className={cn(
                "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                selectedCategory === "all"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {products.length}
            </span>
          </button>

          {totalCount > 0 && (
            <button
              type="button"
              onClick={() => {
                handleSelectCategory("inquiry_cart");
                if (isMobile) setIsMobileFilterOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all",
                selectedCategory === "inquiry_cart"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Titipan Saya</span>
              </span>
              <span
                className={cn(
                  "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  selectedCategory === "inquiry_cart"
                    ? "bg-white/25 text-white"
                    : "bg-emerald-200/80 text-emerald-900"
                )}
              >
                {totalCount}
              </span>
            </button>
          )}

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const catProductCount =
              categoryCounts[cat.id] ||
              (cat.slug ? categoryCounts[cat.slug] : 0) ||
              0;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  handleSelectCategory(cat.id);
                  if (isMobile) setIsMobileFilterOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-all",
                  isSelected
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <span className="truncate">{cat.name}</span>
                <span
                  className={cn(
                    "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {catProductCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bagian Rentang Harga */}
      <div className="border-t border-slate-100 pt-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          Rentang Harga
        </h3>
        <div className="space-y-1">
          {PRICE_RANGE_OPTIONS.map((option) => {
            const isSelected = priceRange === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  handleSelectPriceRange(option.value);
                  if (isMobile) setIsMobileFilterOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all",
                  isSelected
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-white bg-white"
                      : "border-slate-300 bg-white"
                  )}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                  )}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ringkasan Keranjang Titipan di Sidebar */}
      {totalCount > 0 && (
        <div className="border-t border-slate-100 pt-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
              <span>{totalCount} Barang di Daftar Titipan</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-700">
              Siap dirangkum dan ditanyakan ke WhatsApp admin sekaligus.
            </p>
            <button
              type="button"
              onClick={() => {
                if (isMobile) setIsMobileFilterOpen(false);
                setIsDrawerOpen(true);
              }}
              className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
            >
              Buka Daftar Titipan
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      {/* Header Minimalis dengan Brand & Instant Search Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link
            href="/"
            onClick={handleResetCatalog}
            className="flex items-center gap-3 group"
          >
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

          {/* Search Bar Instan & Tombol Titipan */}
          <div className="flex items-center gap-2.5 w-full sm:max-w-md">
            <div className="relative flex-1">
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

            {totalCount > 0 && (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
                title="Buka Daftar Titipan"
              >
                <div className="relative">
                  <ShoppingBag className="h-4 w-4 text-emerald-600" />
                  <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-white">
                    {totalCount}
                  </span>
                </div>
                <span className="hidden sm:inline">Titipan</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Hero Banner Ringkas & Elegan */}
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm sm:mb-8 sm:p-8">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Koleksi Pilihan Terbaik
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Eksplorasi Katalog Produk Kami
            </h1>
            <p className="text-sm text-slate-300">
              Temukan spesifikasi lengkap setiap produk, kumpulkan ke daftar titipan, dan pesan langsung melalui WhatsApp kami.
            </p>
          </div>
        </div>

        {/* Mobile & Tablet Filter Bar (< lg) */}
        <div className="mb-6 space-y-3 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            {/* Tombol Buka Drawer Filter Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:border-slate-300"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-600" />
              <span>Filter</span>
              {activeMobileFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  {activeMobileFilterCount}
                </span>
              )}
            </button>

            {/* Dropdown Sorting Mobile */}
            <div className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => {
                  const val = e.target.value as SortOption;
                  if (val === "random") {
                    setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
                  }
                  setSortBy(val);
                }}
                aria-label="Urutkan produk"
                className="cursor-pointer rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-7 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 focus:border-slate-900 focus:outline-none"
              >
                <option value="random">Rekomendasi Untuk Kamu</option>
                <option value="newest">Terbaru – Terlama</option>
                <option value="oldest">Terlama – Terbaru</option>
                <option value="price-asc">Termurah – Termahal</option>
                <option value="price-desc">Termahal – Termurah</option>
                <option value="name-asc">Nama: A – Z</option>
                <option value="name-desc">Nama: Z – A</option>
              </select>
            </div>
          </div>

          {/* Quick Horizontal Category Chips (Mobile) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                selectedCategory === "all"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "border border-slate-200 bg-white text-slate-600"
              )}
            >
              Semua ({products.length})
            </button>
            {totalCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategory("inquiry_cart")}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5",
                  selectedCategory === "inquiry_cart"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "border border-emerald-300 bg-emerald-50 text-emerald-800"
                )}
              >
                <ShoppingBag className="h-3 w-3" />
                <span>Titipan ({totalCount})</span>
              </button>
            )}
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const catProductCount =
                categoryCounts[cat.id] ||
                (cat.slug ? categoryCounts[cat.slug] : 0) ||
                0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                    isSelected
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "border border-slate-200 bg-white text-slate-600"
                  )}
                >
                  {cat.name} ({catProductCount})
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout 2 Kolom (Desktop): Filter Sidebar Kiri + Daftar Produk Kanan */}
        <div
          ref={catalogContentRef}
          className="flex flex-col gap-6 scroll-mt-24 lg:flex-row lg:items-start lg:gap-8"
        >
          {/* Sidebar Filter Kiri (Khusus Desktop lg+) */}
          <aside className="hidden w-64 shrink-0 lg:block xl:w-72 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <SlidersHorizontal className="h-4 w-4 text-slate-700" />
                  <span>Filter Katalog</span>
                </div>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {renderFilterSections(false)}
            </div>
          </aside>

          {/* Area Kanan: Toolbar Info + Sorting + Grid Produk */}
          <div className="min-w-0 flex-1">
            {/* Baris Info Kategori Aktif & Dropdown Sorting (Desktop & Info Mobile) */}
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {activeCategoryLabel}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {totalFiltered} produk
                </span>

                {/* Active Filter Pills (Harga / Search) */}
                {activePriceLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    <span>{activePriceLabel}</span>
                    <button
                      type="button"
                      onClick={() => setPriceRange("all")}
                      aria-label="Hapus filter harga"
                      className="rounded-full p-0.5 hover:bg-white/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}

                {searchQuery.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
                    <span>&ldquo;{searchQuery.trim()}&rdquo;</span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Hapus kata kunci"
                      className="rounded-full p-0.5 hover:bg-sky-200/60"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>

              {/* Dropdown Sorting (Desktop) */}
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                <span className="text-xs font-medium text-slate-500">
                  Urutkan:
                </span>
                <div className="relative flex items-center">
                  <ArrowUpDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      const val = e.target.value as SortOption;
                      if (val === "random") {
                        setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
                      }
                      setSortBy(val);
                    }}
                    aria-label="Urutkan produk"
                    className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-8 pr-8 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white focus:border-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="random">Rekomendasi Untuk Kamu</option>
                    <option value="newest">Terbaru – Terlama</option>
                    <option value="oldest">Terlama – Terbaru</option>
                    <option value="price-asc">Harga: Termurah – Termahal</option>
                    <option value="price-desc">Harga: Termahal – Termurah</option>
                    <option value="name-asc">Nama: A – Z</option>
                    <option value="name-desc">Nama: Z – A</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grid Katalog Produk Responsif (1 kolom mobile, 2 kolom tablet, 3 kolom desktop) */}
            {totalFiltered === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 px-4 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <PackageOpen className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Produk Tidak Ditemukan
                </h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Tidak ada produk yang cocok dengan kata kunci atau kombinasi filter yang Anda pilih.
                </p>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Semua Filter</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleProducts.map((product) => {
                    const coverUrl = getCoverImage(product);
                    const categoryName =
                      product.categories?.name || "Koleksi Umum";

                    const isCardHighlighted = highlightedSlug === product.slug;
                    const inCart = isInCart(product.id);

                    return (
                      <article
                        key={product.id}
                        id={`product-${product.slug}`}
                        className={cn(
                          "group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-md",
                          isCardHighlighted
                            ? "border-sky-500 ring-4 ring-sky-500/25 shadow-md"
                            : "border-slate-200/90"
                        )}
                      >
                        {/* Gambar Cover (Aspect Square) */}
                        <Link
                          href={`/product/${product.slug}`}
                          onClick={() => handleProductClick(product.slug)}
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
                        </Link>

                        {/* Body Card */}
                        <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                          <div>
                            {/* Tag Kategori (di bawah gambar agar tidak menutupi logo pada foto produk) */}
                            <div className="mb-2">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/80">
                                {categoryName}
                              </span>
                            </div>

                            <Link
                              href={`/product/${product.slug}`}
                              onClick={() => handleProductClick(product.slug)}
                            >
                              <h3 className="line-clamp-2 text-base font-semibold text-slate-900 transition-colors group-hover:text-slate-700">
                                {product.name}
                              </h3>
                            </Link>
                            <p className="mt-2 text-lg font-bold text-slate-900">
                              {formatIDR(Number(product.price))}
                            </p>
                          </div>

                          {/* Tombol Aksi: + Titip & Detail */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (inCart) {
                                  setIsDrawerOpen(true);
                                } else {
                                  addItem({
                                    id: product.id,
                                    slug: product.slug,
                                    name: product.name,
                                    price: Number(product.price),
                                    coverUrl,
                                    categoryName,
                                  });
                                }
                              }}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all active:scale-95",
                                inCart
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                              )}
                              title={
                                inCart
                                  ? "Sudah di daftar titipan (klik untuk buka)"
                                  : "Tambahkan ke daftar titipan"
                              }
                            >
                              {inCart ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Dititip</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5 text-slate-600" />
                                  <span>Titip</span>
                                </>
                              )}
                            </button>

                            <Link
                              href={`/product/${product.slug}`}
                              onClick={() => handleProductClick(product.slug)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                              <span>Detail</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Bagian Load More & Indikator Jumlah Produk */}
                <div className="mt-10 flex flex-col items-center justify-center gap-4">
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
                          Math.round(
                            (visibleProducts.length / totalFiltered) * 100
                          )
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
                          scrollToCatalogTop();
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
          </div>
        </div>
      </main>

      {/* Drawer Modal Filter untuk Mobile & Tablet (< lg) */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
          <div
            onClick={() => setIsMobileFilterOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <div className="fixed inset-y-0 left-0 flex max-w-full pr-10">
            <div className="flex w-screen max-w-xs flex-col justify-between bg-white shadow-2xl animate-in slide-in-from-left duration-300">
              {/* Header Drawer */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <SlidersHorizontal className="h-4 w-4 text-slate-700" />
                  <span>Filter Katalog</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Konten Filter */}
              <div className="flex-1 overflow-y-auto p-5">
                {renderFilterSections(true)}
              </div>

              {/* Footer Drawer */}
              <div className="flex items-center gap-2.5 border-t border-slate-100 bg-white p-4">
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClearFilters();
                      setIsMobileFilterOpen(false);
                    }}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="flex-[1.5] rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-slate-800"
                >
                  Lihat {totalFiltered} Produk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Minimalis */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} {storeName}. Seluruh hak cipta
            dilindungi.
          </p>
          <p>Pemesanan cepat &amp; resmi terhubung langsung melalui WhatsApp.</p>
        </div>
      </footer>
    </div>
  );
}
