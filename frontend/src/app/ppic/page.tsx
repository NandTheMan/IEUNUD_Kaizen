'use client';

import { HeijunkaQueueItem, HeijunkaQueueList, ProductionKanban } from '@/components/examples/c-kanban-5';
import { GlobalStatusBar } from '@/components/global-status-bar';
import { OrderingPanel } from '@/components/ordering-panel';
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame';
import { SessionInitializer } from '@/components/session-initializer';
import { useSession } from '@/components/session-provider';
import { useSocket } from '@/components/socket-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, LogOut, Package } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function PpicPage() {
  const { activeSessionId, isLoadingSession, setActiveSessionId } = useSession();
  const [isStopping, setIsStopping] = useState(false);
  const [boardData, setBoardData] = useState<any>(null);
  const [isHeijunkaOpen, setIsHeijunkaOpen] = useState(false);
  const { socket } = useSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const heijunkaQueue = useMemo(() => {
    const allQueue = boardData?.heijunkaQueue ?? [];
    return allQueue
      .filter((q: HeijunkaQueueItem) => q.status === 'QUEUED' || q.status === 'RELEASED')
      .sort((a: HeijunkaQueueItem, b: HeijunkaQueueItem) => a.sequence - b.sequence);
  }, [boardData]);

  const fetchBoardData = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/kanban-board`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setBoardData(data);
      }
    } catch (error) {
      console.error('Failed to fetch kanban board state:', error);
    }
  }, [activeSessionId, apiUrl]);

  useEffect(() => {
    if (!activeSessionId || !socket) {
      setBoardData(null); // Clear board data if session ends
      return;
    }
    fetchBoardData();
    socket.on('kanban_updated', fetchBoardData);
    return () => {
      socket.off('kanban_updated', fetchBoardData);
    };
  }, [activeSessionId, fetchBoardData, socket]);

  const handleStopSession = useCallback(async () => {
    if (!activeSessionId) return;
    setIsStopping(true);
    try {
      const res = await fetch(`${apiUrl}/sessions/stop`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Gagal menghentikan sesi.');
      }
      setActiveSessionId(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsStopping(false);
    }
  }, [activeSessionId, apiUrl, setActiveSessionId]);

  if (isLoadingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Memuat Sesi...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <FrameHeader className="shrink-0 flex-row items-start justify-between p-4">
        <div>
          <FrameTitle className="font-mono text-3xl">PPIC Dashboard</FrameTitle>
          <FrameDescription className="text-xl font-light">
            Production Planning & Inventory Control
          </FrameDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3" onClick={() => setIsHeijunkaOpen(true)}>
            <Package className="h-3.5 w-3.5" /> Lihat Antrian
          </Button>
          <GlobalStatusBar />
          {activeSessionId && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 gap-1.5 px-3"
              onClick={handleStopSession}
              disabled={isStopping}
            >
              {isStopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Akhiri Sesi
            </Button>
          )}
        </div>
      </FrameHeader>
      <main className="grid flex-1 grid-cols-3 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden bg-muted/40 p-4">
        {/* Kanban Section */}
        <Frame stacked className="col-span-2 flex h-full min-h-0 flex-col">
          <FrameHeader>
            <FrameTitle>Papan Kanban Live</FrameTitle>
            <FrameDescription>Tampilan real-time dari lini produksi.</FrameDescription>
          </FrameHeader>
          <FramePanel className="min-h-0 flex-1 overflow-hidden">
            {boardData ? (
              <ProductionKanban
                workstations={boardData.workstations}
                items={boardData.items}
                className="h-full"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                {activeSessionId ? <Loader2 className="h-8 w-8 animate-spin" /> : 'Tidak ada sesi aktif.'}
              </div>
            )}
          </FramePanel>
        </Frame>

        {/* Actions Section */}
        <div className="col-span-1 flex flex-col items-center justify-center gap-4">
          {!activeSessionId ? (
            <SessionInitializer onSessionStart={setActiveSessionId} />
          ) : (
            <OrderingPanel sessionId={activeSessionId} className="h-full w-full" />
          )}
        </div>
      </main>

      {/* Heijunka Dialog */}
      <Dialog open={isHeijunkaOpen} onOpenChange={setIsHeijunkaOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Antrian Heijunka</DialogTitle>
            <DialogDescription>
              Semua pesanan produksi yang tertunda, diurutkan berdasarkan prioritas.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto p-4">
            <HeijunkaQueueList queue={heijunkaQueue} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}