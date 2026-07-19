'use client';

import { useSocket } from '@/components/socket-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, PackageCheck, PackageX, PartyPopper } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Data structure for the summary API response
interface ProductionResult {
  id_produk: number;
  nama_produk: string;
  qty_shipped: number;
  qty_ng: number;
}

interface SessionSummary {
  sessionId: number;
  duration_minutes: number;
  production_results: ProductionResult[];
  total_andon_alerts: number;
  total_logistics_requests: number;
}

export default function Summary() {
  const { socket } = useSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [finishedSessionId, setFinishedSessionId] = useState<number | null>(null);
  const [summaryData, setSummaryData] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/sessions/${sessionId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      } else {
        console.error('Failed to fetch session summary');
      }
    } catch (error) {
      console.error('Error fetching session summary:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!socket) return;

    const handleSessionFinish = ({ sessionId }: { sessionId: number }) => {
      console.log(`Summary: Session ${sessionId} has finished. Fetching summary...`);
      setFinishedSessionId(sessionId);
      fetchSummary(sessionId);
    };

    socket.on('session_finished', handleSessionFinish);

    return () => {
      socket.off('session_finished', handleSessionFinish);
    };
  }, [socket, fetchSummary]);

  const handleClose = () => {
    setFinishedSessionId(null);
    setSummaryData(null);
  };

  const isOpen = finishedSessionId !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <PartyPopper className="h-8 w-8 text-primary" />
            Ringkasan Sesi #{finishedSessionId}
          </DialogTitle>
          <DialogDescription>
            Sesi telah selesai. Berikut adalah hasil akhir dari lini produksi.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : summaryData ? (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-center">
                <div className="rounded-lg bg-muted p-3"><p className="text-xs font-semibold text-muted-foreground">DURASI</p><p className="text-2xl font-bold">{summaryData.duration_minutes} <span className="text-base font-normal">menit</span></p></div>
                <div className="rounded-lg bg-muted p-3"><p className="text-xs font-semibold text-muted-foreground">PANGGILAN ANDON</p><p className="text-2xl font-bold">{summaryData.total_andon_alerts}</p></div>
            </div>
            <div className="mt-2"><h3 className="mb-2 font-semibold">Hasil Produksi</h3><div className="space-y-2 rounded-md border p-3">{summaryData.production_results.length > 0 ? summaryData.production_results.map(result => (<div key={result.id_produk} className="flex items-center justify-between"><p className="font-medium">{result.nama_produk}</p><div className="flex items-center gap-4"><div className="flex items-center gap-1.5 text-sm text-green-600"><PackageCheck className="h-4 w-4" /><span className="font-bold">{result.qty_shipped}</span></div><div className="flex items-center gap-1.5 text-sm text-red-600"><PackageX className="h-4 w-4" /><span className="font-bold">{result.qty_ng}</span></div></div></div>)) : (<p className="text-center text-sm text-muted-foreground">Tidak ada produk yang diselesaikan.</p>)}</div></div>
          </div>
        ) : (
            <div className="flex h-48 items-center justify-center text-muted-foreground"><p>Gagal memuat ringkasan.</p></div>
        )}
      </DialogContent>
    </Dialog>
  );
}