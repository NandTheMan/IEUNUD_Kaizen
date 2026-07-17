'use client';

import {
    Frame,
    FrameDescription,
    FrameHeader,
    FramePanel,
    FrameTitle,
} from '@/components/reui/frame';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SkenarioGame {
  id: number;
  nama_skenario: string;
  deskripsi: string | null;
}

interface SessionInitializerProps {
  onSessionStart: (sessionId: number) => void;
}

export function SessionInitializer({ onSessionStart }: SessionInitializerProps) {
  const [scenarios, setScenarios] = useState<SkenarioGame[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [isFetchingScenarios, setIsFetchingScenarios] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function fetchScenarios() {
      setIsFetchingScenarios(true);
      setError(null);
      try {
        const res = await fetch(`${apiUrl}/scenarios`);
        if (!res.ok) throw new Error('Failed to fetch scenarios');
        const data = await res.json();
        setScenarios(data);
      } catch (err) {
        console.error('Failed to fetch scenarios:', err);
        setError(err instanceof Error ? `Kesalahan Jaringan: ${err.message}` : 'Terjadi kesalahan yang tidak diketahui');
      } finally {
        setIsFetchingScenarios(false);
      }
    }
    fetchScenarios();
  }, [apiUrl]);

  const handleStartSession = async () => {
    if (!selectedScenario) {
      setError('Silakan pilih skenario terlebih dahulu.');
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/sessions/prepare-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_skenario: parseInt(selectedScenario, 10) }),
      });
      if (!res.ok) throw new Error('Gagal memulai sesi');
      const newSession = await res.json();
      onSessionStart(newSession.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui');
    } finally {
      setIsStarting(false);
    }
  };

  const selectedDescription = scenarios.find(
    (s) => String(s.id) === selectedScenario
  )?.deskripsi;

  return (
    <Frame stacked className="w-80 shadow-xl">
      <FrameHeader>
        <FrameTitle>Mulai Sesi Game Baru</FrameTitle>
        <FrameDescription>Pilih skenario untuk memulai</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">
        {isFetchingScenarios ? (
          <Skeleton className="h-9 w-full" />
        ) : scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada skenario tersedia. Periksa backend Anda.
          </p>
        ) : (
          <Select onValueChange={setSelectedScenario} value={selectedScenario}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih skenario..." />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nama_skenario}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedDescription && (
          <p className="text-sm text-muted-foreground">{selectedDescription}</p>
        )}

        <Button
          onClick={handleStartSession}
          disabled={isStarting || isFetchingScenarios || !selectedScenario}
        >
          {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isStarting ? 'Memulai...' : 'Mulai Sesi'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </FramePanel>
    </Frame>
  );
}