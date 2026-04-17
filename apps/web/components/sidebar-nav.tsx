'use client';

import { useState } from 'react';

export type NavSection =
  | 'overview' | 'commands' | 'ask'
  | 'health' | 'metrics' | 'forecast' | 'competitors'
  | 'agent-log' | 'pricing' | 'support' | 'sentiment'
  | 'content' | 'mentions' | 'community' | 'referrals'
  | 'brief' | 'recommendations' | 'events'
  | 'account' | 'prospects';

interface NavItem {
  key: NavSection;
  label: string;
  icon: string;
  count?: number;
}

interface NavGroup {
  title: string;
  emoji: string;
  items: NavItem[];
}

interface SidebarNavProps {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  creator: {
    displayName: string | null;
    email: string;
    xp: number;
    level: number;
    levelTitle: string;
    plan: string;
  } | null;
  counts: {
    pricingActive: number;
    supportEscalated: number;
    contentDraft: number;
    mentionsNegative: number;
    recommendations: number;
    referralCredits: number;
  };
  isAdmin: boolean;
}

const ICONS: Record<string, string> = {
  overview: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  commands: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z',
  ask: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
  health: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  metrics: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  forecast: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
  competitors: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  'agent-log': 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z',
  pricing: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  support: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  sentiment: 'M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z',
  content: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  mentions: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  community: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  referrals: 'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  brief: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  recommendations: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  events: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  account: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  prospects: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
};

function NavIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={className ?? 'h-4.5 w-4.5'} style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      {path.split(' M').map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const thresholds = [0, 100, 500, 1500, 3500, 7000, 12000, 20000, 35000];
  const currentThreshold = thresholds[level - 1] ?? 0;
  const nextThreshold = thresholds[level] ?? thresholds[thresholds.length - 1];
  const progress = nextThreshold > currentThreshold
    ? ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;

  return (
    <div className="mt-2 w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a2e]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
        <span>{xp.toLocaleString()} XP</span>
        <span>Lv {level}</span>
      </div>
    </div>
  );
}

export function SidebarNav({
  active,
  onNavigate,
  collapsed,
  onToggleCollapse,
  creator,
  counts,
  isAdmin,
}: SidebarNavProps) {
  const groups: NavGroup[] = [
    {
      title: 'COMMAND CENTER',
      emoji: '\u26A1',
      items: [
        { key: 'overview', label: 'Dashboard', icon: 'overview' },
        { key: 'commands', label: 'Commands', icon: 'commands' },
        { key: 'ask', label: 'Ask Devmaxx', icon: 'ask' },
      ],
    },
    {
      title: 'ANALYTICS',
      emoji: '\uD83D\uDCCA',
      items: [
        { key: 'health', label: 'Game Health', icon: 'health' },
        { key: 'metrics', label: 'Metrics & DAU', icon: 'metrics' },
        { key: 'forecast', label: 'Revenue Forecast', icon: 'forecast' },
        { key: 'competitors', label: 'Competitor Intel', icon: 'competitors' },
      ],
    },
    {
      title: 'AGENTS',
      emoji: '\uD83E\uDD16',
      items: [
        { key: 'agent-log', label: 'Agent Log', icon: 'agent-log' },
        { key: 'pricing', label: 'Pricing', icon: 'pricing', count: counts.pricingActive },
        { key: 'support', label: 'Support', icon: 'support', count: counts.supportEscalated },
        { key: 'sentiment', label: 'Sentiment', icon: 'sentiment' },
      ],
    },
    {
      title: 'GROWTH',
      emoji: '\uD83D\uDCE3',
      items: [
        { key: 'content', label: 'Content Queue', icon: 'content', count: counts.contentDraft },
        { key: 'mentions', label: 'Mentions', icon: 'mentions', count: counts.mentionsNegative },
        { key: 'community', label: 'Community', icon: 'community' },
        { key: 'referrals', label: 'Referrals', icon: 'referrals', count: counts.referralCredits },
      ],
    },
    {
      title: 'REPORTS',
      emoji: '\uD83D\uDCCB',
      items: [
        { key: 'brief', label: 'Growth Brief', icon: 'brief' },
        { key: 'recommendations', label: 'Recommendations', icon: 'recommendations', count: counts.recommendations },
        { key: 'events', label: 'Events', icon: 'events' },
      ],
    },
  ];

  const settingsItems: NavItem[] = [
    { key: 'account', label: 'Settings', icon: 'account' },
    ...(isAdmin ? [{ key: 'prospects' as NavSection, label: 'Prospects', icon: 'prospects' }] : []),
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-[rgba(79,70,229,0.15)] bg-[#0A0A16] transition-all duration-300 lg:flex ${
          collapsed ? 'w-[60px]' : 'w-[240px]'
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className="flex h-14 items-center justify-between border-b border-[rgba(79,70,229,0.1)] px-4">
          {!collapsed && <span className="text-base font-bold text-white">Devmaxx</span>}
          <button
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-[rgba(79,70,229,0.1)] hover:text-gray-300"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              )}
            </svg>
          </button>
        </div>

        {/* Creator HUD mini */}
        {creator && !collapsed && (
          <div className="border-b border-[rgba(79,70,229,0.1)] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-xs font-bold text-indigo-400">
                {creator.level}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">
                  {creator.displayName ?? creator.email.split('@')[0]}
                </div>
                <div className="text-[10px] text-indigo-400">{creator.levelTitle}</div>
              </div>
            </div>
            <XpBar xp={creator.xp} level={creator.level} />
          </div>
        )}
        {creator && collapsed && (
          <div className="flex justify-center border-b border-[rgba(79,70,229,0.1)] py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-xs font-bold text-indigo-400">
              {creator.level}
            </div>
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                  {group.emoji} {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    title={collapsed ? item.label : undefined}
                    className={`group relative mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                      isActive
                        ? 'bg-[rgba(79,70,229,0.1)] text-white'
                        : 'text-gray-400 hover:bg-[rgba(79,70,229,0.06)] hover:text-gray-200'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500" />
                    )}
                    <NavIcon path={ICONS[item.icon] ?? ICONS.overview} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
                            {item.count}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && item.count !== undefined && item.count > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                        {item.count > 9 ? '9+' : item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Settings at bottom */}
        <div className="border-t border-[rgba(79,70,229,0.1)] px-2 py-2">
          {settingsItems.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                title={collapsed ? item.label : undefined}
                className={`group relative mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                  isActive
                    ? 'bg-[rgba(79,70,229,0.1)] text-white'
                    : 'text-gray-400 hover:bg-[rgba(79,70,229,0.06)] hover:text-gray-200'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500" />
                )}
                <NavIcon path={ICONS[item.icon] ?? ICONS.account} />
                {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[rgba(79,70,229,0.15)] bg-[#0A0A16]/95 backdrop-blur lg:hidden">
        {[
          { key: 'overview' as NavSection, label: 'Home', icon: 'overview' },
          { key: 'agent-log' as NavSection, label: 'Agents', icon: 'agent-log' },
          { key: 'content' as NavSection, label: 'Content', icon: 'content' },
          { key: 'ask' as NavSection, label: 'Chat', icon: 'ask' },
          { key: 'account' as NavSection, label: 'More', icon: 'account' },
        ].map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition ${
                isActive ? 'text-indigo-400' : 'text-gray-500'
              }`}
            >
              <NavIcon path={ICONS[item.icon]} className={`${isActive ? 'text-indigo-400' : 'text-gray-500'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
