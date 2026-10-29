import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase";
import ProductForm from "@/components/ProductForm";
import { Category, Product } from "@/types/database";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: {
    id: string;
  };
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const supabase = createSupabaseAdmin();

  const [{ data: product, error }, { data: categoriesData }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          `
          *,
          categories (id, name, slug),
          product_images (id, product_id, image_url, is_primary, order_index)
        `
        )
        .eq("id", params.id)
        .single(),
      supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true }),
    ]);

  if (error || !product) {
    notFound();
  }

  const categories = (categoriesData as Category[]) || [];

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
                Edit Produk: {product.name}
              </h1>
              <p className="text-xs text-slate-500">
                Perbarui informasi produk, spesifikasi, atau galeri foto
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProductForm
          initialData={product as Product}
          categories={categories}
        />
      </main>
    </div>
  );
}

