import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  computeAdminSessionToken,
} from "@/lib/auth-token";

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
