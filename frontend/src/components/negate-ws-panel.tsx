'use client';

import { MaterialCard } from '@/components/material-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface AndonAlert {
  id: number;
  id_workstation: string;
  jenis_gangguan: string;
}

interface MaterialStock {
  id_bahan: number;
  nama_bahan: string;
  gambar_url?: string | null;
  stok_sekarang: number;
}

interface NegateWsPanelProps {
  sessionId: number;
  alert: AndonAlert | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function NegateWsPanel({ sessionId, alert, isOpen, onClose }: NegateWsPanelProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [materials, setMaterials] = useState<MaterialStock[]>([]);
  const [decrementQtys, setDecrementQtys] = useState<Record<number, number>>({});
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    // Fetch materials for the workstation when the dialog opens with a valid alert
    if (isOpen && alert) {
      const fetchStock = async () => {
        try {
          const res = await fetch(`${apiUrl}/sessions/${sessionId}/workstations/${alert.id_workstation}/stock`);
          if (res.ok) {
            const stockData = await res.json();
            setMaterials(stockData);
          }
        } catch (err) {
          console.error(`Failed to fetch stock for ${alert.id_workstation}:`, err);
        }
      };
      fetchStock();
    } else {
      // Reset state when dialog closes
      setMaterials([]);
      setDecrementQtys({});
    }
  }, [isOpen, alert, sessionId, apiUrl]);

  const changeQty = (materialId: number, delta: number) => {
    setDecrementQtys(prev => {
      const currentQty = prev[materialId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      return { ...prev, [materialId]: newQty };
    });
  };

  const handleResolve = useCallback(async () => {
    if (!sessionId || !alert) return;
    setIsSubmitting(true);
    try {
      // 1. Decrement stock for selected materials
      for (const materialIdStr in decrementQtys) {
        const materialId = parseInt(materialIdStr);
        const jumlah = decrementQtys[materialId];
        if (jumlah > 0) {
          await fetch(`${apiUrl}/sessions/${sessionId}/workstations/${alert.id_workstation}/decrement-stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_bahan: materialId, jumlah }),
          });
        }
      }

      // 2. Resolve the Andon alert
      const resolveRes = await fetch(`${apiUrl}/sessions/${sessionId}/andon-alerts/${alert.id}/resolve`, {
        method: 'POST',
      });
      if (!resolveRes.ok) throw new Error('Gagal menyelesaikan laporan setelah mengurangi stok.');

      toast({
        title: 'Sukses',
        description: `Laporan #${alert.id} dari ${alert.id_workstation} telah ditandai selesai.`,
      });
      onClose();
    } catch (err) {
      toast({ title: 'Kesalahan', description: 'Gagal menyelesaikan laporan.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, alert, apiUrl, toast, onClose, decrementQtys]);

  if (!alert) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atasi Laporan dari {alert.id_workstation}</DialogTitle>
          <DialogDescription>{alert.jenis_gangguan}</DialogDescription>
        </DialogHeader>
        <div className="my-4 max-h-64 overflow-y-auto p-1">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">Kurangi Stok Bahan Cacat:</p>
          <div className="grid grid-cols-2 gap-3">
            {materials.map(material => (
              <div key={material.id_bahan} className="flex flex-col gap-1.5">
                <MaterialCard nama={material.nama_bahan} gambarUrl={material.gambar_url} stok={material.stok_sekarang} />
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => changeQty(material.id_bahan, -1)} disabled={!decrementQtys[material.id_bahan]}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center font-mono text-sm font-bold">{decrementQtys[material.id_bahan] || 0}</span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => changeQty(material.id_bahan, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {materials.length === 0 && (
              <div className="col-span-2 flex h-24 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat bahan...
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" onClick={handleResolve} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tandai Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}