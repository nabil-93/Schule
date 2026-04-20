import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'brand',
}: {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  tone?: 'brand' | 'emerald' | 'amber' | 'sky';
}) {
  const toneBg: Record<string, string> = {
    brand: 'bg-brand-600/10 text-brand-700 dark:text-brand-300',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  };

  const up = (delta ?? 0) >= 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
          {delta !== undefined && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}
            >
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {up ? '+' : ''}{delta}%
            </div>
          )}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', toneBg[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
