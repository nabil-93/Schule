'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, LineChart, AreaChart, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ChartType, TimeRange } from '@/types';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: (config: { type: ChartType; range: TimeRange }) => React.ReactNode;
  defaultType?: ChartType;
  defaultRange?: TimeRange;
  availableTypes?: ChartType[];
  onRangeChange?: (range: TimeRange) => void;
  activeRange?: TimeRange;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  defaultType = 'bar',
  defaultRange = '6m',
  availableTypes = ['bar', 'line', 'area'],
  onRangeChange,
  activeRange,
}: ChartContainerProps) {
  const [type, setType] = useState<ChartType>(defaultType);
  const [internalRange, setInternalRange] = useState<TimeRange>(defaultRange);
  const range = activeRange ?? internalRange;
  
  const handleRangeChange = (r: TimeRange) => {
    if (onRangeChange) onRangeChange(r);
    else setInternalRange(r);
  };

  const t = useTranslations('overview.charts');

  const ranges: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '6m', label: '6m' },
    { value: '1y', label: '1y' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold leading-none tracking-tight">{title}</h3>
          {subtitle && <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="flex items-center rounded-lg border bg-[hsl(var(--muted))]/30 p-1">
            {availableTypes.includes('bar') && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7 rounded-md', type === 'bar' && 'bg-[hsl(var(--card))] shadow-sm')}
                onClick={() => setType('bar')}
                title="Bar Chart"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            )}
            {availableTypes.includes('line') && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7 rounded-md', type === 'line' && 'bg-[hsl(var(--card))] shadow-sm')}
                onClick={() => setType('line')}
                title="Line Chart"
              >
                <LineChart className="h-4 w-4" />
              </Button>
            )}
            {availableTypes.includes('area') && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7 rounded-md', type === 'area' && 'bg-[hsl(var(--card))] shadow-sm')}
                onClick={() => setType('area')}
                title="Area Chart"
              >
                <AreaChart className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center rounded-lg border bg-[hsl(var(--muted))]/30 p-1">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => handleRangeChange(r.value)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md',
                  range === r.value
                    ? 'bg-[hsl(var(--card))] text-brand-600 shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 min-h-[300px]">
        {children({ type, range })}
      </div>
    </div>
  );
}
