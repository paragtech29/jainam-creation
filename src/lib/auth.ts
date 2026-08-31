// Full Auth.js v5 instance. Node.js runtime only — imports bcryptjs and the
// users repository. Never import this file from src/proxy.ts; import
// src/lib/auth.config.ts there instead (see Pattern 2 in 01-RESEARCH.md).
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { getUserByUsername } from "@/lib/db/repositories/users";
import { loginSchema } from "@/lib/validation/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await getUserByUsername(username);
        if (!user) return null;

        // Promise form only — no callback argument (bcryptjs Pitfall 7).
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Return null uniformly above for "no such user" and "wrong password"
        // so the response never reveals which case occurred.
        return { id: user.id, name: user.username };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.userId as string;
      return session;
    },
  },
});
