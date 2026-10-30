"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Category, Product } from "@/types/database";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/app/actions/product";

interface AdminCategoryManagerProps {
  categories: Category[];
  products: Product[];
}

export default function AdminCategoryManager({
  categories,
  products,
}: AdminCategoryManagerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getProductCount = (categoryId: string) =>
    products.filter((p) => p.category_id === categoryId).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setErrorMsg(null);
    setIsCreating(true);
    const res = await createCategoryAction(newName);
    setIsCreating(false);

    if (!res.success) {
      setErrorMsg(res.error || "Gagal menambah kategori.");
      return;
    }

    setNewName("");
    router.refresh();
  };

  const handleStartEdit = (cat: Category) => {
    setErrorMsg(null);
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = async (categoryId: string) => {
    if (!editingName.trim()) return;

    setErrorMsg(null);
    setIsUpdating(true);
    const res = await updateCategoryAction(categoryId, editingName);
    setIsUpdating(false);

    if (!res.success) {
      setErrorMsg(res.error || "Gagal mengubah nama kategori.");
      return;
    }

    setEditingId(null);
    setEditingName("");
    router.refresh();
  };

  const handleDelete = async (cat: Category) => {
    const count = getProductCount(cat.id);
    const confirmMessage =
      count > 0
        ? `Hapus kategori "${cat.name}"? (${count} produk di kategori ini akan menjadi 'Tanpa Kategori')`
        : `Hapus kategori "${cat.name}"?`;

    if (!window.confirm(confirmMessage)) return;

    setErrorMsg(null);
    setDeletingId(cat.id);
    const res = await deleteCategoryAction(cat.id);
    setDeletingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Gagal menghapus kategori.");
      return;
    }

    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null);
          setIsOpen(true);
        }}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        <FolderKanban className="h-4 w-4 text-slate-600" />
        <span>Kelola Kategori ({categories.length})</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Manajemen Kategori Produk
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tambah, ubah nama, atau hapus kategori katalog
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form Tambah Kategori Baru */}
              <form onSubmit={handleCreate} className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ketik nama kategori baru..."
                  className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isCreating || !newName.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Tambah</span>
                </button>
              </form>

              {/* Daftar Kategori */}
              {categories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
                  Belum ada kategori. Tambahkan kategori pertama Anda di atas.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {categories.map((cat) => {
                    const isEditing = editingId === cat.id;
                    const isDeleting = deletingId === cat.id;
                    const count = getProductCount(cat.id);

                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70"
                      >
                        {isEditing ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveEdit(cat.id);
                                } else if (e.key === "Escape") {
                                  setEditingId(null);
                                }
                              }}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleSaveEdit(cat.id)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                              title="Simpan"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                              title="Batal"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {cat.name}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  {count} produk
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                /{cat.slug}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(cat)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                                title="Ubah Nama Kategori"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleDelete(cat)}
                                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50/50 p-1.5 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                title="Hapus Kategori"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

