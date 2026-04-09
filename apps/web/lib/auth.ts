import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Resend from 'next-auth/providers/resend';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';

const API_BASE = process.env.API_BASE_URL || 'https://devmaxx-production.up.railway.app';

function generateReferralCode(email: string): string {
  const prefix = email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 4).toLowerCase();
  const suffix = randomBytes(2).toString('hex');
  return `${prefix}_${suffix}`;
}

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

        // Read referral cookie
        let referredBy: string | undefined;
        try {
          const cookieStore = await cookies();
          referredBy = cookieStore.get('devmaxx_ref')?.value;
        } catch {
          // cookies() may not be available in all contexts
        }

        // Generate unique referral code
        let referralCode = generateReferralCode(user.email);
        // Ensure uniqueness — retry with different suffix if collision
        for (let i = 0; i < 5; i++) {
          const existing = await db.creator.findUnique({ where: { referralCode } });
          if (!existing) break;
          referralCode = generateReferralCode(user.email);
        }

        // Create Creator record if it doesn't exist
        let creator = await db.creator.findUnique({ where: { email: user.email } });
        if (!creator) {
          creator = await db.creator.create({
            data: {
              email: user.email,
              referralCode,
              referredBy: referredBy || null,
            },
          });
        } else if (!creator.referralCode) {
          // Backfill referral code for existing creators
          creator = await db.creator.update({
            where: { id: creator.id },
            data: {
              referralCode,
              referredBy: creator.referredBy ?? referredBy ?? null,
            },
          });
        }

        // If referred, create pending Referral record
        if (referredBy) {
          const referrer = await db.creator.findUnique({ where: { referralCode: referredBy } });
          if (referrer) {
            await db.referral.create({
              data: {
                referrerCode: referredBy,
                referrerId: referrer.id,
                referredId: creator.id,
                referredEmail: user.email,
                status: 'pending',
              },
            });
            console.log(`[Auth] Referral tracked: ${user.email} referred by ${referrer.email} (code: ${referredBy})`);
          }
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
