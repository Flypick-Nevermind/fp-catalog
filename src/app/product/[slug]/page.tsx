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
  ShieldCheck,
  MessageCircle,
  PackageCheck,
  ChevronRight,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import ProductGallery from "@/components/ProductGallery";
import ProductDetailActions from "@/components/ProductDetailActions";
import ShareProductButton from "@/components/ShareProductButton";
import BackToCatalogButton from "@/components/BackToCatalogButton";
import { Product, ProductAttribute } from "@/types/database";
import { getPublicAttributes } from "@/lib/jastip-calc";
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

const STOP_WORDS = new Set([
  "dan",
  "yang",
  "untuk",
  "dengan",
  "dari",
  "the",
  "and",
  "for",
  "with",
  "new",
  "ori",
  "original",
  "jastip",
  "promo",
  "murah",
]);

function extractProductKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Mengambil maksimal 4 produk berelasi secara cerdas:
 * - Prioritas kategori yang sama + kemiripan kata kunci nama produk + kedekatan harga
 * - Ditambah variasi acak di antara kandidat relevan agar tidak selalu menampilkan 4 produk yang sama
 * - Jika kurang dari 4, dilengkapi secara acak dari produk terpublikasi lainnya
 */
async function getRelatedProducts(currentProduct: Product): Promise<Product[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return [];
  }

  const candidates: Product[] = [];
  const seenIds = new Set<string>([currentProduct.id]);

  // 1. Ambil kandidat lebih banyak dari kategori yang sama (hingga 40 produk)
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
      .limit(40);

    if (sameCategoryData) {
      for (const item of sameCategoryData as Product[]) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          candidates.push(item);
        }
      }
    }
  }

  // 2. Jika kandidat dari kategori sama masih kurang dari 8, ambil tambahan produk lain untuk diacak
  if (candidates.length < 8) {
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
      .neq("id", currentProduct.id)
      .limit(30);

    if (otherProducts) {
      for (const item of otherProducts as Product[]) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          candidates.push(item);
        }
      }
    }
  }

  if (candidates.length === 0) return [];

  const currentKeywords = extractProductKeywords(currentProduct.name);
  const currentPrice = Number(currentProduct.price) || 0;

  // 3. Hitung skor relevansi + variasi acak agar produk tetap berelasi namun bervariasi
  const scored = candidates.map((item) => {
    let score = 0;

    // Prioritas kategori sama
    if (
      currentProduct.category_id &&
      item.category_id === currentProduct.category_id
    ) {
      score += 100;
    }

    // Kemiripan kata kunci pada nama produk (misal merek / jenis yang sama)
    if (currentKeywords.length > 0) {
      const itemNameLower = item.name.toLowerCase();
      let matchedCount = 0;
      for (const kw of currentKeywords) {
        if (itemNameLower.includes(kw)) {
          matchedCount += 1;
        }
      }
      score += matchedCount * 35;
    }

    // Kedekatan rentang harga (maks +15)
    const itemPrice = Number(item.price) || 0;
    if (currentPrice > 0 && itemPrice > 0) {
      const ratio = Math.abs(itemPrice - currentPrice) / currentPrice;
      if (ratio <= 0.3) score += 15;
      else if (ratio <= 0.6) score += 8;
    }

    // Faktor acak agar pilihan dari kandidat yang setara selalu segar
    score += Math.random() * 25;

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((entry) => entry.item);
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
  const attributes: ProductAttribute[] = getPublicAttributes(
    product.attributes
  );

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
          <BackToCatalogButton />

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
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 sm:py-8 lg:px-8">
        {/* Breadcrumb Navigasi */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
        >
          <Link href="/" className="transition hover:text-slate-900">
            Beranda
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          {product.categories?.name && (
            <>
              <span className="text-slate-600">{product.categories.name}</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </>
          )}
          <span className="line-clamp-1 font-semibold text-slate-900">
            {product.name}
          </span>
        </nav>

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

            {/* Nama & Kartu Harga */}
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {product.name}
              </h1>

              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-slate-100/70 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Harga Katalog
                </p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                  {formatIDR(Number(product.price))}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  Konfirmasi ketersediaan stok &amp; detail pengiriman langsung dengan admin via WhatsApp.
                </p>
              </div>
            </div>

            {/* Tombol Aksi: Pesan Langsung & Titip Multi-Produk */}
            <ProductDetailActions
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                price: Number(product.price),
                coverUrl: getPrimaryImageUrl(product),
                categoryName: product.categories?.name,
              }}
            />

            {/* Jaminan Layanan (3 Badges) */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-white p-3 text-center">
                <ShieldCheck className="mb-1.5 h-4 w-4 text-emerald-600" />
                <span className="text-[11px] font-semibold text-slate-700">
                  Terpercaya
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-white p-3 text-center">
                <MessageCircle className="mb-1.5 h-4 w-4 text-sky-600" />
                <span className="text-[11px] font-semibold text-slate-700">
                  Respon Cepat
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-white p-3 text-center">
                <PackageCheck className="mb-1.5 h-4 w-4 text-amber-600" />
                <span className="text-[11px] font-semibold text-slate-700">
                  Packing Aman
                </span>
              </div>
            </div>

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
                    </Link>

                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        {/* Tag Kategori (di bawah gambar agar tidak menutupi logo pada foto produk) */}
                        <div className="mb-1.5">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200/80">
                            {relCategory}
                          </span>
                        </div>

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
