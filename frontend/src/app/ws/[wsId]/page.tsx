'use client';

import { GlobalStatusBar } from '@/components/global-status-bar';
import { MaterialCard } from '@/components/material-card';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { useSession } from '@/components/session-provider';
import { useSocket } from '@/components/socket-provider';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bell, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface WorkstationState {
  action: 'START' | 'NEXT' | 'STOP';
  kode_produk?: string;
  nama_produk?: string; // For notes
  langkah_sekarang?: number;
  total_langkah?: number;
  deskripsi_tugas?: string;
  standard_time_detik?: number;
  bom?: {
    id_bahan: number;
    nama_bahan: string;
    qty_dibutuhkan: number;
    gambar_url?: string | null;
  }[];
  message: string;
}

interface WorkstationInfo {
  id: string;
  nama_ws: string;
  tipe: string;
}

export default function WorkstationPage() {
  const { activeSessionId, isLoadingSession } = useSession();
  const router = useRouter();
  const params = useParams();
  const wsId = params.wsId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WorkstationState | null>(null);
  const [boardData, setBoardData] = useState<any>(null);
  const [stock, setStock] = useState<{ id_bahan: number; nama_bahan: string; gambar_url?: string | null; stok_sekarang: number }[] | null>(null);
  const currentWs = useMemo(() => boardData?.workstations?.find((ws: WorkstationInfo) => ws.id === wsId), [boardData, wsId]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const { socket } = useSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!isLoadingSession && !activeSessionId) {
      router.push('/');
    }
  }, [activeSessionId, isLoadingSession, router]);

  const fetchBoardData = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/kanban-board`, { cache: 'no-store' });
      if (res.ok) setBoardData(await res.json());
    } catch (err) {
      console.error('Failed to fetch board data:', err);
    }
  }, [activeSessionId, apiUrl]);

  const fetchStock = useCallback(async () => {
    if (!activeSessionId || !wsId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/workstations/${wsId}/stock`);
      if (res.ok) {
        setStock(await res.json());
      }
    } catch (err) {
      console.error(`Failed to fetch stock for ${wsId}:`, err);
    }
  }, [activeSessionId, wsId, apiUrl]);

  useEffect(() => {
    if (activeSessionId && socket) {
      fetchBoardData();
      fetchStock();
    }
  }, [activeSessionId, socket, fetchBoardData, fetchStock]);

  // WebSocket room and notification handling
  useEffect(() => {
  if (!socket || !wsId) return;

  socket.emit('join_workstation_room', wsId);
  const handleNotification = (data: { title: string; message: string }) => {
    setNotification(data);
  };
  const handleKanbanUpdate = () => {
    fetchBoardData();
    fetchStock();
  };
  const handleStateUpdated = () => {
    window.location.reload();
  };

  socket.on('WORKSTATION_NOTIFICATION', handleNotification);
  socket.on('kanban_updated', handleKanbanUpdate);
  socket.on('workstation_state_updated', handleStateUpdated); // 👈 added

  return () => {
    socket.emit('leave_workstation_room', wsId);
    socket.off('WORKSTATION_NOTIFICATION', handleNotification);
    socket.off('kanban_updated', handleKanbanUpdate);
    socket.off('workstation_state_updated', handleStateUpdated); // 👈 added
  };
}, [socket, wsId, fetchBoardData, fetchStock]);

  const handleToggle = useCallback(async () => {
    if (!activeSessionId || isLoading) return;
    setIsLoading(true);
    setError(null);
    setNotification(null); // Clear notification on action

    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/workstations/${wsId}/toggle`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan aksi.');
      }

      if (data.action === 'STOP') {
        setWsState(null);
        fetchBoardData(); // Refresh board data to show new stock
      } else {
        setWsState(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, wsId, apiUrl, isLoading, fetchBoardData]);

  const handleAndonCall = useCallback(async () => {
    if (!activeSessionId || isLoading) return;

    // This is now a simple call, no message needed from operator.
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/workstations/${wsId}/report-andon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal memanggil Andon.');
      }
      // Maybe show a local confirmation toast/message here in the future
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, wsId, apiUrl, isLoading]);

  const isIdle = !wsState;

  const handleReportNg = useCallback(async () => {
    if (!activeSessionId || isLoading || isIdle) return;

    // For now, we use a default reason. A modal could be added here later.
    const reason = 'Defect ditemukan oleh operator.';

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/workstations/${wsId}/report-ng`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alasan_ng: reason }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Gagal melaporkan produk NG.');
      }

      // Success! The item is gone. Reset the state to idle.
      setWsState(null);
      fetchBoardData(); // Refresh board data to show the item is gone
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, wsId, apiUrl, isLoading, isIdle, fetchBoardData]);

  // Listen for spacebar to trigger the action
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isLoading) return;
      if (event.code === 'Space') {
        event.preventDefault();
        handleToggle();
      } else if (event.code === 'KeyN' && !isIdle) {
        event.preventDefault();
        handleReportNg();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoading, isIdle, handleToggle, handleReportNg]);

  const idleMessage = notification
    ? 'Otorisasi diterima. Tekan Spasi untuk memulai.'
    : 'Menunggu sinyal tarikan dari stasiun berikutnya...';

  const isHeijunkaEmpty = useMemo(() => {
    if (!boardData || !boardData.heijunkaQueue) return true;
    // Only consider QUEUED items as being in the "antrian"
    return boardData.heijunkaQueue.filter((q: any) => q.status === 'QUEUED').length === 0;
  }, [boardData]);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isIdle) {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isIdle, wsState?.kode_produk]); // Reset on new task

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (isLoadingSession || !activeSessionId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Menghubungkan...</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-1 flex-col gap-4 p-4">
      {/* Notification Overlay */}
      {notification && !isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center shadow-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Bell className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-primary">{notification.title}</h2>
              <p className="text-muted-foreground">{notification.message}</p>
            </div>
            <p className="mt-4 animate-pulse text-lg font-semibold">Tekan Spasi untuk Memulai</p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        <Frame stacked className="flex w-1/2 flex-col">
          <FrameHeader className="flex-row items-start justify-between">
            <div>
              <FrameTitle>Stasiun Kerja: {wsId}</FrameTitle>
              {currentWs && <FrameDescription>{currentWs.nama_ws}</FrameDescription>}
            </div>
            <Button variant="destructive" onClick={handleAndonCall} disabled={isLoading}>
              <Bell className="mr-2 h-4 w-4" /> Panggil Bantuan
            </Button>
          </FrameHeader>
          <FramePanel className="flex flex-1 flex-col p-0">
            <div className="flex-1 overflow-y-auto p-4 text-xl">
              {isIdle ? idleMessage : wsState.deskripsi_tugas}
            </div>
            <div className="mt-auto border-t p-4">
              <h3 className="font-semibold">Catatan</h3>
              {isIdle ? (
                <p className="text-sm text-muted-foreground">Tidak ada pekerjaan aktif.</p>
              ) : (
                <>
                  <p className="font-mono text-sm">
                    Produk: {wsState.nama_produk} ({wsState.kode_produk})
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Tekan <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-sans">N</kbd> untuk melaporkan produk ini sebagai Not Good (NG).</p>
                </>
              )}
            </div>
          </FramePanel>
        </Frame>
        <Frame stacked className="flex w-1/2 flex-col">
          <FrameHeader><FrameTitle>Gambar</FrameTitle></FrameHeader>
          <FramePanel className="flex items-center justify-center">
            <span className="italic text-muted-foreground">Tidak ada gambar tersedia</span>
          </FramePanel>
        </Frame>
      </div>

      {/* Bottom Row */}
      <div className="flex h-1/3 min-h-[320px] gap-4">
        <Frame stacked className="flex w-1/3 flex-col">
          <FrameHeader><FrameTitle>Bahan Saat Ini</FrameTitle></FrameHeader>
          <FramePanel className="overflow-y-auto p-4">
            {!stock ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat stok...
              </div>
            ) : stock.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                Tidak ada bahan yang dialokasikan untuk stasiun ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {stock.map((item) => (
                  <MaterialCard key={item.id_bahan} nama={item.nama_bahan} stok={item.stok_sekarang} gambarUrl={item.gambar_url} />
                ))}
              </div>
            )}
          </FramePanel>
        </Frame>
        <Frame stacked className="flex w-1/3 flex-col">
          <FrameHeader><FrameTitle>Bahan Digunakan</FrameTitle></FrameHeader>
          <FramePanel className="overflow-y-auto p-2">
            {isIdle || !wsState.bom || wsState.bom.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Tidak ada bahan untuk langkah ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {wsState.bom.map((item) => (
                  <MaterialCard key={item.id_bahan} nama={`${item.qty_dibutuhkan}x ${item.nama_bahan}`} gambarUrl={item.gambar_url} />
                ))}
              </div>
            )}
          </FramePanel>
        </Frame>
        <Frame stacked className="flex w-1/3 flex-col">
          <FrameHeader className="flex-row items-center justify-between">
            <FrameTitle>Timer & Waktu</FrameTitle>
            <GlobalStatusBar />
          </FrameHeader>
          <FramePanel className="flex flex-1 flex-col items-center justify-center gap-4">
            {isLoading ? (
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            ) : error ? (
              <div className="text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <p className="mt-2 font-semibold text-destructive">Kesalahan</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : (
              <>
                <div
                  className={`text-6xl font-mono font-bold ${
                    !isIdle && wsState.standard_time_detik && elapsedTime > wsState.standard_time_detik
                      ? 'text-destructive'
                      : 'text-primary'
                  }`}
                >
                  {isIdle ? '00:00' : formatTime(elapsedTime)}
                </div>
                <div className="font-bold text-muted-foreground">
                  Target: {isIdle ? '--' : wsState.standard_time_detik ?? '--'}s
                </div>
              </>
            )}
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}