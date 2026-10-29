"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, computeAdminSessionToken } from "@/middleware";

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

export async function loginAdminAction(
  password: string
): Promise<AuthActionResult> {
  const expectedPassword = process.env.ADMIN_SECRET_PASSWORD;

  if (!expectedPassword) {
    return {
      success: false,
      error: "ADMIN_SECRET_PASSWORD belum dikonfigurasi di server (.env.local).",
    };
  }

  if (password !== expectedPassword) {
    return {
      success: false,
      error: "Password admin tidak valid. Silakan coba kembali.",
    };
  }

  const sessionToken = await computeAdminSessionToken();
  const cookieStore = cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 hari
  });

  return { success: true };
}

export async function logoutAdminAction() {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!sessionCookie || !process.env.ADMIN_SECRET_PASSWORD) {
    return false;
  }
  const expectedToken = await computeAdminSessionToken();
  return sessionCookie === expectedToken;
}

