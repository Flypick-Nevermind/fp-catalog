import React from "react";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ExternalLink, LogOut, AlertCircle } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase";
import { logoutAdminAction } from "@/app/actions/auth";
import AdminProductTable from "@/components/AdminProductTable";
import { Category, Product } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  noStore();
  let products: Product[] = [];
  let categories: Category[] = [];
  let dbError: string | null = null;

  try {
    const supabase = createSupabaseAdmin();
    const [
      { data: productsData, error: productsErr },
      { data: categoriesData },
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          `
          *,
          categories (id, name, slug),
          product_images (id, product_id, image_url, is_primary, order_index)
        `
        )
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true }),
    ]);

    if (productsErr) {
      dbError = productsErr.message;
    } else {
      products = (productsData as Product[]) || [];
      categories = (categoriesData as Category[]) || [];
    }
  } catch (err) {
    dbError =
      err instanceof Error
        ? err.message
        : "Konfigurasi Supabase belum lengkap.";
  }

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

        {/* Card Statistik Interaktif + Tabel Daftar Produk */}
        <AdminProductTable products={products} categories={categories} />
      </main>
    </div>
  );
}
