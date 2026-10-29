import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase";
import ProductForm from "@/components/ProductForm";
import { Category } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  let categories: Category[] = [];

  try {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });
    categories = (data as Category[]) || [];
  } catch {
    categories = [];
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Tambah Produk Baru
              </h1>
              <p className="text-xs text-slate-500">
                Unggah foto produk, spesifikasi dinamis, dan detail harga
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProductForm categories={categories} />
      </main>
    </div>
  );
}

