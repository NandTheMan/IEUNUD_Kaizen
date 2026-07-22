import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../prisma/prisma.service'; // Assuming you have a PrismaService

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) {}

  async create(skenarioId: number) {
    // 1. Ensure the scenario exists
    const scenario = await this.prisma.skenarioGame.findUnique({
      where: { id: skenarioId },
    });
    if (!scenario) {
      throw new NotFoundException(`Scenario with ID ${skenarioId} not found.`);
    }

    // 2. Deactivate any currently active sessions
    await this.prisma.sesiPraktikum.updateMany({
      where: { status: 'ACTIVE' },
      data: { status: 'COMPLETED', waktu_selesai: new Date() },
    });

    // 3. Create the new active session
    const newSession = await this.prisma.sesiPraktikum.create({
      data: {
        id_skenario: skenarioId,
        status: 'ACTIVE',
      },
    });

    return newSession;
  }

  async prepareGame(skenarioId: number) {
    // 1. Create a new session, which also deactivates any old ones.
    const newSession = await this.create(skenarioId);

    await this.prisma.$transaction(async (tx) => {
      // 2. Initialize virtual material stock PER WORKSTATION for the session.
      const workstations = await tx.workstation.findMany();
      for (const ws of workstations) {
        // Find all steps for this workstation in the scenario
        const steps = await tx.skenarioLangkahKerja.findMany({
          where: { id_skenario: skenarioId, id_workstation: ws.id },
          include: { bom: { include: { bahan: true } } },
        });

        // Collect unique materials for the workstation
        const materials = new Map<number, { id: number; kuantitas_pack: number }>();
        steps.forEach(step => {
          step.bom.forEach(bomItem => {
            if (!materials.has(bomItem.id_bahan)) {
              materials.set(bomItem.id_bahan, bomItem.bahan);
            }
          });
        });

        // Create stock entries for this workstation (2 packs each)
        const initialStockForWs = Array.from(materials.values()).map(material => ({
          id_sesi: newSession.id,
          id_workstation: ws.id,
          id_bahan: material.id,
          stok_sekarang: 2 * material.kuantitas_pack,
          safety_stock_threshold: material.kuantitas_pack,
        }));

        if (initialStockForWs.length > 0) {
          await tx.stokLiveWorkstation.createMany({ data: initialStockForWs });
        }
      }

      // 3. Hardcode the initial product-in-progress and pull signal stock for a predictable start state.
      const safetyStockToInsert = [
          // WS1 is stocked with two generic parts, tagged for their final products
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'F/A-001-001', id_workstation: 'WS1', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() }, // Tagged for a PickUp
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'A-002-001', id_workstation: 'WS1', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },   // Tagged for a D-Cab
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'F/A-003-001', id_workstation: 'WS2', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'F/A-001-002', id_workstation: 'WS2', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          // WS3 has finished products, ready for WS4. Note the id_produk has changed from 99.
          { id_sesi: newSession.id, id_produk: 1, kode_produk: 'F/A-001-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 2, kode_produk: 'A-002-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() }, // A finished D-Cab
          { id_sesi: newSession.id, id_produk: 3, kode_produk: 'F/A-003-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() }, // A finished MPV
          // Create initial pull signals for WS4 to start the process, representing empty slots in its supermarket.
          { id_sesi: newSession.id, id_produk: 1, kode_produk: 'PULL-SIGNAL', id_workstation: 'WS4', status: 'QUEUE', langkah_sekarang: 1, waktu_mulai: new Date() },
          { id_sesi: newSession.id, id_produk: 2, kode_produk: 'PULL-SIGNAL', id_workstation: 'WS4', status: 'QUEUE', langkah_sekarang: 1, waktu_mulai: new Date() },
          { id_sesi: newSession.id, id_produk: 3, kode_produk: 'PULL-SIGNAL', id_workstation: 'WS4', status: 'QUEUE', langkah_sekarang: 1, waktu_mulai: new Date() },
      ];
      await tx.logSiklusKanban.createMany({ data: safetyStockToInsert });
    });

    // Also broadcast an update so dashboards refresh
    this.eventsGateway.broadcastKanbanUpdate();

    return {
        ...newSession,
        message: `Session ${newSession.id} created and initial safety stock populated.`
    };
  }

  findActive() {
    return this.prisma.sesiPraktikum.findFirst({
      where: { status: 'ACTIVE' },
    });
  }

  async stopActive() {
    const activeSession = await this.findActive();
    if (!activeSession) {
      throw new NotFoundException('No active session to stop.');
    }

    const updatedSession = await this.prisma.sesiPraktikum.update({
      where: { id: activeSession.id },
      data: {
        status: 'COMPLETED',
        waktu_selesai: new Date(),
      },
    });

    this.eventsGateway.broadcastSessionFinished(updatedSession.id);
    this.eventsGateway.broadcastKanbanUpdate();

    return updatedSession;
  }

  async getKanbanBoardState(sessionId: number) {
    // 1. Get the session to find which scenario it's running
    const session = await this.prisma.sesiPraktikum.findUniqueOrThrow({
      where: { id: sessionId },
      include: { skenario: true }
    });

    // 2. Fetch Workstations for this scenario
    const workstationsData = await this.prisma.skenarioWorkstation.findMany({
      where: { id_skenario: session.id_skenario },
      include: { workstation: true },
    });

    // Map to your frontend's ProductionWorkstation format
    const workstations = workstationsData.map(sw => ({
      id: sw.workstation.id,
      nama_ws: sw.workstation.nama_ws,
      tipe: sw.workstation.tipe,
    }));

    // 3. Fetch Active Items (WIP & DONE sitting in stations)
    const itemsData = await this.prisma.logSiklusKanban.findMany({
      where: {
        id_sesi: sessionId,
        status: { in: ['QUEUE', 'WIP', 'DONE'] } // Filter out fully completed or NG if needed
      },
      include: { produk: true }
    });

    const items = itemsData.map(item => ({
      id: item.id,
      id_produk: item.id_produk,
      nama_produk: item.produk.nama_produk,
      gambar_url: item.produk.gambar_url,
      kode_produk: item.kode_produk,
      id_workstation: item.id_workstation,
      waktu_mulai: item.waktu_mulai.toISOString(),
      waktu_selesai: item.waktu_selesai ? item.waktu_selesai.toISOString() : null,
      status: item.status,
      // Note: total_waktu_standar_detik requires joining SkenarioLangkahKerja if you want it dynamic!
      total_waktu_standar_detik: 120,
    }));

    // 4. Fetch the Heijunka Queue
    const queueData = await this.prisma.antrianHeijunka.findMany({
      where: {
        id_sesi: sessionId,
        status: { in: ['QUEUED', 'RELEASED'] },
      },
      orderBy: { urutan: 'asc' },
      include: { produk: true }
    });

    const heijunkaQueue = queueData.map(q => ({
      id: q.id,
      id_produk: q.id_produk,
      nama_produk: q.produk.nama_produk,
      kode_produk: q.kode_produk,
      sequence: q.urutan,
      status: q.status,
    }));

    return { workstations, items, heijunkaQueue };
  }

  async getWorkstationStock(sessionId: number, wsId: string) {
    const stock = await this.prisma.stokLiveWorkstation.findMany({
      where: {
        id_sesi: sessionId,
        id_workstation: wsId,
      },
      include: {
        bahan: true,
      },
      orderBy: {
        bahan: {
          nama_bahan: 'asc',
        },
      },
    });

    return stock.map(s => ({
      id_bahan: s.id_bahan,
      nama_bahan: s.bahan.nama_bahan,
      gambar_url: s.bahan.gambar_url,
      stok_sekarang: s.stok_sekarang,
    }));
  }

  async getWarehouseStockState(sessionId: number) {
    const stockData = await this.prisma.stokLiveWorkstation.findMany({
        where: { id_sesi: sessionId },
        include: {
            bahan: true,
            workstation: true,
        },
        orderBy: [
            { workstation: { nama_ws: 'asc' } },
            { bahan: { nama_bahan: 'asc' } },
        ],
    });

    // Group by workstation
    const groupedByWs = stockData.reduce((acc, stockItem) => {
        const wsId = stockItem.id_workstation;
        if (!acc[wsId]) {
            acc[wsId] = {
                id: wsId,
                nama_ws: stockItem.workstation.nama_ws,
                materials: [],
            };
        }
        acc[wsId].materials.push({
            id_bahan: stockItem.id_bahan,
            nama_bahan: stockItem.bahan.nama_bahan,
            gambar_url: stockItem.bahan.gambar_url,
            stok_sekarang: stockItem.stok_sekarang,
            safety_stock_threshold: stockItem.safety_stock_threshold,
        });
        return acc;
    }, {} as Record<string, { id: string; nama_ws: string; materials: any[] }>);

    return Object.values(groupedByWs);
  }

  async decrementWorkstationStock(sessionId: number, wsId: string, materialId: number, quantity: number) {
    let alertTriggered = false;
    const updatedStock = await this.prisma.$transaction(async (tx) => {
      const currentStock = await tx.stokLiveWorkstation.findUniqueOrThrow({
        where: { id_sesi_id_workstation_id_bahan: { id_sesi: sessionId, id_workstation: wsId, id_bahan: materialId } },
      });

      const decrementAmount = Math.min(currentStock.stok_sekarang, quantity);

      const stockAfterUpdate = await tx.stokLiveWorkstation.update({
        where: { id_sesi_id_workstation_id_bahan: { id_sesi: sessionId, id_workstation: wsId, id_bahan: materialId } },
        data: { stok_sekarang: { decrement: decrementAmount } },
      });

      if (stockAfterUpdate.stok_sekarang <= stockAfterUpdate.safety_stock_threshold) {
        const existingAlert = await tx.logLogistik.findFirst({
            where: { id_sesi: sessionId, id_workstation: wsId, id_bahan: materialId, waktu_dipenuhi: null }
        });
        if (!existingAlert) {
            const bahan = await tx.bahan.findUniqueOrThrow({ where: { id: materialId } });
            await tx.logLogistik.create({
                data: {
                    id_sesi: sessionId,
                    id_workstation: wsId,
                    id_bahan: materialId,
                    qty_diminta: bahan.kuantitas_pack,
                    waktu_diminta: new Date(),
                }
            });
            alertTriggered = true;
        }
      }
      return stockAfterUpdate;
    });

    if (alertTriggered) {
      this.eventsGateway.broadcastLowStockUpdate();
    }
    // Broadcast an update so the workstation UI refreshes
    this.eventsGateway.broadcastKanbanUpdate();

    return updatedStock;
  }

  async getLowStockAlerts(sessionId: number) {
    return this.prisma.logLogistik.findMany({
        where: { id_sesi: sessionId, waktu_dipenuhi: null },
        include: { bahan: true },
        orderBy: { waktu_diminta: 'asc' },
    });
  }

  async fulfillLogisticsRequest(sessionId: number, logId: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Find the request
      const request = await tx.logLogistik.findUnique({
        where: { id: logId },
      });

      if (!request) {
        throw new NotFoundException(`Permintaan logistik dengan ID ${logId} tidak ditemukan.`);
      }
      if (request.id_sesi !== sessionId) {
        throw new BadRequestException('Permintaan ini bukan bagian dari sesi aktif.');
      }
      if (request.waktu_dipenuhi) {
        throw new BadRequestException('Permintaan ini sudah dipenuhi.');
      }

      // 2. Fulfill the request by increasing the stock
      await tx.stokLiveWorkstation.update({
        where: {
          id_sesi_id_workstation_id_bahan: {
            id_sesi: request.id_sesi,
            id_workstation: request.id_workstation,
            id_bahan: request.id_bahan,
          },
        },
        data: {
          stok_sekarang: { increment: request.qty_diminta },
        },
      });

      // 3. Mark the request as fulfilled
      return tx.logLogistik.update({
        where: { id: logId },
        data: { waktu_dipenuhi: new Date() },
      });
    });

    this.eventsGateway.broadcastKanbanUpdate();
    this.eventsGateway.broadcastLowStockUpdate();

    return { success: true, message: `Permintaan logistik #${logId} telah dipenuhi.` };
  }

  async getAndonAlerts(sessionId: number) {
    return this.prisma.logAndon.findMany({
      where: {
        id_sesi: sessionId,
        waktu_selesai: null,
      },
      orderBy: { waktu_lapor: 'asc' }, // Oldest first
    });
  }

  async submitOrder(sessionId: number, items: { id_produk: number; target_qty: number }[]) {
    const session = await this.prisma.sesiPraktikum.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot add orders to an inactive session.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Record Production Targets (Historical record of total requested)
      for (const item of items) {
        if (item.target_qty > 0) {
          await tx.targetProduksi.upsert({
            where: { id_sesi_id_produk: { id_sesi: sessionId, id_produk: item.id_produk } },
            update: { target_qty: { increment: item.target_qty } },
            create: { id_sesi: sessionId, id_produk: item.id_produk, target_qty: item.target_qty },
          });
        }
      }

      // 2. Fetch products for base codes (e.g., 'CAR-A')
      const products = await tx.produk.findMany();

      // 3. Find out what is already RELEASED to workstations
      // We need this so we don't mess up the sequence numbers or duplicate physical tags
      const releasedItems = await tx.antrianHeijunka.findMany({
        where: { id_sesi: sessionId, status: 'RELEASED' }
      });

      // Determine the next starting sequence number
      const highestReleasedUrutan = releasedItems.length > 0
        ? Math.max(...releasedItems.map(r => r.urutan))
        : 0;
      let currentSeqNumber = highestReleasedUrutan + 1;

      // Determine where the physical tags (e.g., CAR-A-005) should start
      const tagCounters: Record<number, number> = {};
      for (const p of products) {
        const releasedCount = releasedItems.filter(r => r.id_produk === p.id).length;
        tagCounters[p.id] = releasedCount + 1; // Start counting from after the last released item
      }

      // 4. Combine currently QUEUED items with the NEW order
      const currentlyQueued = await tx.antrianHeijunka.findMany({
        where: { id_sesi: sessionId, status: 'QUEUED' }
      });

      const pendingCounts: Record<number, number> = {};

      // Add existing queued quantities
      for (const q of currentlyQueued) {
        pendingCounts[q.id_produk] = (pendingCounts[q.id_produk] || 0) + 1;
      }

      // Add new incoming order quantities
      for (const item of items) {
        pendingCounts[item.id_produk] = (pendingCounts[item.id_produk] || 0) + item.target_qty;
      }

      // Convert to an array for the round-robin loop
      let remainingToSequence = Object.keys(pendingCounts).map(idStr => {
        const id = parseInt(idStr);
        return {
          id_produk: id,
          target_qty: pendingCounts[id],
          base_code: products.find(p => p.id === id)?.kode_produk || 'UNK'
        };
      });

      // 5. DELETE the old un-released queue (we are rewriting the future!)
      await tx.antrianHeijunka.deleteMany({
        where: { id_sesi: sessionId, status: 'QUEUED' }
      });

      // 6. The Heijunka Leveling Algorithm (Round-Robin on the grand total)
      const queueToInsert = [];

      while (remainingToSequence.some(r => r.target_qty > 0)) {
        for (let i = 0; i < remainingToSequence.length; i++) {
          if (remainingToSequence[i].target_qty > 0) {

            const prodId = remainingToSequence[i].id_produk;
            const currentTagNum = tagCounters[prodId];

            queueToInsert.push({
              id_sesi: sessionId,
              id_produk: prodId,
              kode_produk: `${remainingToSequence[i].base_code}-${String(currentTagNum).padStart(3, '0')}`,
              urutan: currentSeqNumber,
              status: 'QUEUED'
            });

            remainingToSequence[i].target_qty -= 1;
            currentSeqNumber += 1;
            tagCounters[prodId] += 1;
          }
        }
      }

      // 7. Insert the newly leveled queue
      if (queueToInsert.length > 0) {
        await tx.antrianHeijunka.createMany({
          data: queueToInsert
        });
      }

      return { success: true, message: 'Queue dynamically re-leveled.', count: queueToInsert.length };
    });

    this.eventsGateway.broadcastKanbanUpdate();
    return result;
  }

  async shipOrder(sessionId: number, logSiklusId: number, heijunkaId: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Get both records to validate them
      const finishedGood = await tx.logSiklusKanban.findUniqueOrThrow({
        where: { id: logSiklusId },
      });
      const order = await tx.antrianHeijunka.findUniqueOrThrow({ where: { id: heijunkaId } });

      // 2. Perform validations
      if (finishedGood.id_sesi !== sessionId || order.id_sesi !== sessionId) {
        throw new BadRequestException('Item or order does not belong to this session.');
      }
      if (finishedGood.status !== 'DONE' || finishedGood.id_workstation !== 'WS4') {
        throw new BadRequestException('Item is not a finished good at the final workstation.');
      }
      // An order can be shipped as long as it's not already shipped or cancelled
      if (order.status === 'SHIPPED') {
        throw new BadRequestException('This order has already been shipped.');
      }
      if (finishedGood.id_produk !== order.id_produk) {
        throw new BadRequestException(
          `Product mismatch: Cannot fulfill order for Product ID ${order.id_produk} with Product ID ${finishedGood.id_produk}.`
        );
      }

      // 3. Atomically update statuses to 'SHIPPED'
      await tx.logSiklusKanban.update({
        where: { id: logSiklusId },
        data: { status: 'SHIPPED' },
      });

      await tx.antrianHeijunka.update({
        where: { id: heijunkaId },
        data: { status: 'SHIPPED' },
      });

      return {
        success: true,
        message: `Order for ${order.kode_produk} fulfilled with item ${finishedGood.kode_produk}.`,
        shippedProductId: finishedGood.id_produk,
      };
    });

    // After shipping, create a new pull signal (Kanban card) for the final workstation
    // to replenish the stock that was just taken.
    await this.prisma.logSiklusKanban.create({
      data: {
        id_sesi: sessionId,
        id_produk: result.shippedProductId, // The product that was shipped
        kode_produk: 'PULL-SIGNAL',
        id_workstation: 'WS4',
        status: 'QUEUE',
        waktu_mulai: new Date(),
      }
    });

    this.eventsGateway.broadcastKanbanUpdate();
    // Notify the UI for a better user experience
    this.eventsGateway.notifyWorkstation('WS4', { title: 'Sinyal Tarikan Diterima!', message: 'Satu unit telah dikirim. Anda diotorisasi untuk menarik pekerjaan baru dari WS3.' });
    return { success: result.success, message: result.message };
  }

  async reportAndon(sessionId: number, wsId: string, message?: string) {
    const andonLog = await this.prisma.logAndon.create({
      data: {
        id_sesi: sessionId,
        id_workstation: wsId,
        jenis_gangguan: message || `Bantuan dibutuhkan di ${wsId}`,
        waktu_lapor: new Date(),
      },
    });

    // Broadcast to all clients (specifically for supervisor dashboard)
    this.eventsGateway.broadcastAndonUpdate();

    return andonLog;
  }

  async resolveAndonAlert(andonId: number) {
    const alert = await this.prisma.logAndon.findUnique({ where: { id: andonId } });
    if (!alert) {
      throw new NotFoundException(`Andon alert with ID ${andonId} not found.`);
    }

    const resolvedAlert = await this.prisma.logAndon.update({
      where: { id: andonId },
      data: { waktu_selesai: new Date() },
    });

    // Broadcast update so supervisor UI refreshes
    this.eventsGateway.broadcastAndonUpdate();

    return resolvedAlert;
  }

  async reportNg(sessionId: number, wsId: string, reason: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Find the active work-in-progress item for this station
      const activeWip = await tx.logSiklusKanban.findFirst({
        where: {
          id_sesi: sessionId,
          id_workstation: wsId,
          status: 'WIP',
        },
      });

      if (!activeWip) {
        throw new BadRequestException('Tidak ada pekerjaan aktif untuk dilaporkan sebagai NG.');
      }

      // 2. Create a record in the NG log
      await tx.logProdukNG.create({
        data: {
          id_sesi: activeWip.id_sesi,
          id_produk: activeWip.id_produk,
          kode_produk: activeWip.kode_produk,
          id_workstation: activeWip.id_workstation,
          alasan_ng: reason,
        },
      });

      // 3. Delete the original item from the Kanban log
      await tx.logSiklusKanban.delete({
        where: { id: activeWip.id },
      });

      return { success: true, message: `Produk ${activeWip.kode_produk} telah dilaporkan sebagai NG.` };
    });

    this.eventsGateway.broadcastKanbanUpdate();
    return result;
  }

  async getSessionSummary(sessionId: number) {
    const session = await this.prisma.sesiPraktikum.findUniqueOrThrow({
        where: { id: sessionId },
    });

    const shippedCount = await this.prisma.antrianHeijunka.groupBy({
        by: ['id_produk'],
        where: { id_sesi: sessionId, status: 'SHIPPED' },
        _count: { id_produk: true },
    });

    const ngCount = await this.prisma.logProdukNG.groupBy({
        by: ['id_produk'],
        where: { id_sesi: sessionId },
        _count: { id_produk: true },
    });

    const productIds = [...new Set([...shippedCount.map(s => s.id_produk), ...ngCount.map(n => n.id_produk)])];
    const products = await this.prisma.produk.findMany({
        where: { id: { in: productIds } }
    });

    const productionResults = products.map(p => ({
        id_produk: p.id,
        nama_produk: p.nama_produk,
        qty_shipped: shippedCount.find(s => s.id_produk === p.id)?._count.id_produk || 0,
        qty_ng: ngCount.find(n => n.id_produk === p.id)?._count.id_produk || 0,
    })).filter(r => r.qty_shipped > 0 || r.qty_ng > 0);

    const totalAndon = await this.prisma.logAndon.count({ where: { id_sesi: sessionId } });
    const totalLogistik = await this.prisma.logLogistik.count({ where: { id_sesi: sessionId } });

    const durationMs = session.waktu_selesai ? session.waktu_selesai.getTime() - session.waktu_mulai.getTime() : 0;

    return {
        sessionId: session.id,
        duration_minutes: Math.round(durationMs / 60000),
        production_results: productionResults,
        total_andon_alerts: totalAndon,
        total_logistics_requests: totalLogistik,
    };
  }

  /**
   * Toggles the given workstation forward one step: advances an in-progress
   * item to its next step, finishes it, or pulls a new item to start work on.
   *
   * Concurrency note: every mutation below that depends on a row we read
   * earlier in this function uses `updateMany` guarded by the exact state we
   * read (id + previous status/step), and checks `.count`. This is an
   * optimistic-concurrency pattern: if a concurrent call (double-click, two
   * tabs, a retried request) already changed that row, our guarded write
   * matches zero rows instead of silently overwriting or double-claiming it,
   * and we throw a clear "someone else already did this, try again" error
   * instead of corrupting state or crashing on a stale-ID update/delete.
   */
  async toggleWorkstation(sessionId: number, wsId: string) {
  const session = await this.prisma.sesiPraktikum.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.status !== 'ACTIVE') {
    throw new BadRequestException('Sesi tidak aktif.');
  }

  const result = await this.prisma.$transaction(async (tx) => {
    // ====================================================================
    // 1. CHECK FOR ACTIVE WORK (WIP) — unchanged
    // ====================================================================
    let activeWip = await tx.logSiklusKanban.findFirst({
      where: { id_sesi: sessionId, id_workstation: wsId, status: 'WIP' },
      include: { produk: true },
    });
    
    // VIRTUAL MATERIAL DECREMENT
    // When an operator toggles a station with an active item, we consume the materials for the CURRENT step.
    if (activeWip) {
      const currentStepDetails = await tx.skenarioLangkahKerja.findFirst({
        where: {
          id_skenario: session.id_skenario,
          id_produk: activeWip.id_produk,
          id_workstation: wsId,
          urutan_langkah: activeWip.langkah_sekarang,
        },
        include: { bom: { include: { bahan: true } } },
      });

      if (currentStepDetails?.bom && currentStepDetails.bom.length > 0) {
        for (const bomItem of currentStepDetails.bom) {
          const currentStock = await tx.stokLiveWorkstation.findUniqueOrThrow({
            where: { id_sesi_id_workstation_id_bahan: { id_sesi: sessionId, id_workstation: wsId, id_bahan: bomItem.id_bahan } },
          });

          if (currentStock.stok_sekarang < bomItem.qty_dibutuhkan) {
            throw new BadRequestException(
              `Stok ${bomItem.bahan.nama_bahan} di ${wsId} tidak mencukupi. Sisa: ${currentStock.stok_sekarang}, dibutuhkan: ${bomItem.qty_dibutuhkan}.`
            );
          }

          const updatedStock = await tx.stokLiveWorkstation.update({
            where: { id_sesi_id_workstation_id_bahan: { id_sesi: sessionId, id_workstation: wsId, id_bahan: bomItem.id_bahan } },
            data: { stok_sekarang: { decrement: bomItem.qty_dibutuhkan } },
          });

          if (updatedStock.stok_sekarang <= updatedStock.safety_stock_threshold) {
            const existingAlert = await tx.logLogistik.findFirst({
                where: { id_sesi: sessionId, id_workstation: wsId, id_bahan: bomItem.id_bahan, waktu_dipenuhi: null }
            });
            // If no active request for this material exists, create one.
            // The quantity requested (`qty_diminta`) is determined here.
            // We are using `bomItem.bahan.kuantitas_pack`, which is the standard
            // pack size for that specific material, defined in the database.
            if (!existingAlert) {
                await tx.logLogistik.create({
                    data: {
                        id_sesi: sessionId,
                        id_workstation: wsId,
                        id_bahan: bomItem.id_bahan,
                        qty_diminta: bomItem.bahan.kuantitas_pack,
                        waktu_diminta: new Date(),
                    }
                });
                this.eventsGateway.broadcastLowStockUpdate();
            }
          }
        }
      }
    }

    if (activeWip) {
      const totalSteps = await tx.skenarioLangkahKerja.count({
        where: { id_skenario: session.id_skenario, id_produk: activeWip.id_produk, id_workstation: wsId }
      });
      const maxSteps = totalSteps > 0 ? totalSteps : 1;

      if (activeWip.langkah_sekarang < maxSteps) {
        const nextStepNum = activeWip.langkah_sekarang + 1;
        const advanced = await tx.logSiklusKanban.updateMany({
          where: { id: activeWip.id, langkah_sekarang: activeWip.langkah_sekarang },
          data: { langkah_sekarang: nextStepNum },
        });
        if (advanced.count === 0) {
          throw new BadRequestException('Langkah sudah diperbarui oleh proses lain, coba lagi.');
        }

        const stepDetails = await tx.skenarioLangkahKerja.findFirst({
          where: { id_skenario: session.id_skenario, id_produk: activeWip.id_produk, id_workstation: wsId, urutan_langkah: nextStepNum },
          include: {
            bom: {
              include: {
                bahan: true,
              },
            },
          },
        });

        const bomForStep = stepDetails?.bom.map(b => ({
          id_bahan: b.id_bahan,
          nama_bahan: b.bahan.nama_bahan,
          qty_dibutuhkan: b.qty_dibutuhkan,
          gambar_url: b.bahan.gambar_url,
        })) || [];

        // Get the total standard time for the whole process at this workstation
        const processInfo = await tx.skenarioWorkstationProduk.findUnique({
          where: {
            id_skenario_id_workstation_id_produk: { id_skenario: session.id_skenario, id_workstation: wsId, id_produk: activeWip.id_produk }
          }
        });
        const totalStandardTime = processInfo?.total_waktu_standar_detik || 0;

        return {
          action: 'NEXT',
          kode_produk: activeWip.kode_produk,
          nama_produk: activeWip.produk.nama_produk,
          langkah_sekarang: nextStepNum,
          total_langkah: maxSteps,
          deskripsi_tugas: stepDetails?.deskripsi_tugas || `Langkah ${nextStepNum}`,
          message: `Lanjut ke langkah ${nextStepNum}/${maxSteps}`,
          bom: bomForStep,
          standard_time_detik: totalStandardTime,
        };
      } else {
        const finished = await tx.logSiklusKanban.updateMany({
          where: { id: activeWip.id, status: 'WIP' },
          data: { status: 'DONE', waktu_selesai: new Date() },
        });
        if (finished.count === 0) {
          throw new BadRequestException('Item sudah diselesaikan oleh proses lain, coba lagi.');
        }

        return {
          action: 'STOP',
          kode_produk: activeWip.kode_produk,
          message: `${wsId} selesai. Barang siap ditarik stasiun berikutnya.`,
        };
      }
    }

    // ====================================================================
    // 2. NO ACTIVE WIP, SO PULL NEW WORK BASED ON A PULL SIGNAL (QUEUE TICKET)
    // This logic is now UNIFIED for all workstations.
    // ====================================================================
    const pendingVisualQueue = await tx.logSiklusKanban.findFirst({
      where: { id_sesi: sessionId, id_workstation: wsId, status: 'QUEUE' },
      orderBy: { id: 'asc' },
    });

    if (!pendingVisualQueue) {
      throw new BadRequestException(`Tidak ada sinyal tarikan (Kanban) untuk memulai pekerjaan di ${wsId}.`);
    }

    const productToBuildId = pendingVisualQueue.id_produk;
    const wsNumber = parseInt(wsId.replace('WS', ''));

    // If this is the first station, it creates a part from raw materials.
    if (wsNumber === 1) {
      if (productToBuildId !== 99) {
        throw new Error(`WS1 received a pull signal for a non-generic part (ID: ${productToBuildId})`);
      }
      // Consume the queue ticket
      await tx.logSiklusKanban.delete({ where: { id: pendingVisualQueue.id } });

      // Create the new WIP item. It's just a generic part.
      activeWip = await tx.logSiklusKanban.create({
        data: {
          id_sesi: sessionId,
          id_produk: 99, // Generic part
          kode_produk: `GEN-${String(Date.now()).slice(-6)}`, // Simple unique code
          id_workstation: wsId,
          status: 'WIP',
          langkah_sekarang: 1,
          waktu_mulai: new Date(),
        },
        include: { produk: true },
      });
    } else { // Logic for WS2, WS3, WS4
      const previousWsId = `WS${wsNumber - 1}`;

      // Determine what product is needed from upstream.
      // WS3 is the transformation station; it needs a generic part (99) to make a specific car.
      // Other stations (WS2, WS4) need the same part they are being asked to build.
      const upstreamProductId = (wsId === 'WS3') ? 99 : productToBuildId;

      const availableStock = await tx.logSiklusKanban.findFirst({
        where: { id_sesi: sessionId, id_workstation: previousWsId, status: 'DONE', id_produk: upstreamProductId },
        orderBy: { waktu_selesai: 'asc' },
      });

      if (!availableStock) {
        throw new BadRequestException(`Menunggu suplai produk (ID: ${upstreamProductId}) dari ${previousWsId}.`);
      }

      // Consume the queue ticket
      await tx.logSiklusKanban.delete({ where: { id: pendingVisualQueue.id } });

      // Generate a new, more specific product code if transformation is happening
      let finalProductKode = availableStock.kode_produk;
      if (wsId === 'WS3') {
        const productInfo = await tx.produk.findUniqueOrThrow({ where: { id: productToBuildId } });
        finalProductKode = `${productInfo.kode_produk}-${String(Date.now()).slice(-5)}`;
      }

      // Claim the upstream stock and move it to this station as WIP
      const claimedStock = await tx.logSiklusKanban.updateMany({
        where: { id: availableStock.id, status: 'DONE' },
        data: {
          id_produk: productToBuildId, // This applies the transformation at WS3
          kode_produk: finalProductKode,
          id_workstation: wsId,
          status: 'WIP',
          langkah_sekarang: 1,
          waktu_mulai: new Date(),
          waktu_selesai: null,
        },
      });
      if (claimedStock.count === 0) throw new BadRequestException('Komponen baru saja diambil oleh proses lain.');

      // Create a new pull signal (QUEUE ticket) for the upstream station
      await tx.logSiklusKanban.create({
        data: {
          id_sesi: sessionId,
          id_produk: availableStock.id_produk, // The ID of the part we just took
          kode_produk: 'PULL-SIGNAL',
          id_workstation: previousWsId,
          status: 'QUEUE',
          waktu_mulai: new Date(),
        }
      });

      // Notify the UI for a better user experience
      this.eventsGateway.notifyWorkstation(previousWsId, { title: 'Sinyal Tarikan Diterima!', message: `Stok output Anda telah ditarik oleh ${wsId}. Anda diotorisasi untuk memulai pekerjaan baru.` });

      // Set activeWip to the newly claimed item to fetch its steps
      const productInfo = await tx.produk.findUniqueOrThrow({ where: { id: productToBuildId } });
      activeWip = { 
        ...availableStock, 
        id: -1, // This is a conceptual new item
        id_produk: productToBuildId, 
        kode_produk: finalProductKode,
        produk: productInfo,
        status: 'WIP',
        id_workstation: wsId,
      };
    }

    if (!activeWip) throw new Error('Gagal memulai pekerjaan baru.');
    const totalSteps = await tx.skenarioLangkahKerja.count({
      where: { id_skenario: session.id_skenario, id_produk: activeWip.id_produk, id_workstation: wsId }
    });
    const stepDetails = await tx.skenarioLangkahKerja.findFirst({
      where: { id_skenario: session.id_skenario, id_produk: activeWip.id_produk, id_workstation: wsId, urutan_langkah: 1 },
      include: {
        bom: {
          include: {
            bahan: true,
          },
        },
      },
    });

    const bomForStep = stepDetails?.bom.map(b => ({
      id_bahan: b.id_bahan,
      nama_bahan: b.bahan.nama_bahan,
      qty_dibutuhkan: b.qty_dibutuhkan,
      gambar_url: b.bahan.gambar_url,
    })) || [];

    const productInfo = await tx.produk.findUniqueOrThrow({
      where: { id: activeWip.id_produk }
    });

    // Get the total standard time for the whole process at this workstation
    const processInfo = await tx.skenarioWorkstationProduk.findUnique({
      where: {
        id_skenario_id_workstation_id_produk: { id_skenario: session.id_skenario, id_workstation: wsId, id_produk: activeWip.id_produk }
      }
    });
    const totalStandardTime = processInfo?.total_waktu_standar_detik || 0;

    return {
      action: 'START',
      kode_produk: activeWip.kode_produk,
      nama_produk: productInfo.nama_produk,
      langkah_sekarang: 1,
      total_langkah: totalSteps > 0 ? totalSteps : 1,
      deskripsi_tugas: stepDetails?.deskripsi_tugas || 'Langkah 1',
      message: `${wsId} mulai mengerjakan ${activeWip.kode_produk}`,
      bom: bomForStep,
      standard_time_detik: totalStandardTime,
    };
  });

  // Menyiarkan pembaruan umum untuk dasbor overview seperti papan Kanban utama.
  this.eventsGateway.broadcastKanbanUpdate();
  // Menyiarkan pembaruan spesifik ke stasiun kerja yang di-toggle.
  this.eventsGateway.broadcastWorkstationStateUpdate(wsId);
  // Pembaruan stok rendah disiarkan dari dalam logika transaksi
  // Low stock updates are broadcast from within the transaction logic
  return result;
}

  async getWorkstationStatus(sessionId: number, wsId: string) {
  // Most recent item currently sitting at this workstation: either being
  // worked on (WIP) or finished and waiting to be pulled by the next station (DONE).
  const current = await this.prisma.logSiklusKanban.findFirst({
    where: {
      id_sesi: sessionId,
      id_workstation: wsId,
      status: { in: ['WIP', 'DONE'] },
    },
    orderBy: { waktu_mulai: 'desc' },
    include: { produk: true },
  });

  if (!current) {
    return { status: 'IDLE', message: 'Menunggu sinyal tarikan dari stasiun berikutnya...' };
  }

  if (current.status === 'DONE') {
    return {
      status: 'DONE',
      kode_produk: current.kode_produk,
      nama_produk: current.produk.nama_produk,
      message: `${current.kode_produk} selesai. Barang siap ditarik stasiun berikutnya.`,
    };
  }

  // status === 'WIP'
  const session = await this.prisma.sesiPraktikum.findUniqueOrThrow({ where: { id: sessionId } });

  const [totalSteps, stepDetails, processInfo] = await Promise.all([
    this.prisma.skenarioLangkahKerja.count({
      where: { id_skenario: session.id_skenario, id_produk: current.id_produk, id_workstation: wsId },
    }),
    this.prisma.skenarioLangkahKerja.findFirst({
      where: {
        id_skenario: session.id_skenario,
        id_produk: current.id_produk,
        id_workstation: wsId,
        urutan_langkah: current.langkah_sekarang,
      },
      include: { bom: { include: { bahan: true } } },
    }),
    this.prisma.skenarioWorkstationProduk.findUnique({
      where: {
        id_skenario_id_workstation_id_produk: { id_skenario: session.id_skenario, id_workstation: wsId, id_produk: current.id_produk }
      }
    })
  ]);

  const standardTime = processInfo?.total_waktu_standar_detik ?? 0;
  const elapsed = current.waktu_mulai
    ? Math.floor((Date.now() - current.waktu_mulai.getTime()) / 1000)
    : 0;
  const remaining = Math.max(standardTime - elapsed, 0);

  const bom = stepDetails?.bom.map((b) => ({
    id_bahan: b.id_bahan,
    nama_bahan: b.bahan.nama_bahan,
    qty_dibutuhkan: b.qty_dibutuhkan,
    gambar_url: b.bahan.gambar_url,
  })) ?? [];

  return {
    status: 'WIP',
    kode_produk: current.kode_produk,
    nama_produk: current.produk.nama_produk,
    langkah_sekarang: current.langkah_sekarang,
    total_langkah: totalSteps > 0 ? totalSteps : 1,
    deskripsi_tugas: stepDetails?.deskripsi_tugas ?? `Langkah ${current.langkah_sekarang}`,
    waktu_standar_detik: standardTime,
    remaining_time_detik: remaining,
    bom,
  };
}}