import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import User from "@/models/User";
import dbConnect from "@/db";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("invalid email format"),
  password: z.string().min(4, "password must be at least 4 characters long"),
});

const handler = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 12 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials || !credentials.email || !credentials.password) {
          return null;
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const password = credentials.password;

        const result = loginSchema.safeParse({
          email: normalizedEmail,
          password,
        });

        if (!result.success) {
          throw new Error(
            "Invalid input data: " +
              result.error.errors.map((e) => e.message).join(", ")
          );
        }

        await dbConnect();

        const user = await User.findOne({ email: normalizedEmail });
        if (!user || !user.password) {
          throw new Error("invalid password");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          throw new Error("invalid password");
        }

        return { id: user._id.toString(), email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      const mongodbUser = await User.findOne({ email: session.user.email });

      if (mongodbUser) {
        session.user.id = mongodbUser._id.toString();
        session.user = { ...session.user, ...mongodbUser._doc };
      }

      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
