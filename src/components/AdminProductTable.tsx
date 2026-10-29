"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Package,
} from "lucide-react";
import { Product } from "@/types/database";
import { deleteProductAction } from "@/app/actions/product";
import { formatIDR, cn } from "@/lib/utils";

interface AdminProductTableProps {
  products: Product[];
}

export default function AdminProductTable({
  products,
}: AdminProductTableProps) {
  const router = useRouter();
  const [confirmDeleteProduct, setConfirmDeleteProduct] =
    useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const getCoverImage = (product: Product): string | null => {
    const imgs = product.product_images;
    if (!imgs || imgs.length === 0) return null;
    const primary = imgs.find((i) => i.is_primary);
    if (primary) return primary.image_url;
    return imgs[0]?.image_url || null;
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

  if (products.length === 0) {
    return (
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
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Produk</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Harga</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => {
                const coverUrl = getCoverImage(product);
                return (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
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
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                          product.status === "published"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                            : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            product.status === "published"
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                          )}
                        />
                        {product.status === "published" ? "Published" : "Draft"}
                      </span>
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
              })}
            </tbody>
          </table>
        </div>
      </div>

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
    </>
  );
}
