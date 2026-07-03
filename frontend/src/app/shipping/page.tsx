'use client';

import { HeijunkaQueueItem, HeijunkaQueueList, ProductionItem } from '@/components/examples/c-kanban-5';
import { Badge } from '@/components/reui/badge';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { useSession } from '@/components/session-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    Package,
    PackageCheck,
    Ship,
    Target
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

function DraggableGoodCard({ item }: { item: ProductionItem }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: item,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="touch-none cursor-grab rounded-lg border bg-card p-3 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{item.nama_produk}</span>
        <Badge variant="secondary" size="sm">
          Ready
        </Badge>
      </div>
      <p className="font-mono text-xs text-muted-foreground">{item.kode_produk}</p>
    </div>
  );
}

function DroppableOrderSlot({ order }: { order: HeijunkaQueueItem }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'shipping-drop-zone',
    data: order,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 p-4 transition-all ${
        isOver ? 'border-primary bg-primary/10' : 'border-dashed border-primary'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-primary">Next Order to Ship</h3>
        </div>
        <Badge variant="default" size="lg" className="font-mono">
          #{order.sequence}
        </Badge>
      </div>
      <div className="mt-2">
        <p className="text-xl font-bold">{order.nama_produk}</p>
        <p className="font-mono text-muted-foreground">{order.kode_produk}</p>
      </div>
    </div>
  );
}

export default function ShippingPage() {
  const { activeSessionId, isLoadingSession } = useSession();
  const router = useRouter();
  const [boardData, setBoardData] = useState<any>(null);
  const [activeItem, setActiveItem] = useState<ProductionItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchBoardData = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/kanban-board`, {
        cache: 'no-store',
      });
      if (res.ok) setBoardData(await res.json());

    //   console.log(boardData.heijunkaQueue)
    } catch (err) {
      console.error('Failed to fetch board data:', err);
    }
  }, [activeSessionId, apiUrl]);

  useEffect(() => {
    if (!isLoadingSession && !activeSessionId) router.push('/');
    if (activeSessionId) {
      fetchBoardData();
      const interval = setInterval(fetchBoardData, 5000);
      return () => clearInterval(interval);
    }
    console.log(activeSessionId)
  }, [activeSessionId, isLoadingSession, router, fetchBoardData]);

  const { heijunkaQueue, finishedGoods } = useMemo(() => {
    const allQueue = boardData?.heijunkaQueue ?? [];
    const shippableQueue: HeijunkaQueueItem[] = allQueue
      .filter((q: HeijunkaQueueItem) => q.status === 'QUEUED' || q.status === 'RELEASED')
      .sort((a: HeijunkaQueueItem, b: HeijunkaQueueItem) => a.sequence - b.sequence);

      console.log("allque:", allQueue)
      console.log("shippable:", shippableQueue)

    // 👇 ADD THE QUESTION MARK BEFORE .filter 👇
    const goods = boardData?.items?.filter(
      (i: ProductionItem) => i.id_workstation === 'WS4' && i.status === 'DONE'
    );
    
    return { heijunkaQueue: shippableQueue, finishedGoods: goods ?? [] };
  }, [boardData]);

  const nextOrderToShip = heijunkaQueue[0] ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current) {
      setActiveItem(active.data.current as ProductionItem);
    }
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveItem(null);
    const { over, active } = event;

    if (!over || over.id !== 'shipping-drop-zone') return;

    const droppedItem = active.data.current as ProductionItem;
    const targetOrder = over.data.current as HeijunkaQueueItem;

    if (droppedItem.id_produk !== targetOrder.id_produk) {
      setError('Product mismatch! Cannot ship this item for this order.');
      setSuccess(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/sessions/${activeSessionId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logSiklusId: droppedItem.id, heijunkaId: targetOrder.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to ship order.');
      setSuccess(result.message);
      fetchBoardData(); // Refresh data immediately
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSessionId, apiUrl, fetchBoardData]);

  if (isLoadingSession || !activeSessionId) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> <span>Connecting...</span>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-4 md:grid-cols-2">
        {/* Top Row: Heijunka Queue */}
        <Frame stacked className="col-span-1 flex flex-col md:col-span-2 min-h-72 max-h-72">
          <FrameHeader>
            <FrameTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Heijunka Queue
            </FrameTitle>
            <FrameDescription>All pending production orders.</FrameDescription>
          </FrameHeader>
          <FramePanel className="overflow-x-auto p-4">
            {!boardData ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : heijunkaQueue.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed text-center text-muted-foreground">
                No pending orders.
              </div>
            ) : (
              <HeijunkaQueueList queue={heijunkaQueue} />
            )}
          </FramePanel>
        </Frame>

        {/* Bottom Left: Shipping Target */}
        <Frame stacked>
          <FrameHeader>
            <FrameTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" /> Shipping Orders
            </FrameTitle>
            <FrameDescription>Drag a finished good to the target order below.</FrameDescription>
          </FrameHeader>
          <FramePanel className="flex flex-col gap-4">
            {nextOrderToShip ? (
              <DroppableOrderSlot order={nextOrderToShip} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed text-center text-muted-foreground">
                No pending orders to ship.
              </div>
            )}
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert variant="success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}
            {isSubmitting && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Processing Shipment...</span></div>}
          </FramePanel>
        </Frame>

        {/* Bottom Right: Finished Goods */}
        <Frame stacked>
          <FrameHeader>
            <FrameTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" /> Finished Goods at WS4
            </FrameTitle>
            <FrameDescription>Products ready for shipping.</FrameDescription>
          </FrameHeader>
          <FramePanel className="flex flex-col gap-3 overflow-y-auto">
            {!boardData ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : finishedGoods.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed text-center text-muted-foreground">
                No finished goods available.
              </div>
            ) : (
              finishedGoods.map((item: ProductionItem) => (
                <DraggableGoodCard key={item.id} item={item} />
              ))
            )}
          </FramePanel>
        </Frame>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="cursor-grabbing rounded-lg border bg-card p-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{activeItem.nama_produk}</span>
              <Badge variant="secondary" size="sm">
                Ready
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{activeItem.kode_produk}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}