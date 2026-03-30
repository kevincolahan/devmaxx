import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Devmaxx',
  description: 'Devmaxx terms of service. Rules and guidelines for using our platform.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-brand-400 hover:text-brand-300">
        &larr; Back to Devmaxx
      </Link>

      <h1 className="mt-6 text-4xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 30, 2026</p>

      <div className="mt-10 space-y-8 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using Devmaxx (&quot;the Service&quot;), operated by Devmaxx (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. The Service is available at devmaxx.app.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Description of Service</h2>
          <p className="mt-3">
            Devmaxx is an AI-powered business operations platform for Roblox game creators. The Service provides autonomous AI agents that analyze game metrics, optimize pricing, track competitors, generate content, handle player support, and deliver weekly growth briefs. The Service integrates with the Roblox Open Cloud API, Stripe for payments, and other third-party services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. Account Registration</h2>
          <p className="mt-3">
            To use the Service, you must create an account using a valid email address. You are responsible for maintaining the security of your account and for all activities that occur under your account. You must be at least 18 years old or the age of majority in your jurisdiction to use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. Roblox Account Connection</h2>
          <p className="mt-3">
            The Service requires you to connect your Roblox account via OAuth to function. By connecting your Roblox account, you authorize us to access your game analytics, economy data, and player metrics through the Roblox Open Cloud API. You may disconnect your Roblox account at any time from the dashboard, which will stop all agent activity.
          </p>
          <p className="mt-3">
            You represent that you have the authority to grant us access to the Roblox games and data associated with your account. You are responsible for ensuring your use of our Service complies with Roblox&apos;s Terms of Use and Creator policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Subscription Plans and Payment</h2>
          <p className="mt-3">
            The Service offers Free, Creator ($49/mo), Pro ($99/mo), and Studio ($249/mo) subscription tiers. Paid subscriptions are billed monthly through Stripe. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period.
          </p>
          <p className="mt-3">
            We reserve the right to change pricing with 30 days&apos; notice. Price changes will not affect your current billing period.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. AI Agent Operations</h2>
          <p className="mt-3"><strong className="text-white">Autopilot Mode:</strong> If you enable Autopilot mode (available on Pro and Studio plans), AI agents may automatically implement pricing changes and optimizations on your Roblox games. You acknowledge that automated actions carry inherent risk and agree that Devmaxx is not liable for revenue changes resulting from automated agent actions.</p>
          <p className="mt-3"><strong className="text-white">Manual Mode:</strong> In manual mode, agents provide recommendations that require your approval before any changes are made to your games.</p>
          <p className="mt-3"><strong className="text-white">Safety Limits:</strong> All agents operate within safety constraints including maximum refund amounts (500 Robux auto-approve limit), price test duration limits (72 hours or 500 exposures), and minimum price floors. These limits cannot be overridden.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Acceptable Use</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>Use the Service to violate Roblox&apos;s Terms of Use or any applicable laws</li>
            <li>Attempt to reverse-engineer, decompile, or extract source code from the Service</li>
            <li>Use the Service to manipulate or exploit Roblox&apos;s platform in unauthorized ways</li>
            <li>Share your account credentials or OAuth tokens with third parties</li>
            <li>Use the Service to generate content that is illegal, harmful, or violates third-party rights</li>
            <li>Interfere with the operation of the Service or its infrastructure</li>
            <li>Exceed the game limits of your subscription tier</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. Intellectual Property</h2>
          <p className="mt-3">
            The Service, including its software, design, and AI agents, is owned by Devmaxx and protected by intellectual property laws. Content generated by AI agents for your games belongs to you. You retain all rights to your Roblox games and data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">9. Disclaimer of Warranties</h2>
          <p className="mt-3">
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI AGENT RECOMMENDATIONS WILL RESULT IN INCREASED REVENUE. PAST PERFORMANCE OF AI AGENTS DOES NOT GUARANTEE FUTURE RESULTS.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">10. Limitation of Liability</h2>
          <p className="mt-3">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, DEVMAXX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF ROBUX, REVENUE, OR DATA, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">11. Indemnification</h2>
          <p className="mt-3">
            You agree to indemnify and hold harmless Devmaxx from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights including Roblox&apos;s Terms of Use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">12. Termination</h2>
          <p className="mt-3">
            We may suspend or terminate your account if you violate these Terms or if required by law. You may delete your account at any time. Upon termination, your right to use the Service ceases immediately. We will delete your data within 30 days of account deletion, except as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">13. Changes to Terms</h2>
          <p className="mt-3">
            We may update these Terms from time to time. We will notify you of material changes by email or by posting a notice on the Service. Your continued use after changes constitutes acceptance. If you disagree with updated Terms, you must stop using the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">14. Governing Law</h2>
          <p className="mt-3">
            These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Delaware.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">15. Contact</h2>
          <p className="mt-3">
            Questions about these Terms? Contact us at{' '}
            <a href="mailto:kevin@devmaxx.app" className="text-brand-400 hover:text-brand-300">
              kevin@devmaxx.app
            </a>.
          </p>
        </section>
      </div>
    </main>
  );
}
