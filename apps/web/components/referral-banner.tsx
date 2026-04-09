'use client';

import { useEffect, useState } from 'react';

export function ReferralBanner() {
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    // Read the devmaxx_ref cookie
    const match = document.cookie.match(/(?:^|;\s*)devmaxx_ref=([^;]*)/);
    if (match) {
      setRefCode(match[1]);
    }
  }, []);

  if (!refCode) return null;

  return (
    <div className="border-b border-indigo-500/20 bg-indigo-950/50 px-4 py-3 text-center">
      <p className="text-sm text-indigo-200">
        You were invited by a Devmaxx creator — sign up for a{' '}
        <span className="font-semibold text-white">free 14-day Pro trial</span>
      </p>
    </div>
  );
}
