import { Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export function PagePlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-4 w-4 text-amber-500" />
            Module coming up next
          </CardTitle>
          <CardDescription>
            This module is planned in the roadmap and will be implemented in the next phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Placeholder — wired and routed. Content arrives in a later step.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
