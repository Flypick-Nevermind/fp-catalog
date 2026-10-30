"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminSession } from "@/app/actions/auth";
import { slugify } from "@/lib/utils";
import { Category, Product } from "@/types/database";

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nama produk minimal 2 karakter"),
  slug: z.string().min(2, "Slug produk wajib diisi"),
  description: z.string().optional().default(""),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  category_id: z.string().nullable().optional(),
  status: z.enum(["published", "draft"]),
  attributes: z
    .array(
      z.object({
        key: z.string().trim().min(1, "Nama spesifikasi wajib diisi"),
        value: z.string().trim().min(1, "Nilai spesifikasi wajib diisi"),
      })
    )
    .default([]),
  images: z
    .array(
      z.object({
        image_url: z.string().url("URL gambar tidak valid"),
        is_primary: z.boolean(),
        order_index: z.number().int().min(0),
      })
    )
    .min(1, "Minimal unggah 1 foto produk"),
});

export type SaveProductPayload = z.infer<typeof productSchema>;

export interface ActionResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Mengambil data produk & daftar kategori paling mutakhir langsung dari database
 * untuk sinkronisasi antar multi-user (menghindari Router Cache di browser).
 */
export async function getLatestProductAndCategoriesAction(
  productId?: string
): Promise<
  ActionResponse<{
    product: Product | null;
    categories: Category[];
  }>
> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak." };
    }

    const supabase = createSupabaseAdmin();

    const categoriesPromise = supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    const productPromise = productId
      ? supabase
          .from("products")
          .select(
            `
            *,
            categories (id, name, slug),
            product_images (id, product_id, image_url, is_primary, order_index)
          `
          )
          .eq("id", productId)
          .single()
      : Promise.resolve({ data: null, error: null });

    const [{ data: categoriesData }, { data: productData }] =
      await Promise.all([categoriesPromise, productPromise]);

    return {
      success: true,
      data: {
        product: (productData as Product) || null,
        categories: (categoriesData as Category[]) || [],
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat data terbaru.",
    };
  }
}

/**
 * Menyimpan produk baru atau memperbarui produk beserta relasi `product_images` secara atomik/transaksional.
 */
export async function saveProductAction(
  payload: SaveProductPayload
): Promise<ActionResponse<{ id: string; slug: string }>> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak: Sesi admin tidak valid." };
    }

    const parsed = productSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        success: false,
        error: firstIssue?.message || "Data form produk tidak valid.",
      };
    }

    const data = parsed.data;
    const normalizedSlug = slugify(data.slug || data.name);
    const supabase = createSupabaseAdmin();

    // Pastikan tepat satu gambar ditandai is_primary
    const hasPrimary = data.images.some((img) => img.is_primary);
    const normalizedImages = data.images.map((img, idx) => ({
      image_url: img.image_url,
      is_primary: hasPrimary ? img.is_primary : idx === 0,
      order_index: idx,
    }));

    let productId = data.id;

    if (productId) {
      // UPDATE EXISTING PRODUCT
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: data.name,
          slug: normalizedSlug,
          description: data.description,
          price: data.price,
          category_id: data.category_id || null,
          attributes: data.attributes,
          status: data.status,
        })
        .eq("id", productId);

      if (updateError) {
        if (updateError.code === "23505") {
          return {
            success: false,
            error: "Slug produk sudah digunakan oleh produk lain.",
          };
        }
        throw new Error(updateError.message);
      }

      // Ganti relasi product_images secara bersih
      const { error: deleteImagesError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", productId);

      if (deleteImagesError) {
        throw new Error(`Gagal memperbarui galeri: ${deleteImagesError.message}`);
      }

      const imagesToInsert = normalizedImages.map((img) => ({
        product_id: productId!,
        image_url: img.image_url,
        is_primary: img.is_primary,
        order_index: img.order_index,
      }));

      const { error: insertImagesError } = await supabase
        .from("product_images")
        .insert(imagesToInsert);

      if (insertImagesError) {
        throw new Error(`Gagal menyimpan foto produk: ${insertImagesError.message}`);
      }
    } else {
      // INSERT NEW PRODUCT
      const { data: insertedProduct, error: insertError } = await supabase
        .from("products")
        .insert({
          name: data.name,
          slug: normalizedSlug,
          description: data.description,
          price: data.price,
          category_id: data.category_id || null,
          attributes: data.attributes,
          status: data.status,
        })
        .select("id, slug")
        .single();

      if (insertError || !insertedProduct) {
        if (insertError?.code === "23505") {
          return {
            success: false,
            error: "Slug produk sudah digunakan. Gunakan nama atau slug yang berbeda.",
          };
        }
        throw new Error(insertError?.message || "Gagal membuat produk baru.");
      }

      productId = insertedProduct.id;

      const imagesToInsert = normalizedImages.map((img) => ({
        product_id: productId!,
        image_url: img.image_url,
        is_primary: img.is_primary,
        order_index: img.order_index,
      }));

      const { error: insertImagesError } = await supabase
        .from("product_images")
        .insert(imagesToInsert);

      // Rollback manual jika insert gambar gagal agar tetap atomic
      if (insertImagesError) {
        await supabase.from("products").delete().eq("id", productId);
        throw new Error(
          `Gagal menyimpan foto produk (transaksi dibatalkan): ${insertImagesError.message}`
        );
      }
    }

    // Revalidate seluruh rute publik & admin agar user lain langsung mendapat data terbaru
    revalidatePath("/", "layout");
    revalidatePath(`/product/${normalizedSlug}`);
    revalidatePath("/admin", "layout");
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin/products/new");

    return {
      success: true,
      data: { id: productId!, slug: normalizedSlug },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return { success: false, error: message };
  }
}

