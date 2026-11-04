"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Upload,
  ChevronDown,
  CheckSquare,
  Filter,
  FileSpreadsheet as FileTemplateIcon,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import { downloadProductsExcel } from "@/lib/excel";
import AdminExcelImportModal from "@/components/AdminExcelImportModal";

interface AdminExcelMenuProps {
  allProducts: Product[];
  filteredProducts: Product[];
  selectedIds: string[];
  categories: Category[];
  isFiltered: boolean;
}

export default function AdminExcelMenu({
  allProducts,
  filteredProducts,
  selectedIds,
  categories,
  isFiltered,
}: AdminExcelMenuProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const selectedProducts = allProducts.filter((p) =>
    selectedIds.includes(p.id)
  );

  const handleDownloadAll = () => {
    downloadProductsExcel(allProducts, categories, {
      filenamePrefix: "Semua-Produk-Flypick-Catalog",
    });
    setIsDropdownOpen(false);
  };

  const handleDownloadFiltered = () => {
    downloadProductsExcel(filteredProducts, categories, {
      filenamePrefix: "Produk-Filter-Flypick-Catalog",
    });
    setIsDropdownOpen(false);
  };

  const handleDownloadSelected = () => {
    downloadProductsExcel(selectedProducts, categories, {
      filenamePrefix: `Produk-Terpilih-${selectedProducts.length}-Flypick-Catalog`,
    });
    setIsDropdownOpen(false);
  };

  const handleDownloadTemplate = () => {
    downloadProductsExcel([], categories, {
      isTemplateOnly: true,
      filenamePrefix: "Template-Upload-Flypick-Catalog",
    });
    setIsDropdownOpen(false);
  };

  const handleOpenImport = () => {
    setIsDropdownOpen(false);
    setIsImportModalOpen(true);
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* Tombol Pemicu Elegan & Senada */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>Excel Data</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu Rapi */}
        {isDropdownOpen && (
          <div className="absolute right-0 z-40 mt-2 w-72 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900">
                Manajemen Data Excel (.xlsx)
              </p>
              <p className="text-[11px] text-slate-500">
                Impor produk massal &amp; ekspor katalog
              </p>
            </div>

            <div className="mt-1 space-y-1">
              {/* Opsi Upload & Import Excel */}
              <button
                type="button"
                onClick={handleOpenImport}
                className="flex w-full items-start gap-3 rounded-xl bg-sky-50/70 p-2.5 text-left transition hover:bg-sky-100/80"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                  <Upload className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-sky-900">
                    Upload &amp; Import Excel
                  </div>
                  <div className="text-[11px] text-sky-700">
                    Tambah / perbarui produk massal dari file
                  </div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-100" />

              {/* Opsi Download Semua Produk */}
              <button
                type="button"
                disabled={allProducts.length === 0}
                onClick={handleDownloadAll}
                className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50 disabled:opacity-40"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Download className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Download Semua Produk ({allProducts.length})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Ekspor seluruh data katalog ke Excel
                  </div>
                </div>
              </button>

              {/* Opsi Download Produk yang Dicentang (jika ada) */}
              {selectedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadSelected}
                  className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white">
                    <CheckSquare className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Download yang Dicentang ({selectedProducts.length})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Hanya produk yang dipilih di tabel
                    </div>
                  </div>
                </button>
              )}

              {/* Opsi Download Hasil Filter (jika sedang memfilter) */}
              {isFiltered && filteredProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadFiltered}
                  className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Filter className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Download Hasil Filter ({filteredProducts.length})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Sesuai filter status / pencarian aktif
                    </div>
                  </div>
                </button>
              )}

              <div className="my-1 border-t border-slate-100" />

              {/* Opsi Download Template Kosong */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <FileTemplateIcon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Template Kosong (.xlsx)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Contoh format untuk tambah produk baru
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Import Terpadu */}
      <AdminExcelImportModal
        products={allProducts}
        categories={categories}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        showTrigger={false}
      />
    </>
  );
}

