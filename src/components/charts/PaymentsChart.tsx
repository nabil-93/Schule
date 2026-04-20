'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import type { MonthlyPaymentPoint } from '@/lib/queries/overview';

export function PaymentsChart({
  data,
  labels,
}: {
  data: MonthlyPaymentPoint[];
  labels: { paid: string; pending: string; overdue: string };
}) {
  const locale = useLocale();

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const prettified = useMemo(
    () =>
      data.map((d) => {
        const [y, m] = d.month.split('-');
        const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
        const label = new Intl.DateTimeFormat(locale, {
          month: 'short',
          year: '2-digit',
        }).format(date);
        return { ...d, label };
      }),
    [data, locale],
  );

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={prettified} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt.format(v)}
            width={70}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              fontSize: 12,
            }}
            formatter={(v: number) => fmt.format(v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="paid" name={labels.paid} stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar
            dataKey="pending"
            name={labels.pending}
            stackId="a"
            fill="#f59e0b"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="overdue"
            name={labels.overdue}
            stackId="a"
            fill="#ef4444"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
