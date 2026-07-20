import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
        // Auto-create admin user if none exist
        const userCount = await db.user.count();
        if (userCount === 0) {
          const hashedPassword = await bcrypt.hash("admin12345678", 10);
          const admin = await db.user.create({
            data: {
              name: "Admin",
              email: "admin@local",
              password: hashedPassword,
              role: "admin",
            },
          });
          return {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
          };
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
        } catch (error) {
          console.error("[AUTH] Database error during login:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "crosspost-studio-dev-secret-change-me",
  // AUTH_TRUST_HOST=true in .env handles cross-origin auth for Vercel previews
};
