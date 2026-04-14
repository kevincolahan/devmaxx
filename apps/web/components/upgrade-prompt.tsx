'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

const PLAN_PRICES: Record<string, number> = {
  creator: 49,
  pro: 99,
  studio: 249,
};

const PLAN_LABELS: Record<string, string> = {
  creator: 'Creator',
  pro: 'Pro',
  studio: 'Studio',
};

interface UpgradePromptProps {
  feature: string;
  benefit: string;
  requiredPlan: 'creator' | 'pro' | 'studio';
  currentPlan: string;
  variant: 'banner' | 'blur' | 'inline' | 'modal';
  children?: ReactNode;
  urgency?: string;
}

function trackClick(plan: string, feature: string) {
  fetch('/api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upgrade_click',
      data: { plan, feature, timestamp: new Date().toISOString() },
    }),
  }).catch(() => {});
}

function UpgradeButton({ plan, feature }: { plan: string; feature: string }) {
  return (
    <Link
      href="/pricing"
      onClick={() => trackClick(plan, feature)}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
    >
      Upgrade to {PLAN_LABELS[plan] ?? plan}
    </Link>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
      {PLAN_LABELS[plan] ?? plan} plan
    </span>
  );
}

export function UpgradePrompt({
  feature,
  benefit,
  requiredPlan,
  currentPlan,
  variant,
  children,
  urgency,
}: UpgradePromptProps) {
  // Don't show if user already has the required plan or higher
  const planOrder = ['free', 'creator', 'pro', 'studio'];
  const currentIdx = planOrder.indexOf(currentPlan);
  const requiredIdx = planOrder.indexOf(requiredPlan);
  if (currentIdx >= requiredIdx) {
    return <>{children}</>;
  }

  const price = PLAN_PRICES[requiredPlan] ?? 49;

  if (variant === 'banner') {
    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="font-semibold text-white">Unlock {feature}</span>
              <PlanBadge plan={requiredPlan} />
            </div>
            <p className="mt-1 text-sm text-gray-400">{benefit}</p>
            {urgency && (
              <p className="mt-1 text-xs text-indigo-400">{urgency}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">From ${price}/mo</span>
            <UpgradeButton plan={requiredPlan} feature={feature} />
          </div>
        </div>
        {children}
      </div>
    );
  }

  if (variant === 'blur') {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-indigo-500/30 bg-gray-900/95 p-6 text-center shadow-2xl">
            <svg className="mx-auto h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <h3 className="mt-3 text-lg font-semibold text-white">Unlock {feature}</h3>
            <p className="mt-1 text-sm text-gray-400">{benefit}</p>
            <div className="mt-2">
              <PlanBadge plan={requiredPlan} />
            </div>
            {urgency && (
              <p className="mt-2 text-xs text-indigo-400">{urgency}</p>
            )}
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-sm text-gray-500">From ${price}/mo</span>
              <UpgradeButton plan={requiredPlan} feature={feature} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-indigo-500/10 p-2">
            <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{feature}</span>
              <PlanBadge plan={requiredPlan} />
            </div>
            <p className="mt-1 text-sm text-gray-400">{benefit}</p>
            {urgency && (
              <p className="mt-1 text-xs text-indigo-400">{urgency}</p>
            )}
            <div className="mt-3">
              <UpgradeButton plan={requiredPlan} feature={feature} />
            </div>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // modal variant
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <h2 className="mt-4 text-xl font-bold text-white">Unlock {feature}</h2>
        <p className="mt-2 text-gray-400">{benefit}</p>
        <div className="mt-3">
          <PlanBadge plan={requiredPlan} />
        </div>
        {urgency && (
          <p className="mt-3 text-sm text-indigo-400">{urgency}</p>
        )}
        <div className="mt-6 flex flex-col items-center gap-2">
          <UpgradeButton plan={requiredPlan} feature={feature} />
          <span className="text-sm text-gray-500">From ${price}/mo</span>
        </div>
        {children}
      </div>
    </div>
  );
}
