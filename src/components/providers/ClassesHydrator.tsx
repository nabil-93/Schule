'use client';

import { useEffect } from 'react';
import { useClassesStore } from '@/lib/store/classes';
import type { SchoolClass } from '@/types';

export function ClassesHydrator({ classes }: { classes: SchoolClass[] }) {
  const setClasses = useClassesStore((s) => s.setClasses);
  useEffect(() => {
    setClasses(classes);
  }, [classes, setClasses]);
  return null;
}
