'use client';

import { GlobalStatusBar } from '@/components/global-status-bar';
import { MaterialCard } from '@/components/material-card';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { useSession } from '@/components/session-provider';
import { useSocket } from '@/components/socket-provider';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2, Truck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Types for data from backend
interface MaterialStock {
  id_bahan: number;
  nama_bahan: string;
  gambar_url?: string | null;
  stok_sekarang: number;
  safety_stock_threshold: number;
}

interface WorkstationStock {
  id: string;
  nama_ws: string;
  materials: MaterialStock[];
}

interface LowStockAlert {
  id: number;
  id_workstation: string;
  id_bahan: number;
  qty_diminta: number;
  waktu_diminta: string;
  bahan: {
    nama_bahan: string;
  };
}

export default function WarehousePage() {
  const { activeSessionId, isLoadingSession } = useSession();
  const { socket } = useSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [stockData, setStockData] = useState<WorkstationStock[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFulfilling, setIsFulfilling] = useState<number | null>(null);

  const fetchStockData = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/warehouse-stock`);
      if (res.ok) setStockData(await res.json());
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
    }
  }, [activeSessionId, apiUrl]);

  const fetchAlerts = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/low-stock-alerts`);
      if (res.ok) setAlerts(await res.json());
    } catch (error) {
      console.error('Failed to fetch low stock alerts:', error);
    }
  }, [activeSessionId, apiUrl]);

  const handleFulfillRequest = useCallback(async (alertId: number) => {
    if (!activeSessionId) return;
    setIsFulfilling(alertId);
    try {
        const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/logistik/${alertId}/fulfill`, {
            method: 'POST',
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Gagal memenuhi permintaan.');
        }
    } catch (error) {
        console.error('Failed to fulfill request:', error);
        // TODO: Show toast on error
    } finally {
        setIsFulfilling(null);
    }
  }, [activeSessionId, apiUrl]);

  useEffect(() => {
    if (activeSessionId && socket) {
      setIsLoading(true);
      Promise.all([fetchStockData(), fetchAlerts()]).finally(() => setIsLoading(false));

      socket.on('kanban_updated', fetchStockData);
      socket.on('logistikUpdate', fetchAlerts);

      return () => {
        socket.off('kanban_updated', fetchStockData);
        socket.off('logistikUpdate', fetchAlerts);
      };
    }
  }, [activeSessionId, socket, fetchStockData, fetchAlerts]);

  if (isLoadingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Memuat Sesi...</span>
      </div>
    );
  }

  if (!activeSessionId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-center">
        <div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Menunggu Sesi Aktif</h2>
          <p className="text-muted-foreground">Halaman gudang akan tampil setelah sesi dimulai oleh PPIC.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <FrameHeader className="shrink-0 flex-row items-start justify-between p-4">
        <div>
          <FrameTitle className="font-mono text-3xl">Dasbor Gudang</FrameTitle>
          <FrameDescription className="text-xl font-light">Tinjauan Stok Material & Peringatan</FrameDescription>
        </div>
        <GlobalStatusBar />
      </FrameHeader>

      <main className="grid flex-1 grid-cols-3 gap-4 overflow-hidden bg-muted/40 p-4">
        {/* Left Section: Stock Swimlanes */}
        <div
          className="col-span-2 grid min-h-0 gap-4"
          style={{ gridTemplateColumns: `repeat(${stockData.length > 0 ? stockData.length : 1}, minmax(0, 1fr))` }}
        >
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center" style={{ gridColumn: `span ${stockData.length || 1}` }}><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            stockData.map(ws => (
              <Frame key={ws.id} stacked className="flex h-full min-h-0 flex-col">
                <FrameHeader><FrameTitle>{ws.nama_ws} ({ws.id})</FrameTitle></FrameHeader>
                <FramePanel className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    {ws.materials.map(mat => (<MaterialCard key={mat.id_bahan} nama={mat.nama_bahan} gambarUrl={mat.gambar_url} stok={mat.stok_sekarang}/>))}
                  </div>
                </FramePanel>
              </Frame>
            ))
          )}
        </div>

        {/* Right Section: Low Stock Alerts */}
        <Frame stacked className="col-span-1 flex h-full min-h-0 flex-col">
          <FrameHeader><FrameTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Peringatan Stok Rendah</FrameTitle><FrameDescription>Material yang berada di bawah ambang batas aman.</FrameDescription></FrameHeader>
          <FramePanel className="flex flex-col gap-3 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : alerts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground"><CheckCircle2 className="h-8 w-8" /><p className="mt-2 font-semibold">Stok Aman</p><p className="text-xs">Tidak ada permintaan pengisian ulang.</p></div>
            ) : (
              alerts.map((alert, index) => {
                const isActionable = index === 0;
                const isBeingFulfilled = isFulfilling === alert.id;

                if (isActionable) {
                  return (
                    <div key={alert.id} className="rounded-lg border-2 border-amber-500 bg-amber-500/10 p-3 shadow-md">
                      <div className="flex items-center justify-between"><p className="font-bold text-amber-600">WS: {alert.id_workstation}</p><p className="text-xs text-muted-foreground">{new Date(alert.waktu_diminta).toLocaleTimeString()}</p></div>
                      <p className="mt-1 text-sm font-semibold">{alert.bahan.nama_bahan}</p>
                      <p className="font-mono text-xs text-muted-foreground">Qty Diminta: {alert.qty_diminta}</p>
                      <Button className="mt-3 w-full" size="sm" onClick={() => handleFulfillRequest(alert.id)} disabled={isBeingFulfilled}>
                        {isBeingFulfilled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                        Kirim Material
                      </Button>
                    </div>
                  );
                }
                return (<div key={alert.id} className="rounded-lg border border-gray-500/20 bg-gray-500/10 p-3 opacity-60"><div className="flex items-center justify-between"><p className="font-bold text-gray-400">WS: {alert.id_workstation}</p><p className="text-xs text-muted-foreground">{new Date(alert.waktu_diminta).toLocaleTimeString()}</p></div><p className="mt-1 text-sm font-semibold">{alert.bahan.nama_bahan}</p><p className="font-mono text-xs text-muted-foreground">Qty Diminta: {alert.qty_diminta}</p></div>);
              })
            )}
          </FramePanel>
        </Frame>
      </main>
    </div>
  );
}