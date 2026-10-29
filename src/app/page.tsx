import React from "react";
import { supabasePublic } from "@/lib/supabase";
import CatalogClient from "@/components/CatalogClient";
import { Category, Product } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let categories: Category[] = [];
  let products: Product[] = [];

  if (isSupabaseConfigured) {
    const [{ data: categoriesData }, { data: productsData }] =
      await Promise.all([
        supabasePublic
          .from("categories")
          .select("*")
          .order("name", { ascending: true }),
        supabasePublic
          .from("products")
          .select(
            `
            *,
            categories (id, name, slug),
            product_images (id, product_id, image_url, is_primary, order_index)
          `
          )
          .eq("status", "published")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ]);

    categories = (categoriesData as Category[]) || [];
    products = (productsData as Product[]) || [];
  }

  return <CatalogClient products={products} categories={categories} />;
}

