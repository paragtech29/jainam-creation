// Next.js 16 route protection (renamed from middleware.ts). Imports
// authConfig ONLY — never src/lib/auth.ts — so this file's bundle stays
// free of Drizzle/Neon/bcryptjs.
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
