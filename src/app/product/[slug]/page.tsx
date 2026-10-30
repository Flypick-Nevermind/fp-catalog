import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import ProductGallery from "@/components/ProductGallery";
import WhatsAppButton from "@/components/WhatsAppButton";
import ShareProductButton from "@/components/ShareProductButton";
import { Product, ProductAttribute } from "@/types/database";
import { formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProductDetailPageProps {
  params: {
    slug: string;
  };
}

function getPrimaryImageUrl(product: Product): string | null {
  const imgs = product.product_images;
  if (!imgs || imgs.length === 0) return null;
  const primary = imgs.find((i) => i.is_primary);
  if (primary) return primary.image_url;
  const sorted = [...imgs].sort((a, b) => a.order_index - b.order_index);
  return sorted[0]?.image_url || null;
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

/**
 * Mengambil maksimal 4 produk serupa (prioritas dari kategori yang sama,
 * lalu dilengkapi produk lain jika jumlahnya kurang dari 4).
 */
async function getRelatedProducts(currentProduct: Product): Promise<Product[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return [];
  }

  const results: Product[] = [];

  if (currentProduct.category_id) {
    const { data: sameCategoryData } = await supabasePublic
      .from("products")
      .select(
        `
        *,
        categories (id, name, slug),
        product_images (id, product_id, image_url, is_primary, order_index)
      `
      )
      .eq("status", "published")
      .eq("category_id", currentProduct.category_id)
      .neq("id", currentProduct.id)
      .order("created_at", { ascending: true })
      .limit(4);

    if (sameCategoryData) {
      results.push(...(sameCategoryData as Product[]));
    }
  }

  if (results.length < 4) {
    const excludeIds = [currentProduct.id, ...results.map((r) => r.id)];
    const { data: otherProducts } = await supabasePublic
      .from("products")
      .select(
        `
        *,
        categories (id, name, slug),
        product_images (id, product_id, image_url, is_primary, order_index)
      `
      )
      .eq("status", "published")
      .not("id", "in", `(${excludeIds.join(",")})`)
      .order("created_at", { ascending: true })
      .limit(4 - results.length);

    if (otherProducts) {
      results.push(...(otherProducts as Product[]));
    }
  }

  return results;
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

  const priceFormatted = formatIDR(Number(product.price));
  const titleWithPrice = `${product.name} — ${priceFormatted}`;
  const description =
    product.description?.slice(0, 160) ||
    `Pesan ${product.name} (${priceFormatted}) langsung melalui WhatsApp di katalog resmi kami.`;
  const coverImage = getPrimaryImageUrl(product);

  return {
    title: titleWithPrice,
    description,
    openGraph: {
      title: titleWithPrice,
      description,
      type: "website",
      images: coverImage
        ? [
            {
              url: coverImage,
              width: 1200,
              height: 1200,
              alt: product.name,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: titleWithPrice,
      description,
      images: coverImage ? [coverImage] : [],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  noStore();
  const product = await getPublishedProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product);

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

          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg shadow-2xs ring-1 ring-slate-200/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/flypick-logo.png"
                alt={storeName}
                className="h-full w-full object-cover"
              />
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
            {/* Badges: Kategori, Ketersediaan & Tombol Share */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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

              <ShareProductButton
                productName={product.name}
                productSlug={product.slug}
                productPrice={Number(product.price)}
              />
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

        {/* Bagian #5: Produk Serupa / Koleksi Lainnya */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 border-t border-slate-200 pt-12">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Produk Lainnya yang Mungkin Anda Suka
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Eksplorasi pilihan produk lainnya dari katalog kami
                </p>
              </div>
              <Link
                href="/"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4"
              >
                Lihat Semua
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((rel) => {
                const relCover = getPrimaryImageUrl(rel);
                const relCategory = rel.categories?.name || "Koleksi Umum";

                return (
                  <article
                    key={rel.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <Link
                      href={`/product/${rel.slug}`}
                      className="relative aspect-square w-full overflow-hidden bg-slate-100"
                    >
                      {relCover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={relCover}
                          alt={rel.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          Tanpa Foto
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-sm">
                        {relCategory}
                      </span>
                    </Link>

                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <Link href={`/product/${rel.slug}`}>
                          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-slate-700">
                            {rel.name}
                          </h3>
                        </Link>
                        <p className="mt-1.5 text-base font-bold text-slate-900">
                          {formatIDR(Number(rel.price))}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <Link
                          href={`/product/${rel.slug}`}
                          className="flex w-full items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          <span>Lihat Detail</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
