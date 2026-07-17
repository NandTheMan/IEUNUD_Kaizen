'use client';

import { cn } from '@/lib/utils';
import { CircleDot, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from './session-provider';

function StatusPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1',
        'bg-white/70 dark:bg-white/[0.06]',
        'border border-black/5 dark:border-white/10',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]',
        'backdrop-blur-md',
        'text-xs font-medium tracking-tight text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}

function LiveClockPill() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const time = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <StatusPill>
      <Clock className="h-3 w-3 opacity-70" aria-hidden="true" />
      <span className="font-mono tabular-nums">{time}</span>
    </StatusPill>
  );
}

function ActiveSessionPill({ sessionId }: { sessionId: string }) {
  return (
    <StatusPill>
      <CircleDot className="h-3 w-3 text-emerald-500" aria-hidden="true" />
      <span className="text-foreground/60">Sesi</span>
      <span className="font-mono text-foreground/80">{sessionId}</span>
    </StatusPill>
  );
}

export function GlobalStatusBar() {
  const { activeSessionId } = useSession();

  return (
    <div className="flex items-center gap-2">
      <LiveClockPill />
      {activeSessionId && <ActiveSessionPill sessionId={activeSessionId.toString()} />}
    </div>
  );
}