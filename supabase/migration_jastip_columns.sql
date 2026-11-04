-- ============================================================================
-- MIGRASI KOLOM KALKULATOR JASTIP PADA TABEL public.products
-- Jalankan query ini di Supabase SQL Editor atau DBeaver
-- ============================================================================

-- 1. Tambahkan kolom khusus untuk berat riil, berat tagihan (default 1000g / 1kg),
--    harga Yuan, pengali kurs (default 2800), dan tarif per KG (default 220000)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS actual_weight_grams INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight_grams INT NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS yuan_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yuan_multiplier NUMERIC(12, 2) NOT NULL DEFAULT 2800,
  ADD COLUMN IF NOT EXISTS rate_per_kg NUMERIC(12, 2) NOT NULL DEFAULT 220000;

-- 2. Backfill otomatis `actual_weight_grams` dari atribut spesifikasi "Weight" (misal "300 gram" -> 300)
UPDATE public.products p
SET actual_weight_grams = COALESCE(
  (
    SELECT NULLIF(regexp_replace(elem->>'value', '[^0-9]', '', 'g'), '')::INT
    FROM jsonb_array_elements(p.attributes) AS elem
    WHERE lower(elem->>'key') LIKE '%weight%' OR lower(elem->>'key') LIKE '%berat%'
    LIMIT 1
  ),
  0
)
WHERE actual_weight_grams = 0;

-- 3. Backfill otomatis `yuan_price` untuk produk yang sudah ada di database
--    (Deteksi dari selisih harga terhadap ongkir dan kurs 2800, serta set default weight_grams = 1000)
UPDATE public.products
SET
  weight_grams = 1000,
  yuan_multiplier = 2800,
  rate_per_kg = 220000,
  yuan_price = CASE
    -- Jika (price - ongkir 1kg 220.000) habis dibagi 2800:
    WHEN price > 220000 AND mod((price - 220000):: BIGINT, 2800) = 0
      THEN ((price - 220000) / 2800)::NUMERIC(12, 2)
    -- Jika produk sebelumnya dihitung dengan berat 400g (ongkir 88.000):
    WHEN price > 88000 AND mod((price - 88000)::BIGINT, 2800) = 0
      THEN ((price - 88000) / 2800)::NUMERIC(12, 2)
    -- Jika produk sebelumnya dihitung dengan berat 300g (ongkir 66.000):
    WHEN price > 66000 AND mod((price - 66000)::BIGINT, 2800) = 0
      THEN ((price - 66000) / 2800)::NUMERIC(12, 2)
    -- Jika produk sebelumnya dihitung dengan berat 200g (ongkir 44.000):
    WHEN price > 44000 AND mod((price - 44000)::BIGINT, 2800) = 0
      THEN ((price - 44000) / 2800)::NUMERIC(12, 2)
    -- Jika produk sebelumnya dihitung dengan berat 500g (ongkir 110.000):
    WHEN price > 110000 AND mod((price - 110000)::BIGINT, 2800) = 0
      THEN ((price - 110000) / 2800)::NUMERIC(12, 2)
    ELSE yuan_price
  END
WHERE yuan_price = 0 AND price > 0;

-- 4. Bersihkan key internal `__jastip_calc` dari JSONB attributes jika ada
UPDATE public.products
SET attributes = COALESCE(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(attributes) AS elem
    WHERE (elem->>'key') IS DISTINCT FROM '__jastip_calc'
  ),
  '[]'::jsonb
)
WHERE attributes::text LIKE '%__jastip_calc%';

