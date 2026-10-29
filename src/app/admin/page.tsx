import React from "react";
import Link from "next/link";
import {
  Plus,
  Package,
  CheckCircle2,
  FileEdit,
  ExternalLink,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase";
import { logoutAdminAction } from "@/app/actions/auth";
import AdminProductTable from "@/components/AdminProductTable";
import { Product } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let products: Product[] = [];
  let dbError: string | null = null;

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        *,
        categories (id, name, slug),
        product_images (id, product_id, image_url, is_primary, order_index)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      dbError = error.message;
    } else {
      products = (data as Product[]) || [];
    }
  } catch (err) {
    dbError =
      err instanceof Error
        ? err.message
        : "Konfigurasi Supabase belum lengkap.";
  }

  const totalProducts = products.length;
  const publishedCount = products.filter(
    (p) => p.status === "published"
  ).length;
  const draftCount = products.filter((p) => p.status === "draft").length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Topbar Admin */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-2xs ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/flypick-logo.png"
                alt="Flypick Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Admin Dashboard
              </h1>
              <p className="text-xs text-slate-500">
                Manajemen Produk & Katalog
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <span>Lihat Katalog</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>

            <form action={logoutAdminAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Keluar</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {dbError && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Perhatian Konfigurasi Database</p>
              <p className="mt-0.5 text-xs">{dbError}</p>
            </div>
          </div>
        )}

        {/* Ringkasan Statistik Produk */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Produk
              </p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">
                {totalProducts}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Package className="h-6 w-6" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
                Produk Aktif (Published)
              </p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">
                {publishedCount}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600">
                Produk Draft
              </p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">
                {draftCount}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <FileEdit className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Header Daftar Produk + CTA Tambah */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daftar Produk</h2>
            <p className="text-xs text-slate-500">
              Kelola informasi produk, ketersediaan status, dan galeri foto.
            </p>
          </div>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Produk</span>
          </Link>
        </div>

        {/* Tabel Daftar Produk */}
        <AdminProductTable products={products} />
      </main>
    </div>
  );
}

