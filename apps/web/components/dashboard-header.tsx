'use client';

import Link from 'next/link';

interface DashboardHeaderProps {
  gameName: string | null;
  plan: string;
  email: string;
  sidebarCollapsed: boolean;
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: 'bg-gray-700/50 text-gray-400 border-gray-600/30',
    creator: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    pro: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    studio: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors[plan] ?? colors.free}`}>
      {plan}
    </span>
  );
}

export function DashboardHeader({ gameName, plan, email, sidebarCollapsed }: DashboardHeaderProps) {
  return (
    <header
      className={`fixed right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-[rgba(79,70,229,0.15)] bg-[#080810]/90 px-4 backdrop-blur transition-all duration-300 ${
        sidebarCollapsed ? 'lg:left-[60px]' : 'lg:left-[240px]'
      } left-0`}
    >
      {/* Left: Game name (mobile shows logo) */}
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-white lg:hidden">Devmaxx</span>
        {gameName && (
          <div className="hidden items-center gap-2 lg:flex">
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
            <span className="text-sm font-medium text-gray-300">{gameName}</span>
          </div>
        )}
        {!gameName && (
          <span className="hidden text-sm text-gray-500 lg:block">No game connected</span>
        )}
      </div>

      {/* Right: Plan + Avatar */}
      <div className="flex items-center gap-3">
        <PlanBadge plan={plan} />
        <Link
          href="/leaderboard"
          className="hidden text-xs text-gray-500 transition hover:text-indigo-400 sm:block"
        >
          Leaderboard
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#141428] text-xs font-bold text-indigo-400">
          {email.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
