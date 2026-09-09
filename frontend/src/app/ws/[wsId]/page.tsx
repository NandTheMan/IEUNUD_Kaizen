'use client';

import { BuzzerTracker } from '@/components/buzzer-tracker';
import { GlobalStatusBar } from '@/components/global-status-bar';
import { MaterialCard } from '@/components/material-card';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { useSession } from '@/components/session-provider';
import { useSocket } from '@/components/socket-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  gambar_utama_url?: string | null;
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

function getMaterialGridClass(count: number) {
  if (count <= 1) return 'grid-cols-1 grid-rows-1';
  if (count === 2) return 'grid-cols-2 grid-rows-1';
  if (count === 3) return 'grid-cols-3 grid-rows-1';
  if (count === 4) return 'grid-cols-2 grid-rows-2';
  if (count <= 6) return 'grid-cols-3 grid-rows-2';
  if (count <= 8) return 'grid-cols-4 grid-rows-2';
  return 'grid-cols-3 grid-rows-3';
}

export default function WorkstationPage() {
  const { activeSessionId, isLoadingSession } = useSession();
  const router = useRouter();
  const params = useParams();
  const wsId = params.wsId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [pullSignalCount, setPullSignalCount] = useState(0);

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

  const fetchWorkstationState = useCallback(async () => {
  if (!activeSessionId || !wsId) return;
  try {
    const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/workstations/${wsId}/status`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();

      if (data.status === 'WIP') {
        setNotification(null);
        setWsState({
          action: 'NEXT',
          kode_produk: data.kode_produk,
          nama_produk: data.nama_produk,
          langkah_sekarang: data.langkah_sekarang,
          total_langkah: data.total_langkah,
          deskripsi_tugas: data.deskripsi_tugas,
          standard_time_detik: data.waktu_standar_detik,
          gambar_utama_url: data.gambar_utama_url,
          bom: data.bom ?? [],
          message: data.message ?? '',
        });
      } else {
      setWsState(null);
    }
  } catch (err) {
    console.error(`Failed to fetch workstation state for ${wsId}:`, err);
  }
}, [activeSessionId, wsId, apiUrl]);

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

  const fetchPullSignalStatus = useCallback(async () => {
    if (!activeSessionId || !wsId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/workstations/${wsId}/pull-signal-status`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setPullSignalCount(data.count);
    } catch (err) {
      console.error(`Failed to fetch pull signal status for ${wsId}:`, err);
    }
  }, [activeSessionId, wsId, apiUrl]);

  // Initial data fetching on session / socket connect
  useEffect(() => {
    if (activeSessionId && socket) {
      fetchBoardData();
      fetchStock();
      fetchWorkstationState();
      fetchPullSignalStatus();
    }
  }, [activeSessionId, socket, fetchBoardData, fetchStock, fetchWorkstationState, fetchPullSignalStatus]);

  // WebSocket room and real-time event handling
  useEffect(() => {
    if (!socket || !wsId) return;

    socket.emit('join_workstation_room', wsId);
    const handleNotification = (data: { title: string; message: string }) => setNotification(data);
    const handleKanbanUpdate = () => {
      fetchBoardData();
      fetchStock();
      fetchPullSignalStatus();
    };
    const handleStateUpdate = () => {
      setNotification(null); // Dismiss notification when state updates via external input (ESP32)
      fetchWorkstationState();
      fetchPullSignalStatus();
      fetchStock();
    };

    socket.on('WORKSTATION_NOTIFICATION', handleNotification);
    socket.on('kanban_updated', handleKanbanUpdate);
    socket.on('workstation_state_updated', handleStateUpdate);

    return () => {
      socket.emit('leave_workstation_room', wsId);
      socket.off('WORKSTATION_NOTIFICATION', handleNotification);
      socket.off('kanban_updated', handleKanbanUpdate);
      socket.off('workstation_state_updated', handleStateUpdate);
    };
  }, [socket, wsId, fetchBoardData, fetchStock, fetchWorkstationState, fetchPullSignalStatus]);

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

  const idleMessage = pullSignalCount > 0
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
        <div
          onClick={() => setNotification(null)}
          className="absolute inset-0 z-50 flex cursor-pointer items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-w-md cursor-default flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center shadow-2xl"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Bell className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-primary">{notification.title}</h2>
              <p className="text-muted-foreground">{notification.message}</p>
            </div>
            <p className="mt-4 animate-pulse text-lg font-semibold">
              Tekan Spasi atau Tombol Fisik untuk Memulai
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setNotification(null)}
            >
              Tutup Notifikasi
            </Button>
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
            <div className="flex-1 overflow-y-auto p-4">
              {isIdle ? (
                <p className="text-xl">{idleMessage}</p>
              ) : (
                <ul className="space-y-2 text-xl leading-relaxed">
                  {(wsState.deskripsi_tugas ?? '')
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1 text-primary">•</span>
                        <span>{line.replace(/^-\s*/, '')}</span>
                      </li>
                    ))}
                </ul>
              )}
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
          <FramePanel className="relative flex items-center justify-center bg-muted/30">
            {isIdle || !wsState.gambar_utama_url ? (
              <span className="italic text-muted-foreground">Tidak ada gambar tersedia</span>
            ) : (
              <img
                src={wsState.gambar_utama_url}
                alt={`Instruksi untuk ${wsState.nama_produk}`}
                className="h-full w-full object-contain"
              />
            )}
          </FramePanel>
        </Frame>
      </div>

      {/* Bottom Row */}
      <div className="flex h-1/3 min-h-[320px] gap-4">
        <Frame stacked className="flex w-1/3 min-h-0 flex-col">
          <FrameHeader className="shrink-0"><FrameTitle>Bahan Saat Ini</FrameTitle></FrameHeader>
          <FramePanel className="flex flex-1 min-h-0 flex-col overflow-hidden p-2">
            {!stock ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat stok...
              </div>
            ) : stock.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                Tidak ada bahan yang dialokasikan untuk stasiun ini.
              </div>
            ) : (
              <div className={cn('grid h-full w-full gap-2 min-h-0', getMaterialGridClass(stock.length))}>
                {stock.map((item) => (
                  <MaterialCard key={item.id_bahan} nama={item.nama_bahan} stok={item.stok_sekarang} gambarUrl={item.gambar_url} fit="fill" className="h-full" />
                ))}
              </div>
            )}
          </FramePanel>
        </Frame>
        <Frame stacked className="flex w-1/3 min-h-0 flex-col">
          <FrameHeader className="shrink-0"><FrameTitle>Status Buzzer</FrameTitle></FrameHeader>
          <FramePanel className="flex flex-1 min-h-0 flex-col overflow-hidden p-2">
            <BuzzerTracker/>
            {/* {isIdle || !wsState.bom || wsState.bom.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Tidak ada bahan untuk langkah ini.
              </div>
            ) : (
              <div className={cn('grid h-full w-full gap-2 min-h-0', getMaterialGridClass(wsState.bom.length))}>
                {wsState.bom.map((item) => (
                  <MaterialCard key={item.id_bahan} nama={`${item.qty_dibutuhkan}x ${item.nama_bahan}`} gambarUrl={item.gambar_url} fit="fill" className="h-full" />
                ))}
              </div>
            )} */}
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