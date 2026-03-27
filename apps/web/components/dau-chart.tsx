'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Snapshot {
  date: string;
  dau: number;
}

interface DauChartProps {
  snapshots: Snapshot[];
  gameName: string;
}

export function DauChart({ snapshots, gameName }: DauChartProps) {
  const data = [...snapshots]
    .reverse()
    .map((s) => ({
      date: new Date(s.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      dau: s.dau,
    }));

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">{gameName} — 7-Day DAU</h3>
        <div className="flex h-48 items-center justify-center text-gray-500">
          No metric snapshots yet. Agents will populate this after their first run.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 font-semibold text-white">{gameName} — 7-Day DAU</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f9fafb',
            }}
          />
          <Area
            type="monotone"
            dataKey="dau"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#dauGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
