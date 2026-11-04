"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  ChevronDown,
  CheckSquare,
  Filter,
  FileSpreadsheet as FileTemplateIcon,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import { downloadProductsExcel } from "@/lib/excel";

interface AdminExcelExportMenuProps {
  allProducts: Product[];
  filteredProducts: Product[];
  selectedIds: string[];
  categories: Category[];
  isFiltered: boolean;
}

export default function AdminExcelExportMenu({
  allProducts,
  filteredProducts,
  selectedIds,
  categories,
  isFiltered,
}: AdminExcelExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedProducts = allProducts.filter((p) =>
    selectedIds.includes(p.id)
  );

  const handleDownloadAll = () => {
    downloadProductsExcel(allProducts, categories, {
      filenamePrefix: "Semua-Produk-Flypick-Catalog",
    });
    setIsOpen(false);
  };

  const handleDownloadFiltered = () => {
    downloadProductsExcel(filteredProducts, categories, {
      filenamePrefix: "Produk-Filter-Flypick-Catalog",
    });
    setIsOpen(false);
  };

  const handleDownloadSelected = () => {
    downloadProductsExcel(selectedProducts, categories, {
      filenamePrefix: `Produk-Terpilih-${selectedProducts.length}-Flypick-Catalog`,
    });
    setIsOpen(false);
  };

  const handleDownloadTemplate = () => {
    downloadProductsExcel([], categories, {
      isTemplateOnly: true,
      filenamePrefix: "Template-Upload-Flypick-Catalog",
    });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-2xs transition hover:border-emerald-300 hover:bg-emerald-100/80"
      >
        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
        <span>Download Excel</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-emerald-600 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-72 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900">
              Export Katalog ke Excel (.xlsx)
            </p>
            <p className="text-[11px] text-slate-500">
              Lengkap dengan Harga Yuan, Berat, Kurs &amp; Harga Jual
            </p>
          </div>

          <div className="mt-1 space-y-1">
            {/* Opsi 1: Download Semua Produk */}
            <button
              type="button"
              disabled={allProducts.length === 0}
              onClick={handleDownloadAll}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:opacity-40"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Download className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Semua Produk ({allProducts.length})
                </div>
                <div className="text-[11px] text-slate-500">
                  Download seluruh data produk di katalog
                </div>
              </div>
            </button>

            {/* Opsi 2: Download Produk yang Dicentang (jika ada) */}
            {selectedProducts.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadSelected}
                className="flex w-full items-start gap-3 rounded-xl bg-sky-50/60 px-3 py-2.5 text-left transition hover:bg-sky-100/70"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                  <CheckSquare className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-sky-900">
                    Produk yang Dicentang ({selectedProducts.length})
                  </div>
                  <div className="text-[11px] text-sky-700">
                    Hanya produk yang sedang Anda pilih di tabel
                  </div>
                </div>
              </button>
            )}

            {/* Opsi 3: Download Hasil Filter (jika sedang memfilter) */}
            {isFiltered && filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadFiltered}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Filter className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Hasil Filter Saat Ini ({filteredProducts.length})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Sesuai filter status / pencarian aktif
                  </div>
                </div>
              </button>
            )}

            <div className="my-1 border-t border-slate-100" />

            {/* Opsi 4: Download Template Kosong */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileTemplateIcon className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Template Kosong (.xlsx)
                </div>
                <div className="text-[11px] text-slate-500">
                  Contoh format &amp; panduan untuk tambah produk baru
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

