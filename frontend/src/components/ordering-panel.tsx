'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/reui/badge';
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ShoppingCartIcon,
} from 'lucide-react';

// ---------- Types ----------

export interface Produk {
  id: number;
  kode_produk: string;
  nama_produk: string;
  image_url?: string | null;
}

interface OrderLineItem extends Produk {
  qty: number;
}

interface OrderingPanelProps {
  sessionId: number;
  className?: string;
  onOrderComplete?: () => void;
}

// ---------- Product thumbnail ----------

function ProductThumbnail({ product }: { product: Produk }) {
  if (product.image_url) {
    return (
      <img
        src={product.image_url}
        alt={product.nama_produk}
        className="border-border/60 h-10 w-10 shrink-0 rounded-md border object-cover"
      />
    );
  }
  return (
    <div className="bg-muted border-border/60 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border">
      <ImageIcon className="text-muted-foreground h-4 w-4" />
    </div>
  );
}

// ---------- Quantity stepper row ----------

function ProductRow({
  product,
  qty,
  onIncrement,
  onDecrement,
}: {
  product: Produk;
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div
      className={cn(
        'border-border/60 flex items-center gap-3 rounded-md border p-2.5 transition-colors',
        qty > 0 && 'border-border bg-muted/40'
      )}
    >
      <ProductThumbnail product={product} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{product.nama_produk}</span>
        <span className="text-muted-foreground font-mono text-xs">{product.kode_produk}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onDecrement}
          disabled={qty === 0}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-6 text-center tabular-nums text-sm font-semibold">{qty}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onIncrement}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------- Root ----------

export function OrderingPanel({
  sessionId,
  className,
  onOrderComplete,
}: OrderingPanelProps) {
  // Data States
  const [products, setProducts] = useState<Produk[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  
  // Order States
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Fetch real products from the backend on load
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`${apiUrl}/products`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        } else {
          throw new Error('Failed to fetch products');
        }
      } catch (err) {
        console.error(err);
        setError('Gagal memuat daftar produk.');
      } finally {
        setIsLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [apiUrl]);

  const increment = (id: number) => {
    setSuccess(false);
    setQuantities((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const decrement = (id: number) => {
    setSuccess(false);
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  };

  const reset = () => {
    setQuantities({});
    setError(null);
    setSuccess(false);
  };

  const selectedItems: OrderLineItem[] = useMemo(
    () => products.map((p) => ({ ...p, qty: quantities[p.id] ?? 0 })).filter((p) => p.qty > 0),
    [products, quantities]
  );

  const totalQty = selectedItems.reduce((sum, item) => sum + item.qty, 0);

  const handleSubmitOrder = async () => {
    if (selectedItems.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiUrl}/sessions/${sessionId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({ id_produk: item.id, target_qty: item.qty })),
        }),
      });
      if (!res.ok) throw new Error('Gagal mengirim pesanan');
      
      setQuantities({});
      setSuccess(true);
      onOrderComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Frame stacked className={cn('flex h-full min-h-0 flex-col', className)}>
      <FrameHeader className="shrink-0">
        <FrameTitle className="flex items-center gap-2">
          <ShoppingCartIcon className="h-4 w-4" />
          Pesan Produksi
        </FrameTitle>
        <FrameDescription>Atur target produksi per produk untuk sesi ini</FrameDescription>
      </FrameHeader>

      <FramePanel className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex h-full min-h-0 flex-col">
          {/* Product list */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            {isLoadingProducts ? (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  qty={quantities[product.id] ?? 0}
                  onIncrement={() => increment(product.id)}
                  onDecrement={() => decrement(product.id)}
                />
              ))
            )}
          </div>

          {/* Summary + order action */}
          <div className="border-border/60 flex shrink-0 flex-col gap-3 border-t p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Ringkasan
              </span>
              {totalQty > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-xs"
                  onClick={reset}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada produk dipilih</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {selectedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{item.nama_produk}</span>
                    <Badge variant="outline" size="sm" className="font-mono">
                      x{item.qty}
                    </Badge>
                  </div>
                ))}
                <div className="border-border/60 mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
                  <span>Total unit</span>
                  <span className="tabular-nums">{totalQty}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmitOrder}
              disabled={totalQty === 0 || isSubmitting || isLoadingProducts}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Memesan...' : 'Pesan'}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Pesanan berhasil masuk Heijunka!</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}