export const ADMIN_COOKIE_NAME = "fp_admin_session";

/**
 * Menghasilkan token sesi statis berbasis secret menggunakan Web Crypto API
 * (Kompatibel di Edge Runtime maupun Node.js Server Actions)
 */
export async function computeAdminSessionToken(): Promise<string> {
  const password = (process.env.ADMIN_SECRET_PASSWORD || "").trim();
  const secret = (
    process.env.ADMIN_SESSION_SECRET || "default-fp-catalog-secret"
  ).trim();
  const raw = `${password}:${secret}:fp-admin-v1`;

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

