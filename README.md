# FP Catalog — Modern Web Product Catalog

Aplikasi Web Katalog Produk modern, responsif, dan ringan yang dibangun dengan **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, dan **Supabase**.

Dirancang sebagai katalog publik *view-only* (tanpa keranjang belanja atau payment gateway) dengan integrasi pemesanan langsung melalui **WhatsApp CTA dinamis**, serta dilengkapi **Admin Panel** internal yang diamankan menggunakan **Single Secret Password Authentication** (HTTP-Only Cookie).

---

## Fitur Utama

### 1. Katalog Pengunjung (Publik)
- **Tanpa Login/Registrasi:** Pengunjung dapat langsung menjelajahi seluruh produk berstatus `published`.
- **Pencarian Instan & Filter Kategori Dinamis:** Cari produk berdasarkan nama, deskripsi, atau filter berdasarkan chip kategori secara real-time.
- **Responsive Product Grid:** Tampilan kartu produk responsif (1 kolom di mobile, 2 di tablet, 3–4 kolom di desktop) lengkap dengan badge kategori dan format mata uang Rupiah (`Intl.NumberFormat`).
- **Interactive Multi-Photo Gallery:** Pratinjau foto utama dengan navigasi panah dan carousel baris thumbnail interaktif pada halaman detail produk (`/product/[slug]`).
- **Tabel Spesifikasi Dinamis:** Menampilkan atribut spesifikasi produk berbasis `JSONB` (seperti Bahan, Ukuran, Warna, dll.).
- **Tombol WhatsApp Dinamis (Inline & Floating/Sticky):** Menghasilkan tautan pemesanan WhatsApp otomatis dengan pesan URL-encoded:
  > `"Halo, saya tertarik dengan produk [Nama Produk] (Link: [URL Halaman])"`

### 2. Admin Panel (`/admin`)
- **Single Password Authentication:** Proteksi rute `/admin/*` melalui Next.js Middleware (`src/middleware.ts`) dan sesi cookie `httpOnly` yang di-hash dengan SHA-256.
- **Dashboard Ringkasan:** Statistik total produk, produk aktif (`published`), dan produk `draft`, beserta tabel manajemen produk dan modal konfirmasi hapus.
- **Form Produk Lengkap (`React Hook Form` + `Zod`):**
  - Auto-slug generator dari nama produk.
  - Pembuatan kategori baru secara cepat langsung dari dalam form.
  - **Dynamic Specification Builder:** Tambah/hapus baris pasangan `Key` – `Value` untuk spesifikasi produk.
  - **Client-Side Image Compression & Multi-Upload:** Kompresi gambar otomatis di browser menggunakan `browser-image-compression` (konversi ke **WebP**, dimensi maks. `1200px`, ukuran `< 200KB`) sebelum diunggah ke Supabase Storage bucket `product-media`.
  - Pengaturan foto **Cover Utama (`is_primary`)** dan penghapusan file gambar langsung dari storage.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling & Icons:** Tailwind CSS, Lucide React
- **Database & Storage:** Supabase (PostgreSQL + Row Level Security + Supabase Storage)
- **Form & Validation:** React Hook Form, Zod, `@hookform/resolvers`
- **Image Optimization:** `browser-image-compression`

---

## Struktur Direktori

```text
fp-catalog/
├── .env.local.example                  # Contoh konfigurasi environment variables
├── supabase/
│   └── schema.sql                      # Skrip SQL tabel, indeks, RLS, dan Storage Bucket
└── src/
    ├── middleware.ts                   # Middleware proteksi halaman /admin/*
    ├── types/
    │   └── database.ts                 # Tipe data TypeScript (Product, Category, dll.)
    ├── lib/
    │   ├── supabase.ts                 # Inisialisasi client Supabase (Public & Server Admin)
    │   └── utils.ts                    # Fungsi utilitas (formatIDR, slugify, cn)
    ├── components/
    │   ├── AdminProductTable.tsx       # Tabel daftar produk admin & modal hapus
    │   ├── CatalogClient.tsx           # Katalog interaktif halaman utama
    │   ├── MultiImageUploader.tsx      # Kompresi WebP & multi-upload ke Supabase Storage
    │   ├── ProductForm.tsx             # Form tambah/edit produk + spesifikasi dinamis
    │   ├── ProductGallery.tsx          # Galeri multi-foto interaktif
    │   └── WhatsAppButton.tsx          # Tombol CTA WhatsApp dinamis
    └── app/
        ├── actions/
        │   ├── auth.ts                 # Server Actions autentikasi admin
        │   └── product.ts              # Server Actions CRUD produk & kategori
        ├── admin/
        │   ├── login/page.tsx          # Halaman login admin (/admin/login)
        │   ├── page.tsx                # Dashboard utama admin (/admin)
        │   └── products/
        │       ├── new/page.tsx        # Halaman tambah produk (/admin/products/new)
        │       └── [id]/page.tsx       # Halaman edit produk (/admin/products/[id])
        ├── product/
        │   └── [slug]/page.tsx         # Halaman detail produk (/product/[slug])
        └── page.tsx                    # Halaman utama katalog publik (/)
```

---

## Panduan Instalasi & Menjalankan Proyek

### 1. Clone Repositori & Instal Dependencies

```bash
git clone https://github.com/Flypick-Nevermind/fp-catalog.git
cd fp-catalog
npm install
```

### 2. Setup Database & Storage di Supabase

1. Buat proyek baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka menu **SQL Editor**, lalu salin dan jalankan seluruh isi file [`supabase/schema.sql`](./supabase/schema.sql).
   - Skrip ini otomatis membuat tabel `categories`, `products`, `product_images`, mengaktifkan **Row Level Security (RLS)**, membuat bucket publik `product-media`, serta mengisi data kategori awal.

### 3. Konfigurasi Environment Variables

Salin file `.env.local.example` menjadi `.env.local`:

```bash
cp .env.local.example .env.local
```

Isi variabel di dalam `.env.local` sesuai konfigurasi proyek Anda:

```env
# SUPABASE CONFIGURATION
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"

# ADMIN AUTHENTICATION
ADMIN_SECRET_PASSWORD="password-rahasia-admin-anda"
ADMIN_SESSION_SECRET="string-acak-32-karakter-untuk-signing-session"

# STORE & WHATSAPP CONFIGURATION
NEXT_PUBLIC_STORE_NAME="FP Catalog"
NEXT_PUBLIC_WHATSAPP_NUMBER="6281234567890"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

### 4. Jalankan Server Development

```bash
npm run dev
```

- **Halaman Katalog Publik:** [http://localhost:3000](http://localhost:3000)
- **Halaman Admin Panel:** [http://localhost:3000/admin](http://localhost:3000/admin) (login menggunakan `ADMIN_SECRET_PASSWORD` yang disetel pada `.env.local`)

---

## Deployment (Vercel)

1. Hubungkan repositori GitHub ini ke [Vercel](https://vercel.com).
2. Tambahkan seluruh variabel environment dari `.env.local` ke menu **Settings > Environment Variables** di Vercel.
3. Ubah nilai `NEXT_PUBLIC_SITE_URL` menjadi domain produksi Anda (misal `https://katalog-anda.vercel.app`).
4. Klik **Deploy**.
