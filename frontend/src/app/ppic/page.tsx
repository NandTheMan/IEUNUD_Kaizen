'use client';

import { HeijunkaQueueList, ProductionKanban } from '@/components/examples/c-kanban-5';
import { OrderingPanel } from '@/components/ordering-panel';
import { Badge } from '@/components/reui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { LayersIcon, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function PPIC() {
  const { activeSessionId, isLoadingSession, setActiveSessionId } = useSession();
  const [boardData, setBoardData] = useState<any>(null); // Store real backend data here
  const [isStopping, setIsStopping] = useState(false);
  const { socket } = useSocket();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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

  // 2. Fetch the Kanban data if a session is active
  useEffect(() => {
    if (!activeSessionId || !socket) return;

    fetchBoardData(); // Fetch immediately

    // Listen for real-time updates
    socket.on('kanban_updated', fetchBoardData);

    // Clean up the listener when the component unmounts or dependencies change
    return () => {
      socket.off('kanban_updated', fetchBoardData);
    };
  }, [activeSessionId, fetchBoardData, socket]);

  const handleStopSession = async () => {
    setIsStopping(true);
    try {
      const res = await fetch(`${apiUrl}/sessions/stop`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop the session.');
      setActiveSessionId(null);
      setBoardData(null);
    } catch (error) {
      console.error('Failed to stop session:', error);
    } finally {
      setIsStopping(false);
    }
  };

  if (isLoadingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!activeSessionId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-muted/50">
        <SessionInitializer onSessionStart={setActiveSessionId} />
      </div>
    );
  }

  const queueCount = boardData?.heijunkaQueue?.length ?? 0;

  return (
    <div className="grid flex-1 grid-cols-3 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden p-4">
      {/* Kanban Section */}
      <Frame stacked className="col-span-2 flex h-full min-h-0 flex-col">
        <FrameHeader className="flex shrink-0 flex-row items-center justify-between">
          <div>
            <FrameTitle className="font-mono text-3xl">Halo, PPIC!</FrameTitle>
            <FrameDescription className="text-xl font-light">
              Berikut Jadwal Kita Hari Ini!
            </FrameDescription>
          </div>
          <div className="flex items-center gap-4">
            {boardData && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <LayersIcon className="h-4 w-4" />
                    Lihat Antrian
                    {queueCount > 0 && (
                      <Badge variant="secondary" size="sm">
                        {queueCount}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <LayersIcon className="text-muted-foreground h-5 w-5" />
                      Heijunka Queue
                    </DialogTitle>
                    <DialogDescription>
                      Urutan rilis produksi yang telah diratakan (leveled)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-y-auto pr-1">
                    <HeijunkaQueueList queue={boardData.heijunkaQueue ?? []} />
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Badge variant="outline">Sesi Aktif: {activeSessionId}</Badge>
            <Button variant="destructive" onClick={handleStopSession} disabled={isStopping}>
              {isStopping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isStopping ? 'Menghentikan...' : 'Hentikan Sesi'}
            </Button>
          </div>
        </FrameHeader>
        <FramePanel className="min-h-0 flex-1 overflow-hidden">
          {boardData ? (
            <ProductionKanban
              workstations={boardData.workstations}
              items={boardData.items}
              className="h-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          )}
        </FramePanel>
      </Frame>

      {/* Ordering Section */}
      <OrderingPanel
        sessionId={activeSessionId}
        className="col-span-1"
        onOrderComplete={fetchBoardData} // Instantly refresh kanban when ordered!
      />
      
    </div>
  );
}