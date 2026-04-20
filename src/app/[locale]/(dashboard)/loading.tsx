import { Card } from '@/components/ui/Card';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
        <div className="h-6 w-56 animate-pulse rounded bg-[hsl(var(--muted))]" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-5 w-24 animate-pulse rounded bg-[hsl(var(--muted))]" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 flex-1 animate-pulse rounded bg-[hsl(var(--muted))]" />
          <div className="h-10 w-40 animate-pulse rounded bg-[hsl(var(--muted))]" />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="space-y-0 divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[hsl(var(--muted))]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[hsl(var(--muted))]" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-[hsl(var(--muted))]" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
