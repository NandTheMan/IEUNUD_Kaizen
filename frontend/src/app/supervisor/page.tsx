'use client';

import { HeijunkaQueueItem, HeijunkaQueueList, ProductionKanban } from '@/components/examples/c-kanban-5';
import { GlobalStatusBar } from '@/components/global-status-bar';
import NegateWsPanel from '@/components/negate-ws-panel';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
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
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, Bell, CheckCircle2, Loader2, Package } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface AndonAlert {
  id: number;
  id_workstation: string;
  jenis_gangguan: string;
  waktu_lapor: string; // Comes as ISO string from backend
}

function AndonAlertsPanel() {
  const { activeSessionId } = useSession();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AndonAlert[]>([]);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AndonAlert | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchAlerts = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/andon-alerts`);
      if (res.ok) {
        setAlerts(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch Andon alerts:', error);
    }
  }, [activeSessionId, apiUrl]);

  useEffect(() => {
    if (activeSessionId && socket) {
      fetchAlerts();
      socket.on('andon_updated', fetchAlerts);
      return () => {
        socket.off('andon_updated', fetchAlerts);
      };
    }
  }, [activeSessionId, socket, fetchAlerts]);

  const openResolveDialog = (alert: AndonAlert) => {
    setSelectedAlert(alert);
    setIsResolveDialogOpen(true);
  };

  return (
    <>
      <Frame stacked className="col-span-1 flex h-full min-h-0 flex-col">
      <FrameHeader>
        <FrameTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Andon Alerts
        </FrameTitle>
        <FrameDescription>Laporan masalah dari lini produksi.</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-3 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8" />
            <p className="mt-2 font-semibold">Semua Lini Aman</p>
            <p className="text-xs">Tidak ada laporan masalah saat ini.</p>
          </div>
        ) : (
          alerts.map((alert, index) => {
            if (index === 0) {
              // Top, highlighted alert
              return (
                <div key={alert.id} className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive">
                        <AlertTriangle className="h-5 w-5 text-destructive-foreground" />
                      </div>
                      <div>
                        <p className="font-bold text-destructive">WS: {alert.id_workstation}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.waktu_lapor).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-lg font-semibold">{alert.jenis_gangguan}</p>
                  <Button className="mt-4 w-full" onClick={() => openResolveDialog(alert)}>Konfirmasi & Atasi</Button>
                </div>
              );
            } else {
              // Subsequent, smaller alerts
              return (
                <div key={alert.id} className="rounded-lg border bg-card p-3" style={{ opacity: 1 - index * 0.25 }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">WS: {alert.id_workstation}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.waktu_lapor).toLocaleTimeString()}
                    </p>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{alert.jenis_gangguan}</p>
                </div>
              );
            }
          })
        )}
      </FramePanel>
      </Frame>
      {activeSessionId && (
        <NegateWsPanel
          sessionId={activeSessionId}
          alert={selectedAlert}
          isOpen={isResolveDialogOpen}
          onClose={() => setIsResolveDialogOpen(false)}
        />
      )}
    </>
  );
}

export default function SupervisorPage() {
  const { activeSessionId, isLoadingSession } = useSession();
  const [boardData, setBoardData] = useState<any>(null);
  const [isHeijunkaOpen, setIsHeijunkaOpen] = useState(false);
  const { socket } = useSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchBoardData = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/kanban-board`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setBoardData(data);
      }
    } catch (error) {
      console.error('Failed to fetch kanban board state:', error);
    }
  }, [activeSessionId, apiUrl]);

  const heijunkaQueue = useMemo(() => {
    const allQueue = boardData?.heijunkaQueue ?? [];
    return allQueue
      .filter((q: HeijunkaQueueItem) => q.status === 'QUEUED' || q.status === 'RELEASED')
      .sort((a: HeijunkaQueueItem, b: HeijunkaQueueItem) => a.sequence - b.sequence);
  }, [boardData]);

  useEffect(() => {
    if (!activeSessionId || !socket) return;
    fetchBoardData();
    socket.on('kanban_updated', fetchBoardData);
    return () => {
      socket.off('kanban_updated', fetchBoardData);
    };
  }, [activeSessionId, fetchBoardData, socket]);

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
      <div className="flex h-screen w-screen items-center justify-center text-center">
        <div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Menunggu Sesi Aktif</h2>
          <p className="text-muted-foreground">Dashboard akan tampil setelah sesi dimulai oleh PPIC.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid flex-1 grid-cols-3 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden p-4">
      {/* Kanban Section */}
      <Frame stacked className="col-span-2 flex h-full min-h-0 flex-col">
        <FrameHeader className="flex-row items-start justify-between">
          <div>
            <FrameTitle className="font-mono text-3xl">Dasbor Supervisor</FrameTitle>
            <FrameDescription className="text-xl font-light">Tinjauan Langsung Lini Produksi</FrameDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3" onClick={() => setIsHeijunkaOpen(true)}>
              <Package className="h-3.5 w-3.5" /> Lihat Antrian
            </Button>
            <GlobalStatusBar />
          </div>
        </FrameHeader>
        <FramePanel className="min-h-0 flex-1 overflow-hidden">
          {boardData ? (
            <ProductionKanban workstations={boardData.workstations} items={boardData.items} className="h-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          )}
        </FramePanel>
      </Frame>

      {/* Andon Alerts Section */}
      <AndonAlertsPanel />

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