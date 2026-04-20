'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

/**
 * Plays a subtle notification sound when a new notification row is inserted
 * for the current user. The NotificationsMenu handles display; this bridge
 * only provides the auditory cue.
 */
export function RealtimeNotificationsBridge() {
  const { user } = useAuth();

  useEffect(() => {
    const supabase = createClient();
    const me = user.profile.id;

    const channel = supabase
      .channel(`notif-sound-${me}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${me}`,
        },
        () => {
          // Play a subtle notification sound
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.08;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.stop(ctx.currentTime + 0.3);
          } catch {
            // AudioContext may be blocked by browser policy
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.profile.id]);

  return null;
}
