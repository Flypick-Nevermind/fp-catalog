import Link from "next/link";
import { PackageSearch, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
        <PackageSearch className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        Halaman atau Produk Tidak Ditemukan
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Produk yang Anda cari mungkin sudah tidak tersedia, berstatus draft,
        atau tautan URL telah berubah.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Katalog Utama
      </Link>
    </div>
  );
}

