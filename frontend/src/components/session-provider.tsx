'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface SessionContextType {
  activeSessionId: number | null;
  isLoadingSession: boolean;
  setActiveSessionId: (id: number | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function checkActiveSession() {
      try {
        console.log('SessionProvider: Checking for active session...');
        const res = await fetch(`${apiUrl}/sessions/active`, { cache: 'no-store' });
        if (res.ok) {
          const session = await res.json();
          if (session && typeof session.id === 'number') {
            console.log(`SessionProvider: Active session found with ID: ${session.id}`);
            setActiveSessionId(session.id);
          } else {
            console.warn('SessionProvider: Received OK status but session data is invalid.', session);
          }
        } else {
          console.log(`SessionProvider: No active session found (status: ${res.status}).`);
        }
      } catch (error) {
        console.error('SessionProvider: Network error while checking for active session.', error);
      } finally {
        setIsLoadingSession(false);
      }
    }
    checkActiveSession();
  }, [apiUrl]);

  const value = { activeSessionId, isLoadingSession, setActiveSessionId };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) throw new Error('useSession must be used within a SessionProvider');
  return context;
}