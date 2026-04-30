import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB, no bcrypt). Used by middleware.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // Real providers added in /lib/auth.ts
  callbacks: {
    authorized: ({ auth }) => !!auth,
  },
};
