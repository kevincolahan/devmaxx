import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Devmaxx',
  description: 'Devmaxx privacy policy. How we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-brand-400 hover:text-brand-300">
        &larr; Back to Devmaxx
      </Link>

      <h1 className="mt-6 text-4xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 30, 2026</p>

      <div className="mt-10 space-y-8 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
          <p className="mt-3">
            Devmaxx (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates devmaxx.app, an AI-powered business operations platform for Roblox game creators. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Information We Collect</h2>
          <p className="mt-3"><strong className="text-white">Account Information:</strong> When you sign up, we collect your email address via magic link authentication. We do not collect or store passwords.</p>
          <p className="mt-3"><strong className="text-white">Roblox Data:</strong> When you connect your Roblox account via OAuth, we receive and store your Roblox user ID, username, display name, and OAuth tokens (access and refresh). We use these tokens to access your game analytics, economy data, and player metrics through the Roblox Open Cloud API on your behalf.</p>
          <p className="mt-3"><strong className="text-white">Game Data:</strong> We collect and store game analytics including daily active users, revenue, retention rates, player counts, support tickets, and item pricing data. This data is used by our AI agents to provide optimization recommendations.</p>
          <p className="mt-3"><strong className="text-white">Payment Information:</strong> Payment processing is handled by Stripe. We store your Stripe customer ID but never store credit card numbers, bank account details, or other financial information directly.</p>
          <p className="mt-3"><strong className="text-white">Usage Data:</strong> We collect information about how you interact with our platform, including pages visited, features used, and agent run history.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. How We Use Your Information</h2>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>Operate and maintain our AI agent platform</li>
            <li>Analyze your game metrics and provide optimization recommendations</li>
            <li>Run automated pricing tests, competitor tracking, and content generation</li>
            <li>Send weekly Growth Brief emails with performance summaries</li>
            <li>Process subscription payments and manage your account</li>
            <li>Respond to support requests and communicate service updates</li>
            <li>Improve our platform and develop new features</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. AI Processing</h2>
          <p className="mt-3">
            Our platform uses AI agents powered by Anthropic&apos;s Claude to analyze your game data, generate content, and provide recommendations. Your game data is sent to Anthropic&apos;s API for processing. We do not use your data to train AI models. Anthropic&apos;s data handling is governed by their own privacy policy and data processing agreement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Data Sharing</h2>
          <p className="mt-3">We do not sell your personal information. We share data only with:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li><strong className="text-white">Anthropic:</strong> Game analytics data for AI agent processing</li>
            <li><strong className="text-white">Stripe:</strong> Email and subscription data for payment processing</li>
            <li><strong className="text-white">Resend:</strong> Email address for transactional emails (magic links, Growth Briefs)</li>
            <li><strong className="text-white">Roblox:</strong> OAuth tokens to access your game data on your behalf</li>
            <li><strong className="text-white">Railway/Vercel:</strong> Infrastructure providers that host our application</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Data Storage and Security</h2>
          <p className="mt-3">
            Your data is stored in a PostgreSQL database hosted on Railway with encrypted connections. OAuth tokens are stored encrypted at rest. We use HTTPS for all data transmission. We implement industry-standard security measures to protect your data, but no method of electronic storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Data Retention</h2>
          <p className="mt-3">
            We retain your data for as long as your account is active. Game metric snapshots are retained for historical analysis. If you delete your account, we will delete your personal data within 30 days. Aggregated, anonymized data may be retained for analytics purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. Your Rights</h2>
          <p className="mt-3">You have the right to:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Disconnect your Roblox account at any time from the dashboard</li>
            <li>Export your data in a machine-readable format</li>
            <li>Opt out of non-essential communications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">9. Cookies</h2>
          <p className="mt-3">
            We use essential cookies for authentication session management and CSRF protection during OAuth flows. We do not use advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">10. Children&apos;s Privacy</h2>
          <p className="mt-3">
            Devmaxx is a business tool for Roblox game creators. Our service is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">11. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice on our platform. Your continued use of the service after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">12. Contact Us</h2>
          <p className="mt-3">
            If you have questions about this Privacy Policy or your data, contact us at{' '}
            <a href="mailto:kevin@devmaxx.app" className="text-brand-400 hover:text-brand-300">
              kevin@devmaxx.app
            </a>.
          </p>
        </section>
      </div>
    </main>
  );
}
