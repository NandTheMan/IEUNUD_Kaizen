"use client"

import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { AlertTriangleIcon, ClockIcon, LayersIcon, PackageIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

// ---------- Types ----------

export type SiklusStatus = "QUEUE" | "WIP" | "DONE" | "REWORK" | "NG"

export interface ProductionWorkstation {
  id: string
  nama_ws: string
  tipe: string
}

export interface ProductionItem {
  id: number
  id_produk: number
  nama_produk: string
  kode_produk: string
  id_workstation: string
  waktu_mulai: string
  waktu_selesai: string | null
  status: SiklusStatus
  standard_time_detik: number | null
}

export interface HeijunkaQueueItem {
  id: number
  id_produk: number
  nama_produk: string
  kode_produk: string
  sequence: number
  target_release_at?: string | null
}

export interface ProductionKanbanProps {
  workstations: ProductionWorkstation[]
  items: ProductionItem[]
  className?: string
}

// ---------- Live clock ----------

function useNowTick(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function getProgress(item: ProductionItem, now: number) {
  if (item.status === "DONE") return 100
  if (item.status !== "WIP" || !item.standard_time_detik) return 0
  const elapsedSec = (now - new Date(item.waktu_mulai).getTime()) / 1000
  return Math.min(100, Math.max(0, (elapsedSec / item.standard_time_detik) * 100))
}

function isOverTime(item: ProductionItem, now: number) {
  if (item.status !== "WIP" || !item.standard_time_detik) return false
  const elapsedSec = (now - new Date(item.waktu_mulai).getTime()) / 1000
  return elapsedSec > item.standard_time_detik
}

// ---------- Overflow chip (bounded "+N" instead of scroll/clip) ----------

function OverflowChip({ items }: { items: { kode_produk: string }[] }) {
  if (items.length === 0) return null
  return (
    <div
      title={items.map((i) => i.kode_produk).join(", ")}
      className="border-border/70 bg-muted/40 text-muted-foreground flex h-full min-w-12 shrink-0 items-center justify-center rounded-md border border-dashed px-2 text-xs font-medium"
    >
      +{items.length}
    </div>
  )
}

// ---------- WIP card ----------

function WipCard({ item, now }: { item: ProductionItem; now: number }) {
  const progress = getProgress(item, now)
  const overtime = isOverTime(item, now)

  return (
    <Frame variant="ghost" spacing="sm" className="min-w-0 flex-1 p-0">
      <FramePanel className="flex h-full flex-col justify-center gap-1.5 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{item.nama_produk}</span>
          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
            {item.kode_produk}
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {Math.round(progress)}%
          </span>
          <div className="flex items-center gap-1">
            <ClockIcon
              className={cn("size-3", overtime ? "text-destructive" : "text-muted-foreground")}
            />
            <span
              className={cn(
                "text-[10px] tabular-nums",
                overtime ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {overtime ? "Over target" : "In progress"}
            </span>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}

// ---------- Safety stock chip ----------

function SafetyStockCard({ item }: { item: ProductionItem }) {
  return (
    <div className="border-border bg-card flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2">
      <PackageIcon className="text-muted-foreground size-3 shrink-0" />
      <span className="truncate text-[11px] font-medium">{item.nama_produk}</span>
      <span className="text-muted-foreground shrink-0 truncate font-mono text-[10px]">
        {item.kode_produk}
      </span>
    </div>
  )
}

// ---------- Heijunka queue card (used inside the dialog) ----------

function HeijunkaCard({ item }: { item: HeijunkaQueueItem }) {
  return (
    <div className="border-border bg-card flex flex-col gap-1.5 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" size="sm" className="font-mono">
          #{item.sequence}
        </Badge>
        {item.target_release_at && (
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {new Date(item.target_release_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      <span className="truncate text-sm font-medium">{item.nama_produk}</span>
      <span className="text-muted-foreground font-mono text-xs">{item.kode_produk}</span>
    </div>
  )
}

// ---------- Heijunka queue list (renders inside DialogContent, scroll is OK here) ----------

export function HeijunkaQueueList({ queue }: { queue: HeijunkaQueueItem[] }) {
  const sorted = useMemo(() => [...queue].sort((a, b) => a.sequence - b.sequence), [queue])

  if (sorted.length === 0) {
    return (
      <div className="border-border/60 text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-sm">
        Antrian kosong
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {sorted.map((item) => (
        <HeijunkaCard key={item.id} item={item} />
      ))}
    </div>
  )
}

/** @deprecated use HeijunkaQueueList inside a Dialog with proper DialogHeader instead */
export function HeijunkaRow({ queue }: { queue: HeijunkaQueueItem[] }) {
  return <HeijunkaQueueList queue={queue} />
}

// ---------- Row (one per workstation) ----------

const MAX_WIP_VISIBLE = 2
const MAX_STOCK_VISIBLE = 3

function WorkstationRow({
  workstation,
  items,
  now,
}: {
  workstation: ProductionWorkstation
  items: ProductionItem[]
  now: number
}) {
  const wipItems = items.filter((i) => i.status === "WIP")
  const safetyStockItems = items.filter((i) => i.status === "DONE")
  const ngCount = items.filter((i) => i.status === "NG").length
  const reworkCount = items.filter((i) => i.status === "REWORK").length
  const isIdle = wipItems.length === 0

  const visibleWip = wipItems.slice(0, MAX_WIP_VISIBLE)
  const hiddenWip = wipItems.slice(MAX_WIP_VISIBLE)

  const visibleStock = safetyStockItems.slice(0, MAX_STOCK_VISIBLE)
  const hiddenStock = safetyStockItems.slice(MAX_STOCK_VISIBLE)

  return (
    <Frame spacing="sm" className="flex h-full min-h-0 flex-col overflow-hidden">
      <FrameHeader className="flex shrink-0 flex-row items-center gap-2">
        <div className={cn("size-2 rounded-full", isIdle ? "bg-slate-400" : "bg-blue-500")} />
        <FrameTitle className="truncate">{workstation.nama_ws}</FrameTitle>
        <Badge variant="outline" size="sm">
          {isIdle ? "Idle" : "In Work"}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          {reworkCount > 0 && (
            <Badge variant="outline" size="sm" className="gap-1">
              <AlertTriangleIcon className="size-3" /> Rework {reworkCount}
            </Badge>
          )}
          <Badge variant={ngCount > 0 ? "destructive" : "outline"} size="sm" className="gap-1">
            <AlertTriangleIcon className="size-3" /> NG {ngCount}
          </Badge>
        </div>
      </FrameHeader>

      <FramePanel className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {/* In-progress area — grows to fill available row height */}
        <div className="flex min-h-0 flex-1 gap-2">
          {wipItems.length === 0 ? (
            <div className="border-border/60 text-muted-foreground flex h-full w-full items-center justify-center rounded-md border border-dashed text-xs">
              No active work
            </div>
          ) : (
            <>
              {visibleWip.map((item) => (
                <WipCard key={item.id} item={item} now={now} />
              ))}
              {hiddenWip.length > 0 && <OverflowChip items={hiddenWip} />}
            </>
          )}
        </div>

        {/* Safety stock — fixed compact strip */}
        <div className="border-border/60 bg-muted/30 flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-dashed px-2">
          <PackageIcon className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-muted-foreground shrink-0 text-[10px] font-semibold tracking-wide uppercase">
            Stock ({safetyStockItems.length})
          </span>
          {safetyStockItems.length === 0 ? (
            <span className="text-muted-foreground text-xs">Empty</span>
          ) : (
            <div className="flex h-full min-w-0 flex-1 gap-1.5">
              {visibleStock.map((item) => (
                <SafetyStockCard key={item.id} item={item} />
              ))}
              {hiddenStock.length > 0 && <OverflowChip items={hiddenStock} />}
            </div>
          )}
        </div>
      </FramePanel>
    </Frame>
  )
}

// ---------- Root ----------

export function ProductionKanban({ workstations, items, className }: ProductionKanbanProps) {
  const now = useNowTick(1000)

  const itemsByWorkstation = useMemo(() => {
    const map = new Map<string, ProductionItem[]>()
    for (const ws of workstations) map.set(ws.id, [])
    for (const item of items) {
      map.get(item.id_workstation)?.push(item) ?? map.set(item.id_workstation, [item])
    }
    return map
  }, [workstations, items])

  return (
    <div
      className={cn("grid h-full min-h-0 gap-3", className)}
      style={{
        gridTemplateRows: `repeat(${Math.max(workstations.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {workstations.map((ws) => (
        <WorkstationRow
          key={ws.id}
          workstation={ws}
          items={itemsByWorkstation.get(ws.id) ?? []}
          now={now}
        />
      ))}
    </div>
  )
}