/**
 * Menghapus produk beserta file gambarnya di Supabase Storage (`product-media`).
 */
export async function deleteProductAction(
  productId: string
): Promise<ActionResponse> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak: Sesi admin tidak valid." };
    }

    const supabase = createSupabaseAdmin();

    // Ambil daftar URL gambar sebelum produk dihapus untuk membersihkan storage
    const { data: images } = await supabase
      .from("product_images")
      .select("image_url")
      .eq("product_id", productId);

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Hapus objek dari bucket product-media hanya jika tidak dipakai oleh produk hasil duplikat lain
    if (images && images.length > 0) {
      const urlsToCheck = images.map((i) => i.image_url);
      const { data: stillUsed } = await supabase
        .from("product_images")
        .select("image_url")
        .in("image_url", urlsToCheck);

      const usedSet = new Set((stillUsed || []).map((u) => u.image_url));

      const storagePaths = images
        .filter((img) => !usedSet.has(img.image_url))
        .map((img) => {
          const marker = "/storage/v1/object/public/product-media/";
          const idx = img.image_url.indexOf(marker);
          return idx !== -1
            ? decodeURIComponent(img.image_url.slice(idx + marker.length))
            : null;
        })
        .filter((p): p is string => Boolean(p));

      if (storagePaths.length > 0) {
        await supabase.storage.from("product-media").remove(storagePaths);
      }
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus produk.";
    return { success: false, error: message };
  }
}

/**
 * Mengubah status produk (Published <-> Draft) secara instan dengan 1 klik dari tabel Admin.
 */
export async function toggleProductStatusAction(
  productId: string,
  newStatus: "published" | "draft"
): Promise<ActionResponse> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak: Sesi admin tidak valid." };
    }

    const supabase = createSupabaseAdmin();

    const { data: updated, error } = await supabase
      .from("products")
      .update({ status: newStatus })
      .eq("id", productId)
      .select("slug")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/", "layout");
    if (updated?.slug) {
      revalidatePath(`/product/${updated.slug}`);
    }
    revalidatePath("/admin", "layout");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Gagal mengubah status produk.",
    };
  }
}

