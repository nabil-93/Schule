'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { GradeDistributionPoint, Mention } from '@/lib/queries/overview';

const COLORS: Record<Mention, string> = {
  excellent: '#10b981',
  good: '#6366f1',
  fair: '#0ea5e9',
  pass: '#f59e0b',
  fail: '#ef4444',
};

export function MentionsChart({
  data,
  labels,
}: {
  data: GradeDistributionPoint[];
  labels: Record<Mention, string>;
}) {
  const rows = data
    .filter((d) => d.count > 0)
    .map((d) => ({ name: labels[d.mention], value: d.count, mention: d.mention }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
          >
            {rows.map((r) => (
              <Cell key={r.mention} fill={COLORS[r.mention]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
