'use client';

import { useSocket } from '@/components/socket-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    PackageCheck,
    PartyPopper,
    AlertTriangle,
    Clock,
    Truck,
    Download,
    Target,
    Maximize2,
    Minimize2,
    Gauge,
    ListChecks,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductionResult {
  id_produk: number;
  nama_produk: string;
  target_qty: number;
  qty_shipped: number;
  qty_wip: number;
  qty_ng: number;
}

interface WorkstationMetric {
  id_workstation: string;
  nama_ws: string;
  total_andon: number;
  total_logistik: number;
}

interface SessionSummary {
  sessionId: number;
  duration_minutes: number;
  production_results: ProductionResult[];
  workstation_metrics: WorkstationMetric[];
  total_andon_alerts: number;
  total_logistics_requests: number;
}

interface WorkstationOEE {
  id_workstation: string;
  nama_ws: string;
  is_pacemaker: boolean;
  downtime_sec: number;
  run_time_sec: number;
  total_count: number;
  good_count: number;
  ng_count: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

interface OEEMetrics {
  sessionId: number;
  planned_time_sec: number;
  pacemaker_workstation: string | null;
  line_oee: { availability: number; performance: number; quality: number; oee: number } | null;
  oee_per_workstation: WorkstationOEE[];
}

interface CycleLogEntry {
  id: number;
  id_workstation: string;
  nama_ws: string;
  kode_produk: string;
  nama_produk: string;
  waktu_mulai: string;
  waktu_selesai: string;
  actual_sec: number;
  standard_sec: number | null;
  variance_sec: number | null;
}

// Standard OEE convention: 85%+ world-class, 60-85% typical, <60% needs attention
function oeeBand(value: number) {
  if (value >= 0.85) return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950', ring: 'ring-emerald-200 dark:ring-emerald-900' };
  if (value >= 0.6) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950', ring: 'ring-amber-200 dark:ring-amber-900' };
  return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950', ring: 'ring-red-200 dark:ring-red-900' };
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Summary() {
  const { socket } = useSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [finishedSessionId, setFinishedSessionId] = useState<number | null>(null);
  const [summaryData, setSummaryData] = useState<SessionSummary | null>(null);
  const [oeeData, setOeeData] = useState<OEEMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const fetchSummary = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    try {
      const [summaryRes, oeeRes] = await Promise.all([
        fetch(`${apiUrl}/sessions/${sessionId}/summary`),
        fetch(`${apiUrl}/sessions/${sessionId}/oee`),
      ]);

      if (summaryRes.ok) {
        setSummaryData(await summaryRes.json());
      } else {
        console.error('Failed to fetch session summary');
      }

      if (oeeRes.ok) {
        setOeeData(await oeeRes.json());
      } else {
        console.error('Failed to fetch OEE metrics');
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
      setFinishedSessionId(sessionId);
      fetchSummary(sessionId);
    };

    socket.on('session_finished', handleSessionFinish);

    return () => {
      socket.off('session_finished', handleSessionFinish);
    };
  }, [socket, fetchSummary]);

  const resetAndClose = () => {
    setFinishedSessionId(null);
    setSummaryData(null);
    setOeeData(null);
    setIsFullscreen(false);
    setShowCloseConfirm(false);
  };

  // Intercept every close attempt (backdrop click, Esc, etc.) and route through confirmation
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowCloseConfirm(true);
    }
  };

  const handleDownloadExcel = () => {
    window.open(`${apiUrl}/sessions/${finishedSessionId}/export`, '_blank');
  };

  const isOpen = finishedSessionId !== null;
  const pacemakerWs = oeeData?.oee_per_workstation.find(w => w.is_pacemaker);
  const [showCycleLog, setShowCycleLog] = useState(false);
  const [cycleLog, setCycleLog] = useState<CycleLogEntry[] | null>(null);
  const [isLoadingCycles, setIsLoadingCycles] = useState(false);

  const toggleCycleLog = async () => {
    if (!showCycleLog && cycleLog === null && finishedSessionId) {
      setIsLoadingCycles(true);
      try {
        const res = await fetch(`${apiUrl}/sessions/${finishedSessionId}/cycles`);
        if (res.ok) setCycleLog(await res.json());
      } catch (error) {
        console.error('Error fetching cycle log:', error);
      } finally {
        setIsLoadingCycles(false);
      }
    }
    setShowCycleLog(s => !s);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            'flex flex-col overflow-hidden transition-all duration-200',
            isFullscreen
              ? 'w-screen h-screen min-w-screen max-h-none rounded-none'
              : 'min-w-6xl max-h-[90vh]'
          )}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center justify-between text-2xl gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <PartyPopper className="h-8 w-8 text-primary shrink-0" />
                <span className="truncate">Ringkasan Sesi Praktikum #{finishedSessionId}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 pr-10">
                {summaryData && (
                  <Button onClick={handleDownloadExcel} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Unduh Laporan (XLS)
                  </Button>
                )}
                <Button
                  onClick={() => setIsFullscreen(f => !f)}
                  variant="outline"
                  size="icon"
                  aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              Simulasi selesai. Berikut adalah rekapan data dan evaluasi OEE dari lini produksi Heijunka.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              </div>
            ) : summaryData ? (
              <div className="grid gap-6 py-4 pr-1">

                {/* LINE OEE SCORECARD */}
                {oeeData?.line_oee ? (
                  <div>
                    <h3 className="mb-3 text-lg font-bold flex items-center gap-2">
                      <Gauge className="h-5 w-5" /> Line OEE
                      {pacemakerWs && (
                        <span className="text-xs font-normal text-muted-foreground">
                          (dari stasiun pacemaker: {pacemakerWs.id_workstation} — {pacemakerWs.nama_ws})
                        </span>
                      )}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      {([
                        ['Availability', oeeData.line_oee.availability],
                        ['Performance', oeeData.line_oee.performance],
                        ['Quality', oeeData.line_oee.quality],
                        ['OEE', oeeData.line_oee.oee],
                      ] as const).map(([label, value]) => {
                        const band = oeeBand(value);
                        return (
                          <div key={label} className={cn('rounded-xl p-4 ring-1', band.bg, band.ring)}>
                            <p className={cn('text-xs font-bold uppercase', band.text)}>{label}</p>
                            <p className={cn('text-3xl font-black mt-1', band.text)}>{pct(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Tidak ada stasiun pacemaker yang diset untuk skenario ini, jadi Line OEE tidak dapat dihitung.
                      Lihat rincian OEE per-stasiun di bawah.
                    </p>
                  </div>
                )}

                {/* KPI STAT CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
                    <Clock className="mx-auto mb-2 h-6 w-6 text-slate-500" />
                    <p className="text-xs font-bold text-slate-500">TOTAL DURASI</p>
                    <p className="text-2xl font-black">{summaryData.duration_minutes} <span className="text-sm font-normal">mnt</span></p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950">
                    <PackageCheck className="mx-auto mb-2 h-6 w-6 text-blue-500" />
                    <p className="text-xs font-bold text-blue-500">TOTAL SHIPPED</p>
                    <p className="text-2xl font-black">
                      {summaryData.production_results.reduce((acc, curr) => acc + curr.qty_shipped, 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950">
                    <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-500" />
                    <p className="text-xs font-bold text-red-500">GANGGUAN ANDON</p>
                    <p className="text-2xl font-black">{summaryData.total_andon_alerts}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950">
                    <Truck className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                    <p className="text-xs font-bold text-amber-500">REQUEST LOGISTIK</p>
                    <p className="text-2xl font-black">{summaryData.total_logistics_requests}</p>
                  </div>
                </div>

                {/* PRODUCT METRICS TABLE */}
                <div>
                  <h3 className="mb-3 text-lg font-bold flex items-center gap-2">
                    <Target className="h-5 w-5" /> Pencapaian Target Produk
                  </h3>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[600px]">
                      <thead className="bg-muted text-muted-foreground uppercase text-xs font-bold">
                        <tr>
                          <th className="px-4 py-3">Produk</th>
                          <th className="px-4 py-3 text-center">Target</th>
                          <th className="px-4 py-3 text-center text-green-600">Shipped</th>
                          <th className="px-4 py-3 text-center text-amber-600">WIP (Lantai)</th>
                          <th className="px-4 py-3 text-center text-red-600">Defect (NG)</th>
                          <th className="px-4 py-3 text-center">Capaian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {summaryData.production_results.length > 0 ? (
                          summaryData.production_results.map(result => {
                            const capaian = result.target_qty > 0 ? result.qty_shipped / result.target_qty : 0;
                            return (
                              <tr key={result.id_produk} className="hover:bg-muted/50 transition-colors">
                                <td className="px-4 py-3 font-semibold">{result.nama_produk}</td>
                                <td className="px-4 py-3 text-center font-medium">{result.target_qty}</td>
                                <td className="px-4 py-3 text-center font-bold text-green-600">{result.qty_shipped}</td>
                                <td className="px-4 py-3 text-center font-medium text-amber-600">{result.qty_wip}</td>
                                <td className="px-4 py-3 text-center font-bold text-red-600">{result.qty_ng}</td>
                                <td className="px-4 py-3 text-center font-semibold">{pct(capaian)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Tidak ada data produksi.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* WORKSTATION OEE TABLE */}
                {oeeData && oeeData.oee_per_workstation.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-lg font-bold flex items-center gap-2">
                      <Gauge className="h-5 w-5" /> OEE per Stasiun Kerja
                    </h3>
                    <div className="rounded-md border overflow-x-auto">
                      <table className="w-full text-sm text-left min-w-[720px]">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-bold">
                          <tr>
                            <th className="px-4 py-3">Stasiun</th>
                            <th className="px-4 py-3 text-center">Unit (Baik/NG)</th>
                            <th className="px-4 py-3 text-center">Downtime</th>
                            <th className="px-4 py-3 text-center">Avail.</th>
                            <th className="px-4 py-3 text-center">Perf.</th>
                            <th className="px-4 py-3 text-center">Qual.</th>
                            <th className="px-4 py-3 text-center">OEE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {oeeData.oee_per_workstation.map(ws => {
                            const band = oeeBand(ws.oee);
                            return (
                              <tr key={ws.id_workstation} className="hover:bg-muted/50 transition-colors">
                                <td className="px-4 py-3 font-semibold">
                                  {ws.is_pacemaker && <span title="Pacemaker">★ </span>}
                                  {ws.nama_ws}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-green-600 font-medium">{ws.good_count}</span>
                                  {' / '}
                                  <span className="text-red-600 font-medium">{ws.ng_count}</span>
                                </td>
                                <td className="px-4 py-3 text-center">{ws.downtime_sec}s</td>
                                <td className="px-4 py-3 text-center">{pct(ws.availability)}</td>
                                <td className="px-4 py-3 text-center">{pct(ws.performance)}</td>
                                <td className="px-4 py-3 text-center">{pct(ws.quality)}</td>
                                <td className={cn('px-4 py-3 text-center font-bold', band.text)}>{pct(ws.oee)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* WORKSTATION HEALTH CARDS */}
                <div>
                  <h3 className="mb-3 text-lg font-bold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Kesehatan Stasiun Kerja
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {summaryData.workstation_metrics && summaryData.workstation_metrics.map(ws => (
                      <div key={ws.id_workstation} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="min-w-0">
                          <p className="font-bold truncate">{ws.id_workstation}</p>
                          <p className="text-sm text-muted-foreground truncate">{ws.nama_ws}</p>
                        </div>
                        <div className="flex gap-4 text-sm shrink-0">
                          <div className="text-center">
                            <p className="font-bold text-red-500">{ws.total_andon}</p>
                            <p className="text-[10px] uppercase text-muted-foreground">Andon</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-amber-500">{ws.total_logistik}</p>
                            <p className="text-[10px] uppercase text-muted-foreground">Logistik</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CYCLE LOG DETAIL (lazy loaded) */}
                <div>
                  <Button variant="outline" size="sm" onClick={toggleCycleLog} className="gap-2">
                    <ListChecks className="h-4 w-4" />
                    {showCycleLog ? 'Sembunyikan' : 'Lihat'} Log Siklus Detail
                  </Button>

                  {showCycleLog && (
                    <div className="mt-3 rounded-md border overflow-x-auto max-h-80 overflow-y-auto">
                      {isLoadingCycles ? (
                        <div className="flex h-32 items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <table className="w-full text-sm text-left min-w-[800px]">
                          <thead className="bg-muted text-muted-foreground uppercase text-xs font-bold sticky top-0">
                            <tr>
                              <th className="px-4 py-3">Stasiun</th>
                              <th className="px-4 py-3">Produk</th>
                              <th className="px-4 py-3 text-center">Mulai</th>
                              <th className="px-4 py-3 text-center">Selesai</th>
                              <th className="px-4 py-3 text-center">Aktual</th>
                              <th className="px-4 py-3 text-center">Standar</th>
                              <th className="px-4 py-3 text-center">Selisih</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {cycleLog && cycleLog.length > 0 ? cycleLog.map(c => {
                              const over = c.variance_sec != null && c.variance_sec > 0;
                              const hasStd = c.standard_sec != null;
                              return (
                                <tr key={c.id} className="hover:bg-muted/50">
                                  <td className="px-4 py-3 font-medium">{c.nama_ws}</td>
                                  <td className="px-4 py-3">{c.nama_produk}</td>
                                  <td className="px-4 py-3 text-center font-mono text-xs">
                                    {new Date(c.waktu_mulai).toLocaleTimeString('id-ID')}
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono text-xs">
                                    {new Date(c.waktu_selesai).toLocaleTimeString('id-ID')}
                                  </td>
                                  <td className="px-4 py-3 text-center">{c.actual_sec}s</td>
                                  <td className="px-4 py-3 text-center">{hasStd ? `${c.standard_sec}s` : '—'}</td>
                                  <td className={cn(
                                    'px-4 py-3 text-center font-bold',
                                    !hasStd ? 'text-muted-foreground' : over ? 'text-red-600' : 'text-green-600'
                                  )}>
                                    {hasStd ? `${c.variance_sec! > 0 ? '+' : ''}${c.variance_sec}s` : '—'}
                                  </td>
                                </tr>
                              );
                            }) : (
                              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Tidak ada data siklus.</td></tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <p>Gagal memuat ringkasan. Periksa koneksi backend.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tutup ringkasan sesi?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menutup ringkasan sesi #{finishedSessionId}. Anda tetap dapat mengunduh
              laporan XLS-nya nanti, tapi tampilan ini tidak akan terbuka otomatis lagi kecuali
              sesi baru selesai.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={resetAndClose}>Ya, Tutup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}