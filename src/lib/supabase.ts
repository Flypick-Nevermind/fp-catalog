import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Custom fetch wrapper dengan `cache: "no-store"` agar Next.js 14 Data Cache
 * tidak pernah menyimpan hasil query lama ketika ada multi-user yang menambah/edit produk.
 */
const noStoreFetch: typeof fetch = (input, init) => {
  return fetch(input, {
    ...init,
    cache: "no-store",
  });
};

/**
 * Public Supabase Client (Anon Key)
 * Digunakan untuk pembacaan data publik (terikat RLS) dan upload media ke bucket publik.
 */
export const supabasePublic = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: noStoreFetch,
    },
  }
);

/**
 * Server Admin Supabase Client (Service Role Key)
 * HANYA dipanggil di sisi server (Server Actions / Server Components Admin).
 * Mem-bypass RLS untuk operasi CRUD penuh dan selalu mengambil data real-time (`no-store`).
 */
export function createSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables."
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: noStoreFetch,
    },
  });
}
