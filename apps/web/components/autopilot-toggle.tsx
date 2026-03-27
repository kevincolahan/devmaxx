'use client';

import { useState } from 'react';

interface AutopilotToggleProps {
  creatorId: string;
  initialValue: boolean;
}

export function AutopilotToggle({ creatorId, initialValue }: AutopilotToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const newValue = !enabled;

    try {
      const res = await fetch('/api/creator/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, autopilot: newValue }),
      });

      if (res.ok) {
        setEnabled(newValue);
      }
    } catch (err) {
      console.error('Failed to toggle autopilot:', err);
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div>
        <h3 className="font-medium text-white">Autopilot Mode</h3>
        <p className="mt-1 text-sm text-gray-400">
          {enabled
            ? 'Agents will auto-implement winning prices and optimizations.'
            : 'Agents will recommend changes for your manual approval.'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          enabled ? 'bg-brand-600' : 'bg-gray-700'
        } ${loading ? 'opacity-50' : ''}`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
