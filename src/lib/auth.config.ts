// Lightweight Auth.js config: NO bcrypt, NO database import.
// Safe to import into src/proxy.ts (Node.js runtime, but kept dependency-free
// on purpose so the route-matching path never drags in Drizzle/Neon/bcryptjs).
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 180, // 180 days — AUTH-02: stay logged in for months
    updateAge: 60 * 60 * 24, // refresh expiry once per day of activity
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      if (isOnLogin) return true;
      return isLoggedIn; // false triggers Auth.js's built-in redirect to pages.signIn
    },
  },
  providers: [], // the real Credentials provider is added only in auth.ts
} satisfies NextAuthConfig;
