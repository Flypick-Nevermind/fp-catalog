-- ============================================================================
-- SUPABASE SQL SCHEMA & STORAGE POLICIES FOR FP-CATALOG
-- Jalankan skrip ini di Supabase SQL Editor
-- ============================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABEL: categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. TABEL: products
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  price NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- ----------------------------------------------------------------------------
-- 3. TABEL: product_images
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Policy Categories: Publik (anon & authenticated) hanya bisa SELECT
DROP POLICY IF EXISTS "Public can read categories" ON public.categories;
CREATE POLICY "Public can read categories"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy Products: Publik hanya bisa SELECT produk dengan status = 'published'
DROP POLICY IF EXISTS "Public can read published products" ON public.products;
CREATE POLICY "Public can read published products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Policy Product Images: Publik hanya bisa SELECT gambar dari produk yang 'published'
DROP POLICY IF EXISTS "Public can read images of published products" ON public.product_images;
CREATE POLICY "Public can read images of published products"
  ON public.product_images
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
      AND p.status = 'published'
    )
  );

-- Catatan: Service Role di Supabase secara otomatis mem-bypass RLS (akses penuh CRUD),
-- namun kita juga dapat menambahkan policy eksplisit untuk service_role:
DROP POLICY IF EXISTS "Service role full access categories" ON public.categories;
CREATE POLICY "Service role full access categories"
  ON public.categories FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access products" ON public.products;
CREATE POLICY "Service role full access products"
  ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access product_images" ON public.product_images;
CREATE POLICY "Service role full access product_images"
  ON public.product_images FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. SUPABASE STORAGE BUCKET: product-media
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  5242880, -- 5MB limit
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policy: Publik dapat melihat/membaca file di bucket product-media
DROP POLICY IF EXISTS "Public read access for product-media" ON storage.objects;
CREATE POLICY "Public read access for product-media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-media');

-- Storage Policy: Izinkan upload/hapus via Service Role atau client upload ke product-media
DROP POLICY IF EXISTS "Allow upload to product-media" ON storage.objects;
CREATE POLICY "Allow upload to product-media"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Allow delete from product-media" ON storage.objects;
CREATE POLICY "Allow delete from product-media"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated, service_role
  USING (bucket_id = 'product-media');

-- ----------------------------------------------------------------------------
-- 6. SEED DATA CONTOH KATEGORI (Opsional)
-- ----------------------------------------------------------------------------
INSERT INTO public.categories (name, slug)
VALUES
  ('Pakaian Pria', 'pakaian-pria'),
  ('Pakaian Wanita', 'pakaian-wanita'),
  ('Aksesoris', 'aksesoris'),
  ('Koleksi Eksklusif', 'koleksi-eksklusif')
ON CONFLICT (slug) DO NOTHING;

