import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CheckCircle2,
  Layers,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import ProductGallery from "@/components/ProductGallery";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Product, ProductAttribute } from "@/types/database";
import { formatIDR } from "@/lib/utils";

export const revalidate = 60;

interface ProductDetailPageProps {
  params: {
    slug: string;
  };
}

async function getPublishedProductBySlug(
  slug: string
): Promise<Product | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }

  const { data, error } = await supabasePublic
    .from("products")
    .select(
      `
      *,
      categories (id, name, slug),
      product_images (id, product_id, image_url, is_primary, order_index)
    `
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data) {
    return null;
  }

  return data as Product;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const product = await getPublishedProductBySlug(params.slug);
  if (!product) {
    return {
      title: "Produk Tidak Ditemukan",
    };
  }

  return {
    title: product.name,
    description:
      product.description?.slice(0, 160) ||
      `Lihat spesifikasi lengkap dan harga ${product.name}.`,
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const product = await getPublishedProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "FP Catalog";
  const attributes: ProductAttribute[] = Array.isArray(product.attributes)
    ? product.attributes
    : [];

  // Format deskripsi menjadi paragraf yang rapi
  const descriptionParagraphs = (product.description || "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      {/* Header Navigasi */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Katalog
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              {storeName}
            </span>
          </Link>
        </div>
      </header>

      {/* Konten Detail Produk */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Kolom Kiri (Galeri Interaktif Multi-Foto) */}
          <div className="lg:col-span-6">
            <ProductGallery
              images={product.product_images || []}
              productName={product.name}
            />
          </div>

          {/* Kolom Kanan (Info Produk, Spesifikasi JSONB, Deskripsi, CTA WhatsApp) */}
          <div className="flex flex-col space-y-6 lg:col-span-6">
            {/* Badges: Kategori & Ketersediaan */}
            <div className="flex flex-wrap items-center gap-2">
              {product.categories?.name && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-xs font-semibold text-white">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  {product.categories.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Tersedia
              </span>
            </div>

            {/* Nama & Harga */}
            <div className="border-b border-slate-200 pb-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {product.name}
              </h1>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">
                {formatIDR(Number(product.price))}
              </p>
            </div>

            {/* Tombol CTA WhatsApp (Inline & Floating/Sticky) */}
            <WhatsAppButton
              productName={product.name}
              productSlug={product.slug}
            />

            {/* Dynamic Specs Table (dari JSONB attributes) */}
            {attributes.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
                  <Layers className="h-4 w-4 text-slate-600" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Spesifikasi Produk
                  </h2>
                </div>
                <dl className="divide-y divide-slate-100 text-sm">
                  {attributes.map((attr, idx) => (
                    <div
                      key={`${attr.key}-${idx}`}
                      className="grid grid-cols-3 gap-4 px-5 py-3 hover:bg-slate-50/50"
                    >
                      <dt className="font-medium text-slate-500">{attr.key}</dt>
                      <dd className="col-span-2 font-semibold text-slate-900">
                        {attr.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Deskripsi Produk Lengkap */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Deskripsi Produk
              </h2>
              {descriptionParagraphs.length > 0 ? (
                <div className="space-y-3 text-sm leading-relaxed text-slate-700">
                  {descriptionParagraphs.map((paragraph, idx) => (
                    <p key={idx} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-slate-400">
                  Tidak ada deskripsi tambahan untuk produk ini.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

