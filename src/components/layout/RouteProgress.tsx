'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Thin animated bar pinned to the very top of the viewport. It starts on every
 * pathname change and completes once the new route has committed. Purely a
 * visual hint — navigation itself is driven by Next's built-in streaming.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const firstRender = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    timers.current.forEach(clearTimeout);
    timers.current = [];

    setVisible(true);
    setProgress(15);
    timers.current.push(setTimeout(() => setProgress(55), 120));
    timers.current.push(setTimeout(() => setProgress(82), 320));

    timers.current.push(
      setTimeout(() => {
        setProgress(100);
        timers.current.push(
          setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, 200),
        );
      }, 520),
    );

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
    >
      <div
        className="h-full bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