/**
 * Menduplikasi produk beserta spesifikasi dan referensi fotonya (status awal: Draft).
 */
export async function duplicateProductAction(
  productId: string
): Promise<ActionResponse<{ id: string; name: string }>> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak: Sesi admin tidak valid." };
    }

    const supabase = createSupabaseAdmin();

    // 1. Ambil produk sumber beserta fotonya
    const { data: sourceProduct, error: fetchErr } = await supabase
      .from("products")
      .select(
        `
        *,
        product_images (image_url, is_primary, order_index)
      `
      )
      .eq("id", productId)
      .single();

    if (fetchErr || !sourceProduct) {
      return {
        success: false,
        error: "Produk yang ingin diduplikasi tidak ditemukan.",
      };
    }

    const shortCode = Math.random().toString(36).substring(2, 6);
    const clonedName = `${sourceProduct.name} (Copy)`;
    const clonedSlug = `${slugify(sourceProduct.slug)}-copy-${shortCode}`;

    // 2. Insert produk baru dengan status 'draft' agar admin dapat mengecek dulu
    const { data: newProduct, error: insertErr } = await supabase
      .from("products")
      .insert({
        name: clonedName,
        slug: clonedSlug,
        description: sourceProduct.description || "",
        price: sourceProduct.price,
        category_id: sourceProduct.category_id,
        attributes: sourceProduct.attributes || [],
        status: "draft",
      })
      .select("id, name")
      .single();

    if (insertErr || !newProduct) {
      throw new Error(insertErr?.message || "Gagal menduplikasi produk.");
    }

    // 3. Salin daftar foto produk jika ada
    const sourceImages = sourceProduct.product_images as
      | { image_url: string; is_primary: boolean; order_index: number }[]
      | undefined;

    if (sourceImages && sourceImages.length > 0) {
      const imagesToInsert = sourceImages.map((img) => ({
        product_id: newProduct.id,
        image_url: img.image_url,
        is_primary: img.is_primary,
        order_index: img.order_index,
      }));

      await supabase.from("product_images").insert(imagesToInsert);
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");

    return {
      success: true,
      data: { id: newProduct.id, name: newProduct.name },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menduplikasi produk.",
    };
  }
}

/**
 * Membuat kategori baru secara cepat dari dalam form produk atau panel Kategori Admin.
 */
export async function createCategoryAction(
  name: string
): Promise<ActionResponse<{ id: string; name: string; slug: string }>> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak." };
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return { success: false, error: "Nama kategori minimal 2 karakter." };
    }

    const slug = slugify(trimmedName);
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("categories")
      .insert({ name: trimmedName, slug })
      .select("id, name, slug")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        return { success: false, error: "Kategori tersebut sudah ada." };
      }
      throw new Error(error?.message || "Gagal menambahkan kategori.");
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/products/new");

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat kategori.",
    };
  }
}

/**
 * Mengubah nama dan slug kategori yang sudah ada.
 */
export async function updateCategoryAction(
  categoryId: string,
  newName: string
): Promise<ActionResponse<{ id: string; name: string; slug: string }>> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak." };
    }

    const trimmedName = newName.trim();
    if (trimmedName.length < 2) {
      return { success: false, error: "Nama kategori minimal 2 karakter." };
    }

    const newSlug = slugify(trimmedName);
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("categories")
      .update({ name: trimmedName, slug: newSlug })
      .eq("id", categoryId)
      .select("id, name, slug")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        return {
          success: false,
          error: "Nama/slug kategori tersebut sudah digunakan.",
        };
      }
      throw new Error(error?.message || "Gagal memperbarui kategori.");
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/products/new");

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Gagal memperbarui kategori.",
    };
  }
}

/**
 * Menghapus kategori (produk di dalamnya akan otomatis menjadi 'Tanpa Kategori').
 */
export async function deleteCategoryAction(
  categoryId: string
): Promise<ActionResponse> {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return { success: false, error: "Akses ditolak." };
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/products/new");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus kategori.",
    };
  }
}
