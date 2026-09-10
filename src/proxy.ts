// Next.js 16 route protection (renamed from middleware.ts). Imports
// authConfig ONLY — never src/lib/auth.ts — so this file's bundle stays
// free of Drizzle/Neon/bcryptjs.
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

// The home-screen assets must stay public. A browser fetches the manifest
// with credentials omitted, so behind the auth gate it receives the login
// page's HTML instead of JSON and the install fails with no visible error —
// which is exactly what happened the first time these were added.
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest\\.webmanifest|icon\\.svg|apple-icon\\.png|icon-(?:192|512|maskable-512)\\.png).*)",
  ],
};
