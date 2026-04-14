'use client';

import { useState, useEffect } from 'react';

interface MilestoneToastProps {
  milestone: string;
  description: string;
  xp: number;
  levelUp?: { from: number; to: number } | null;
  onDismiss: () => void;
}

export function MilestoneToast({
  milestone,
  description,
  xp,
  levelUp,
  onDismiss,
}: MilestoneToastProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 400);
    }, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity duration-300 ${
        visible && !exiting ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => {
        setExiting(true);
        setTimeout(onDismiss, 400);
      }}
    >
      <div
        className={`max-w-sm rounded-2xl border border-indigo-500/40 bg-gray-900 p-8 text-center shadow-2xl shadow-indigo-500/20 transition-all duration-500 ${
          visible && !exiting ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        <div className="text-4xl">&#127918;</div>
        <div className="mt-2 text-xs font-bold uppercase tracking-widest text-indigo-400">
          Milestone Unlocked
        </div>
        <h2 className="mt-3 text-xl font-bold text-white">{milestone}</h2>
        <p className="mt-1 text-sm text-gray-400">{description}</p>

        <div className="mx-auto mt-4 w-48 border-t border-gray-800" />

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-4 py-1.5 text-sm font-bold text-indigo-400">
          +{xp} XP earned
        </div>

        {levelUp && (
          <div className="mt-3 text-sm font-semibold text-emerald-400">
            Level {levelUp.from} &rarr; Level {levelUp.to} &#11014;
          </div>
        )}
      </div>
    </div>
  );
}
