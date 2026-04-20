'use client';

import { Link } from '@/i18n/routing';
import { useClassesStore } from '@/lib/store/classes';

interface Props {
  classId: string | null | undefined;
  fallback?: string;
  className?: string;
}

export function ClassLink({ classId, fallback = '—', className }: Props) {
  const cls = useClassesStore((s) =>
    classId ? s.classes.find((c) => c.id === classId) : undefined,
  );
  if (!classId) return <span className={className}>{fallback}</span>;
  const label = cls ? cls.name : classId;
  return (
    <Link
      href={`/classes/${classId}` as `/classes/${string}`}
      className={
        className ??
        'text-brand-700 hover:underline dark:text-brand-300'
      }
    >
      {label}
    </Link>
  );
}

export function ClassName({ classId, fallback = '—' }: Props) {
  const cls = useClassesStore((s) =>
    classId ? s.classes.find((c) => c.id === classId) : undefined,
  );
  if (!classId) return <span>{fallback}</span>;
  return <span>{cls ? cls.name : classId}</span>;
}
