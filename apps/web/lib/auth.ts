import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Resend from 'next-auth/providers/resend';
import { db } from '@/lib/db';

const API_BASE = process.env.API_BASE_URL || 'https://devmaxx-production.up.railway.app';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/check-email',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Send welcome email on first signup
      if (user.email) {
        console.log(`[Auth] New user created: ${user.email} — triggering welcome email`);

        // Create Creator record if it doesn't exist
        let creator = await db.creator.findUnique({ where: { email: user.email } });
        if (!creator) {
          creator = await db.creator.create({ data: { email: user.email } });
        }

        // Trigger welcome email via Railway API (fire and forget)
        fetch(`${API_BASE}/api/onboarding/welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creatorId: creator.id, email: user.email }),
        }).catch((err) => {
          console.error('[Auth] Failed to trigger welcome email:', err);
        });
      }
    },
  },
  trustHost: true,
});
