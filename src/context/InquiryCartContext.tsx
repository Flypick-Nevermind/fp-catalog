"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { formatIDR } from "@/lib/utils";

export interface InquiryItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  coverUrl: string | null;
  categoryName?: string;
  quantity: number;
}

interface InquiryCartContextType {
  items: InquiryItem[];
  addItem: (product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    coverUrl: string | null;
    categoryName?: string;
  }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  totalCount: number;
  totalPrice: number;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}

const InquiryCartContext = createContext<InquiryCartContextType | null>(null);

const STORAGE_KEY = "fp_inquiry_cart_items";

export function InquiryCartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith("/admin");

  const [items, setItems] = useState<InquiryItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Muat data dari localStorage saat mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Simpan perubahan ke localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, isLoaded]);

  const addItem = useCallback(
    (product: {
      id: string;
      slug: string;
      name: string;
      price: number;
      coverUrl: string | null;
      categoryName?: string;
    }) => {
      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => i.id === product.id);
        if (existingIndex > -1) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + 1,
          };
          return next;
        }
        return [
          ...prev,
          {
            id: product.id,
            slug: product.slug,
            name: product.name,
            price: Number(product.price) || 0,
            coverUrl: product.coverUrl,
            categoryName: product.categoryName,
            quantity: 1,
          },
        ];
      });
    },
    []
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === productId ? { ...item, quantity } : item
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (productId: string) => {
      return items.some((i) => i.id === productId);
    },
    [items]
  );

  const totalCount = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [items]);

  const totalPrice = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  }, [items]);

  // Generate WhatsApp message & URL
  const generateWhatsAppUrl = useCallback(() => {
    if (items.length === 0) return "#";

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const rawPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
    const digitsOnly = rawPhone.replace(/[^0-9]/g, "");
    const cleanPhone = digitsOnly.startsWith("0")
      ? `62${digitsOnly.slice(1)}`
      : digitsOnly;

    const itemsText = items
      .map((item, idx) => {
        const itemUrl = `${baseUrl}/product/${item.slug}`;
        const itemSubtotal = formatIDR(item.price * item.quantity);
        return `${idx + 1}. *${item.name}*\n   • Jumlah: ${item.quantity} pcs\n   • Estimasi: ${itemSubtotal}\n   • Link: ${itemUrl}`;
      })
      .join("\n\n");

    const message = `Halo admin, saya ingin titip pesan barang-barang berikut dari katalog:\n\n${itemsText}\n\n*Total Estimasi: ${formatIDR(
      totalPrice
    )} (${totalCount} barang)*\n\nMohon info ketersediaan dan ongkirnya ya kak, terima kasih!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }, [items, totalCount, totalPrice]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isInCart,
      totalCount,
      totalPrice,
      isDrawerOpen,
      setIsDrawerOpen,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isInCart,
      totalCount,
      totalPrice,
      isDrawerOpen,
    ]
  );

  return (
    <InquiryCartContext.Provider value={value}>
      {children}

      {/* Sembunyikan floating button & drawer jika di halaman Admin */}
      {!isAdminPage && (
        <>
          {/* Floating Button / Bar "Daftar Titipan" */}
          {totalCount > 0 && !isDrawerOpen && (
            <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6 animate-in fade-in slide-in-from-bottom-5 duration-300">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="group flex items-center gap-3 rounded-full bg-slate-900 px-4 py-3 text-white shadow-2xl shadow-slate-900/40 ring-4 ring-white transition-all hover:bg-slate-800 hover:scale-105 active:scale-95"
              >
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-extrabold text-slate-900 ring-2 ring-slate-900">
                    {totalCount}
                  </span>
                </div>
                <div className="text-left pr-1">
                  <div className="text-[11px] font-semibold text-slate-300">
                    Daftar Titipan ({totalCount})
                  </div>
                  <div className="text-xs font-bold text-white">
                    {formatIDR(totalPrice)}
                  </div>
                </div>
                <div className="rounded-full bg-white/10 p-1 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5 text-slate-200" />
                </div>
              </button>
            </div>
          )}

          {/* Drawer Slide-over Daftar Titipan */}
          {isDrawerOpen && (
            <div className="fixed inset-0 z-50 overflow-hidden">
              {/* Backdrop */}
              <div
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
              />

              <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
                <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
                  {/* Header Drawer */}
                  <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <ShoppingBag className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Daftar Titipan Jastip
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          {totalCount} barang siap ditanyakan ke admin
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* List Barang */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                        <div className="h-16 w-16 mb-3 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <ShoppingBag className="h-8 w-8" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800">
                          Daftar Titipan Masih Kosong
                        </h3>
                        <p className="mt-1 max-w-xs text-xs text-slate-500">
                          Jelajahi katalog kami dan klik tombol{" "}
                          <strong className="text-slate-700">+ Titip</strong>{" "}
                          pada produk yang ingin Anda tanyakan.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsDrawerOpen(false)}
                          className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
                        >
                          Mulai Eksplorasi Katalog
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                          <span>Daftar Barang ({items.length})</span>
                          <button
                            type="button"
                            onClick={clearCart}
                            className="font-medium text-red-600 hover:underline"
                          >
                            Kosongkan Semua
                          </button>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="py-3.5 flex items-start gap-3.5"
                            >
                              {/* Foto Thumbnail */}
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                {item.coverUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.coverUrl}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                    No Img
                                  </div>
                                )}
                              </div>

                              {/* Info & Quantity */}
                              <div className="flex-1 min-w-0">
                                {item.categoryName && (
                                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                                    {item.categoryName}
                                  </span>
                                )}
                                <Link
                                  href={`/product/${item.slug}`}
                                  onClick={() => setIsDrawerOpen(false)}
                                  className="text-xs font-bold text-slate-900 hover:text-slate-700 line-clamp-2"
                                >
                                  {item.name}
                                </Link>
                                <div className="mt-1 text-xs font-semibold text-slate-900">
                                  {formatIDR(item.price)}
                                </div>

                                {/* Quantity Control & Hapus */}
                                <div className="mt-2.5 flex items-center justify-between">
                                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuantity(
                                          item.id,
                                          item.quantity - 1
                                        )
                                      }
                                      className="flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-white hover:text-slate-900"
                                      title="Kurangi jumlah"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="w-8 text-center text-xs font-bold text-slate-900">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuantity(
                                          item.id,
                                          item.quantity + 1
                                        )
                                      }
                                      className="flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-white hover:text-slate-900"
                                      title="Tambah jumlah"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    className="p-1 text-slate-400 hover:text-red-600"
                                    title="Hapus dari daftar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer Drawer (Estimasi & Tombol Kirim ke WhatsApp) */}
                  {items.length > 0 && (
                    <div className="border-t border-slate-200 bg-white p-5 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Total Titipan ({totalCount} pcs)</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {formatIDR(totalPrice)}
                        </span>
                      </div>

                      <a
                        href={generateWhatsAppUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.99]"
                      >
                        <MessageCircle className="h-5 w-5 fill-current" />
                        <span>Kirim Daftar ke WhatsApp</span>
                      </a>

                      <p className="text-center text-[11px] text-slate-400">
                        Admin akan menghitung rincian &amp; mengonfirmasi ketersediaan barang.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </InquiryCartContext.Provider>
  );
}

export function useInquiryCart() {
  const context = useContext(InquiryCartContext);
  if (!context) {
    throw new Error(
      "useInquiryCart must be used within an InquiryCartProvider"
    );
  }
  return context;
}
