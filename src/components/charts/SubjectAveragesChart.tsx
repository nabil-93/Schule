'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from 'recharts';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import type { SubjectAveragePoint } from '@/lib/queries/overview';
import type { ChartType } from '@/types';

export function SubjectAveragesChart({
  data,
  label,
  type = 'bar',
}: {
  data: SubjectAveragePoint[];
  label: string;
  type?: ChartType;
}) {
  const locale = useLocale();

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale],
  );

  const renderContent = () => (
    <>
      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={type === 'bar'} horizontal={type !== 'bar'} />
      {type === 'bar' ? (
        <>
          <XAxis
            type="number"
            domain={[0, 20]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt.format(v)}
          />
          <YAxis
            type="category"
            dataKey="subject"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={100}
          />
        </>
      ) : (
        <>
          <XAxis
            dataKey="subject"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 20]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt.format(v)}
          />
        </>
      )}
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
      {type === 'bar' ? (
        <Bar dataKey="average20" name={label} fill="#6366f1" radius={[0, 6, 6, 0]} />
      ) : type === 'line' ? (
        <Line type="monotone" dataKey="average20" name={label} stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
      ) : (
        <Area type="monotone" dataKey="average20" name={label} stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
      )}
    </>
  );

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 16, left: 16, bottom: 0 }}>
            {renderContent()}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 10, right: 16, left: 16, bottom: 0 }}>
            {renderContent()}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 16, bottom: 0 }}>
            {renderContent()}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

