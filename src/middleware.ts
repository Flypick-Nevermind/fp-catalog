import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "fp_admin_session";

/**
 * Menghasilkan token sesi statis berbasis secret menggunakan Web Crypto API (kompatibel di Edge Runtime)
 */
export async function computeAdminSessionToken(): Promise<string> {
  const password = process.env.ADMIN_SECRET_PASSWORD || "";
  const secret = process.env.ADMIN_SESSION_SECRET || "default-fp-catalog-secret";
  const raw = `${password}:${secret}:fp-admin-v1`;

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Hanya proteksi rute /admin/*
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const expectedToken = await computeAdminSessionToken();
    const isAuthenticated =
      Boolean(process.env.ADMIN_SECRET_PASSWORD) &&
      sessionCookie === expectedToken;

    // Jika sudah login dan membuka halaman /admin/login, arahkan ke dashboard /admin
    if (pathname === "/admin/login") {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }

    // Jika belum login pada rute /admin lainnya, redirect ke /admin/login
    if (!isAuthenticated) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

