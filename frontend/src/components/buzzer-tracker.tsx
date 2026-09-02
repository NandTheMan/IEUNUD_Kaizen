'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { useSession } from './session-provider';
import { useSocket } from './socket-provider';

interface BuzzerState {
  currentBuzzer: number;
  totalBuzzers: number;
  intervalSeconds: number;
  status: 'IDLE' | 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  remainingSecondsInCurrentBuzzer: number;
}

interface BuzzerTrackerProps {
  className?: string;
}

export function BuzzerTracker({ className }: BuzzerTrackerProps) {
  const { activeSessionId } = useSession();
  const { socket } = useSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [state, setState] = useState<BuzzerState | null>(null);
  const [ticked, setTicked] = useState(false);
  const tickTimeout = useRef<NodeJS.Timeout | null>(null);

  const triggerTick = () => {
    setTicked(true);
    if (tickTimeout.current) clearTimeout(tickTimeout.current);
    tickTimeout.current = setTimeout(() => setTicked(false), 500);
  };

  useEffect(() => {
    if (!activeSessionId) return;
    fetch(`${apiUrl}/sessions/${activeSessionId}/buzzer`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setState(data);
      })
      .catch(() => {});
  }, [activeSessionId, apiUrl]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data: BuzzerState) => setState(data);
    const onTick = (data: BuzzerState) => {
      setState(data);
      triggerTick();
    };
    const onCompleted = (data: BuzzerState) => {
      setState(data);
      triggerTick();
    };

    socket.on('buzzer_updated', onUpdate);
    socket.on('buzzer_tick', onTick);
    socket.on('buzzer_completed', onCompleted);

    return () => {
      socket.off('buzzer_updated', onUpdate);
      socket.off('buzzer_tick', onTick);
      socket.off('buzzer_completed', onCompleted);
    };
  }, [socket]);

  useEffect(
    () => () => {
      if (tickTimeout.current) clearTimeout(tickTimeout.current);
    },
    []
  );

  const isIdle = !state || state.status === 'IDLE';
  const isCompleted = state?.status === 'COMPLETED';
  const isPaused = state?.status === 'PAUSED';
  const isRunning = state?.status === 'RUNNING';
  const showBar = (isRunning || isPaused) && !!state;

  const label = isCompleted
    ? 'Selesai'
    : state?.status === 'INITIALIZED'
    ? 'Siap'
    : isPaused
    ? 'Jeda'
    : isIdle
    ? '--'
    : null;

  // Guard against a 0/undefined interval producing NaN or a stuck 0% width,
  // and clamp so a stale/late payload can never push the bar past 0–100.
  const safeInterval = state ? Math.max(state.intervalSeconds, 1) : 1;
  const remainingPct = state
    ? Math.min(100, Math.max(0, (state.remainingSecondsInCurrentBuzzer / safeInterval) * 100))
    : 0;

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col items-center justify-center overflow-hidden',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={
        isIdle
          ? 'Buzzer belum dimulai'
          : `Buzzer ${state!.currentBuzzer} dari ${state!.totalBuzzers}${label ? `, ${label}` : ''}`
      }
    >
      {/* Single orchestrated tick moment: a soft glow behind the number,
          instead of a border ring + full-panel tint firing at once. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute h-20 w-20 rounded-full bg-primary/15 blur-xl transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none',
          ticked ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        )}
      />

      <div className="relative flex flex-col items-center gap-1">
        <p
          className={cn(
            'font-mono text-4xl font-black leading-none tabular-nums tracking-tight transition-colors duration-300 motion-reduce:transition-none',
            isCompleted && 'text-muted-foreground',
            isPaused && 'text-muted-foreground',
            isIdle && 'text-muted-foreground/50',
            isRunning && !ticked && 'text-foreground',
            ticked && 'text-primary'
          )}
        >
          {isIdle ? '--' : state!.currentBuzzer}
        </p>

        <div className="flex items-center gap-1.5">
          {isRunning && (
            <span aria-hidden className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
          )}
          <p className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
            {label ? (
              <span>{label}</span>
            ) : (
              <>
                <span className="opacity-50">/ </span>
                {state!.totalBuzzers}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Remaining time bar */}
      {showBar && (
        <div className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-border">
          <div
            className={cn(
              'h-full rounded-full bg-primary ease-linear motion-reduce:transition-none',
              isPaused
                ? 'transition-none bg-muted-foreground/40'
                : 'transition-[width] duration-1000'
            )}
            style={{ width: `${remainingPct}%` }}
          />
        </div>
      )}
    </div>
  );
}