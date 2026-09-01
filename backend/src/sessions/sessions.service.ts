import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
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
          // WS1 has finished generic parts, ready for WS2
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'GEN-001', id_workstation: 'WS1', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'GEN-002', id_workstation: 'WS1', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          
          // WS2 has finished rolling chassis, ready for WS3
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'GEN-003', id_workstation: 'WS2', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 99, kode_produk: 'GEN-004', id_workstation: 'WS2', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          
          // WS3 has 2 of each finished product, ready for WS4
          { id_sesi: newSession.id, id_produk: 1, kode_produk: 'F/A-001-001', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          // { id_sesi: newSession.id, id_produk: 1, kode_produk: 'F/A-001-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 2, kode_produk: 'A-002-001', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          // { id_sesi: newSession.id, id_produk: 2, kode_produk: 'A-002-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 3, kode_produk: 'F/A-003-001', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          // { id_sesi: newSession.id, id_produk: 3, kode_produk: 'F/A-003-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },

          // WS4 also has 2 of each finished product, representing the final supermarket stock
          { id_sesi: newSession.id, id_produk: 1, kode_produk: 'F/A-001-003', id_workstation: 'WS4', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          // { id_sesi: newSession.id, id_produk: 1, kode_produk: 'F/A-001-004', id_workstation: 'WS4', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 2, kode_produk: 'A-002-003', id_workstation: 'WS4', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          // { id_sesi: newSession.id, id_produk: 2, kode_produk: 'A-002-004', id_workstation: 'WS4', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          { id_sesi: newSession.id, id_produk: 3, kode_produk: 'F/A-003-003', id_workstation: 'WS4', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
          // { id_sesi: newSession.id, id_produk: 3, kode_produk: 'F/A-003-004', id_workstation: 'WS4', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
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

  async getPullSignalStatus(sessionId: number, wsId: string) {
    const count = await this.prisma.logSiklusKanban.count({
      where: { id_sesi: sessionId, id_workstation: wsId, status: 'QUEUE' },
    });
    return { count, hasPullSignal: count > 0 };
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

      // Define the production priority: PickUp (1) -> MPV (3) -> D-Cab (2)
      const priorityOrder = [1, 3, 2];

      // Sort the items to be sequenced based on the defined priority
      remainingToSequence.sort((a, b) => {
        const priorityA = priorityOrder.indexOf(a.id_produk);
        const priorityB = priorityOrder.indexOf(b.id_produk);
        
        // If a product is not in the priority list, it gets lowest priority
        if (priorityA === -1) return 1;
        if (priorityB === -1) return -1;

        return priorityA - priorityB;
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

  async getOEEMetrics(sessionId: number) {
    const session = await this.prisma.sesiPraktikum.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    const sessionEnd = session.waktu_selesai ?? new Date();
    const plannedTimeSeconds = (sessionEnd.getTime() - session.waktu_mulai.getTime()) / 1000;

    // Ideal cycle times per workstation+product, scoped to this scenario
    const standardTimes = await this.prisma.skenarioWorkstationProduk.findMany({
      where: { id_skenario: session.id_skenario },
    });
    const stdTimeMap = new Map<string, number>();
    standardTimes.forEach(st =>
      stdTimeMap.set(`${st.id_workstation}-${st.id_produk}`, st.total_waktu_standar_detik ?? 0)
    );

    const pacemaker = await this.prisma.skenarioWorkstation.findFirst({
      where: { id_skenario: session.id_skenario, is_pacemaker: true },
    });
    const pacemakerId = pacemaker?.id_workstation ?? null;

    // Exclude LOGISTICS stations — they supply material, they don't "produce"
    const workstations = await this.prisma.workstation.findMany({
      where: { tipe: { not: 'LOGISTICS' } },
      orderBy: { id: 'asc' },
    });

    const completedCycles = await this.prisma.logSiklusKanban.findMany({
      where: { id_sesi: sessionId, waktu_selesai: { not: null } },
      select: { id_workstation: true, id_produk: true },
    });

    const ngLogs = await this.prisma.logProdukNG.groupBy({
      by: ['id_workstation'],
      where: { id_sesi: sessionId },
      _count: { id_workstation: true },
    });
    const ngMap = new Map(ngLogs.map(n => [n.id_workstation, n._count.id_workstation]));

    const andonLogs = await this.prisma.logAndon.findMany({
      where: { id_sesi: sessionId },
      select: { id_workstation: true, waktu_lapor: true, waktu_selesai: true },
    });
    const downtimeMap = new Map<string, number>();
    andonLogs.forEach(log => {
      const end = log.waktu_selesai ?? sessionEnd;
      const dur = Math.max((end.getTime() - log.waktu_lapor.getTime()) / 1000, 0);
      downtimeMap.set(log.id_workstation, (downtimeMap.get(log.id_workstation) ?? 0) + dur);
    });

    const oee_per_workstation = workstations.map(ws => {
      const wsCycles = completedCycles.filter(c => c.id_workstation === ws.id);
      const totalCount = wsCycles.length;
      const ngCount = ngMap.get(ws.id) ?? 0;
      const goodCount = Math.max(totalCount - ngCount, 0);

      // Sum of ideal time per unit actually processed (handles mixed-model lines correctly)
      const idealTimeSum = wsCycles.reduce(
        (sum, c) => sum + (stdTimeMap.get(`${ws.id}-${c.id_produk}`) ?? 0),
        0
      );

      const downtime = downtimeMap.get(ws.id) ?? 0;
      const runTime = Math.max(plannedTimeSeconds - downtime, 0);

      const availability = plannedTimeSeconds > 0 ? runTime / plannedTimeSeconds : 0;
      const performance = runTime > 0 ? Math.min(idealTimeSum / runTime, 1) : 0;
      const quality = totalCount > 0 ? goodCount / totalCount : 0;

      return {
        id_workstation: ws.id,
        nama_ws: ws.nama_ws,
        is_pacemaker: ws.id === pacemakerId,
        downtime_sec: Math.round(downtime),
        run_time_sec: Math.round(runTime),
        total_count: totalCount,
        good_count: goodCount,
        ng_count: ngCount,
        availability,
        performance,
        quality,
        oee: availability * performance * quality,
      };
    });

    const line = pacemakerId ? oee_per_workstation.find(m => m.id_workstation === pacemakerId) : null;

    return {
      sessionId,
      planned_time_sec: Math.round(plannedTimeSeconds),
      pacemaker_workstation: pacemakerId,
      line_oee: line
        ? { availability: line.availability, performance: line.performance, quality: line.quality, oee: line.oee }
        : null, // null if no is_pacemaker was ever set for this scenario — flag this in UI, don't silently guess
      oee_per_workstation,
    };
  }

  async getSessionSummary(sessionId: number) {
    // 1. Fetch Session, Targets, and Workstations
    const session = await this.prisma.sesiPraktikum.findUnique({
      where: { id: sessionId },
      include: {
        target_produksi: { include: { produk: true } }
      }
    });

    if (!session) throw new NotFoundException('Session not found');

    const workstations = await this.prisma.workstation.findMany({
      orderBy: { id: 'asc' }
    });

    // Calculate Duration
    const endTime = session.waktu_selesai ? session.waktu_selesai.getTime() : Date.now();
    const durationMinutes = Math.round((endTime - session.waktu_mulai.getTime()) / 60000);

    // 2. Count Shipped Products (From LogSiklusKanban)
    const shippedCounts = await this.prisma.logSiklusKanban.groupBy({
      by: ['id_produk'],
      where: { 
        id_sesi: sessionId, 
        status: 'SHIPPED' 
      },
      _count: { id_produk: true }
    });

    // 3. Count WIP Products (Everything on the floor that isn't shipped)
    const wipCounts = await this.prisma.logSiklusKanban.groupBy({
      by: ['id_produk'],
      where: { 
        id_sesi: sessionId, 
        status: { not: 'SHIPPED' } 
      },
      _count: { id_produk: true }
    });

    // 4. Count NG Products (From LogProdukNG)
    const ngCounts = await this.prisma.logProdukNG.groupBy({
      by: ['id_produk'],
      where: { id_sesi: sessionId },
      _count: { id_produk: true }
    });

    // 5. Map Results against Targets
    const production_results = session.target_produksi.map(target => {
      const shippedMatch = shippedCounts.find(s => s.id_produk === target.id_produk);
      const wipMatch = wipCounts.find(w => w.id_produk === target.id_produk);
      const ngMatch = ngCounts.find(n => n.id_produk === target.id_produk);

      return {
        id_produk: target.id_produk,
        nama_produk: target.produk.nama_produk,
        target_qty: target.target_qty,
        qty_shipped: shippedMatch ? shippedMatch._count.id_produk : 0,
        qty_wip: wipMatch ? wipMatch._count.id_produk : 0,
        qty_ng: ngMatch ? ngMatch._count.id_produk : 0,
      };
    });

    // 6. Aggregate Workstation Health Metrics
    const andonWsCounts = await this.prisma.logAndon.groupBy({
      by: ['id_workstation'],
      where: { id_sesi: sessionId },
      _count: { id_workstation: true }
    });

    const logistikWsCounts = await this.prisma.logLogistik.groupBy({
      by: ['id_workstation'],
      where: { id_sesi: sessionId },
      _count: { id_workstation: true }
    });

    const workstation_metrics = workstations.map(ws => {
      const andonMatch = andonWsCounts.find(a => a.id_workstation === ws.id);
      const logistikMatch = logistikWsCounts.find(l => l.id_workstation === ws.id);
      
      return {
        id_workstation: ws.id,
        nama_ws: ws.nama_ws,
        total_andon: andonMatch ? andonMatch._count.id_workstation : 0,
        total_logistik: logistikMatch ? logistikMatch._count.id_workstation : 0,
      };
    });

    // 7. Count Total Factory Events
    const total_andon_alerts = andonWsCounts.reduce((acc, curr) => acc + curr._count.id_workstation, 0);
    const total_logistics_requests = logistikWsCounts.reduce((acc, curr) => acc + curr._count.id_workstation, 0);

    return {
      sessionId,
      waktu_mulai: session.waktu_mulai,
      waktu_selesai: session.waktu_selesai,
      duration_minutes: durationMinutes,
      production_results,
      workstation_metrics, // Now perfectly matching the frontend requirement
      total_andon_alerts,
      total_logistics_requests
    };
  }

  async getCycleLog(sessionId: number) {
    const session = await this.prisma.sesiPraktikum.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    const standardTimes = await this.prisma.skenarioWorkstationProduk.findMany({
      where: { id_skenario: session.id_skenario },
    });
    const stdMap = new Map<string, number>();
    standardTimes.forEach(st =>
      stdMap.set(`${st.id_workstation}-${st.id_produk}`, st.total_waktu_standar_detik ?? 0)
    );

    const cycles = await this.prisma.logSiklusKanban.findMany({
      where: { id_sesi: sessionId, waktu_selesai: { not: null } },
      include: { produk: true, workstation: true },
      orderBy: { waktu_mulai: 'asc' },
    });

    return cycles.map(c => {
      const actualSec = c.waktu_selesai
        ? Math.round((c.waktu_selesai.getTime() - c.waktu_mulai.getTime()) / 1000)
        : null;
      const key = `${c.id_workstation}-${c.id_produk}`;
      const standardSec = stdMap.has(key) ? stdMap.get(key)! : null; // null = no standard configured, not zero
      const varianceSec = actualSec != null && standardSec != null ? actualSec - standardSec : null;

      return {
        id: c.id,
        id_workstation: c.id_workstation,
        nama_ws: c.workstation.nama_ws,
        kode_produk: c.kode_produk,
        nama_produk: c.produk.nama_produk,
        waktu_mulai: c.waktu_mulai,
        waktu_selesai: c.waktu_selesai,
        actual_sec: actualSec,
        standard_sec: standardSec,
        variance_sec: varianceSec, // positive = over standard, negative = under/faster
      };
    });
  }

  async generateExcelReport(sessionId: number, res: Response) {
    const summary = await this.getSessionSummary(sessionId);
    const oeeData = await this.getOEEMetrics(sessionId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TPS Smart Lab System';
    workbook.created = new Date();

    // Standard OEE convention: 85%+ world-class, 60-85% typical, <60% needs attention
    const bandFill = (v: number) => (v >= 0.85 ? 'FFC6EFCE' : v >= 0.6 ? 'FFFFEB9C' : 'FFFFC7CE');
    const bandFont = (v: number) => (v >= 0.85 ? 'FF006100' : v >= 0.6 ? 'FF9C6500' : 'FF9C0006');

    const applyOeeStyle = (cell: ExcelJS.Cell, value: number) => {
      cell.numFmt = '0.0%';
      cell.alignment = { horizontal: 'center' };
      cell.font = { color: { argb: bandFont(value) }, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bandFill(value) } };
    };

    // ---------------------------------------------------------
    // SHEET 1: Ringkasan OEE (headline scorecard)
    // ---------------------------------------------------------
    const oeeSheet = workbook.addWorksheet('Ringkasan OEE');
    oeeSheet.columns = [{ width: 32 }, { width: 20 }];

    oeeSheet.mergeCells('A1:B1');
    oeeSheet.getCell('A1').value = `Laporan OEE — Sesi #${sessionId}`;
    oeeSheet.getCell('A1').font = { size: 16, bold: true };

    oeeSheet.addRow([]);
    oeeSheet.addRow(['Waktu Mulai', summary.waktu_mulai]);
    oeeSheet.addRow(['Waktu Selesai', summary.waktu_selesai || 'Belum Selesai']);
    oeeSheet.addRow(['Durasi (Menit)', summary.duration_minutes]);
    oeeSheet.addRow([]);

    if (oeeData.line_oee) {
      const pacemakerWs = oeeData.oee_per_workstation.find(w => w.is_pacemaker);
      oeeSheet.addRow(['Stasiun Pacemaker', `${pacemakerWs?.id_workstation} — ${pacemakerWs?.nama_ws}`]);
      oeeSheet.addRow([]);

      oeeSheet.addRow(['Metrik Line OEE (dari Pacemaker)', 'Nilai']).font = { bold: true };

      const rows: [string, number][] = [
        ['Availability', oeeData.line_oee.availability],
        ['Performance', oeeData.line_oee.performance],
        ['Quality', oeeData.line_oee.quality],
        ['LINE OEE', oeeData.line_oee.oee],
      ];
      rows.forEach(([label, value], i) => {
        const row = oeeSheet.addRow([label, value]);
        if (i === rows.length - 1) row.font = { bold: true, size: 12 };
        applyOeeStyle(row.getCell(2), value);
      });
    } else {
      oeeSheet.addRow(['⚠ Tidak ada stasiun pacemaker diset untuk skenario ini.']);
      oeeSheet.addRow(['Line OEE tidak dapat dihitung — lihat rincian per-stasiun di sheet berikutnya.']);
    }

    // ---------------------------------------------------------
    // SHEET 2: OEE per Stasiun Kerja
    // ---------------------------------------------------------
    const wsSheet = workbook.addWorksheet('OEE per Stasiun');
    wsSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nama Stasiun', key: 'nama', width: 25 },
      { header: 'Pacemaker', key: 'pace', width: 12 },
      { header: 'Total Unit', key: 'total', width: 12 },
      { header: 'Unit Baik', key: 'good', width: 12 },
      { header: 'Unit NG', key: 'ng', width: 10 },
      { header: 'Downtime (dtk)', key: 'downtime', width: 15 },
      { header: 'Availability', key: 'avail', width: 14 },
      { header: 'Performance', key: 'perf', width: 14 },
      { header: 'Quality', key: 'qual', width: 14 },
      { header: 'OEE', key: 'oee', width: 14 },
    ];
    wsSheet.getRow(1).font = { bold: true };
    wsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    oeeData.oee_per_workstation.forEach(ws => {
      const row = wsSheet.addRow({
        id: ws.id_workstation, nama: ws.nama_ws, pace: ws.is_pacemaker ? '★ YA' : '',
        total: ws.total_count, good: ws.good_count, ng: ws.ng_count, downtime: ws.downtime_sec,
        avail: ws.availability, perf: ws.performance, qual: ws.quality, oee: ws.oee,
      });
      ['avail', 'perf', 'qual', 'oee'].forEach(key =>
        applyOeeStyle(row.getCell(key), row.getCell(key).value as number)
      );
      if (ws.is_pacemaker) row.getCell('nama').font = { bold: true };
    });

    // ---------------------------------------------------------
    // SHEET 3: Hasil Produksi (kept, now with capaian %)
    // ---------------------------------------------------------
    const prodSheet = workbook.addWorksheet('Hasil Produksi');
    prodSheet.columns = [
      { header: 'ID Produk', key: 'id', width: 10 },
      { header: 'Nama Produk', key: 'nama', width: 30 },
      { header: 'Target QTY', key: 'target', width: 15 },
      { header: 'Shipped', key: 'shipped', width: 15 },
      { header: 'WIP', key: 'wip', width: 12 },
      { header: 'NG', key: 'ng', width: 12 },
      { header: 'Capaian', key: 'capaian', width: 15 },
    ];
    prodSheet.getRow(1).font = { bold: true };

    summary.production_results.forEach(prod => {
      const capaian = prod.target_qty > 0 ? prod.qty_shipped / prod.target_qty : 0;
      const row = prodSheet.addRow({
        id: prod.id_produk, nama: prod.nama_produk, target: prod.target_qty,
        shipped: prod.qty_shipped, wip: prod.qty_wip, ng: prod.qty_ng, capaian,
      });
      row.getCell('capaian').numFmt = '0.0%';
    });

    // ---------------------------------------------------------
    // SHEET 4: Log Andon (raw traceability, for drill-down)
    // ---------------------------------------------------------
    const andonSheet = workbook.addWorksheet('Log Andon');
    andonSheet.columns = [
      { header: 'Stasiun', key: 'ws', width: 22 },
      { header: 'Jenis Gangguan', key: 'jenis', width: 25 },
      { header: 'Waktu Lapor', key: 'mulai', width: 22 },
      { header: 'Waktu Selesai', key: 'selesai', width: 22 },
      { header: 'Durasi (dtk)', key: 'durasi', width: 15 },
    ];
    andonSheet.getRow(1).font = { bold: true };

    const rawAndon = await this.prisma.logAndon.findMany({
      where: { id_sesi: sessionId },
      include: { workstation: true },
      orderBy: { waktu_lapor: 'asc' },
    });
    rawAndon.forEach(log => {
      const end = log.waktu_selesai ?? new Date();
      andonSheet.addRow({
        ws: `${log.id_workstation} — ${log.workstation.nama_ws}`,
        jenis: log.jenis_gangguan,
        mulai: log.waktu_lapor,
        selesai: log.waktu_selesai ?? 'Belum Selesai',
        durasi: Math.round((end.getTime() - log.waktu_lapor.getTime()) / 1000),
      });
    });

    // ---------------------------------------------------------
    // SHEET 5: Log Siklus Detail (per-unit start/finish vs standard)
    // ---------------------------------------------------------
    const cycleLog = await this.getCycleLog(sessionId);
    const cycleSheet = workbook.addWorksheet('Log Siklus Detail');
    cycleSheet.columns = [
      { header: 'Stasiun', key: 'ws', width: 22 },
      { header: 'Produk', key: 'produk', width: 25 },
      { header: 'Waktu Mulai', key: 'mulai', width: 22 },
      { header: 'Waktu Selesai', key: 'selesai', width: 22 },
      { header: 'Durasi Aktual (dtk)', key: 'aktual', width: 18 },
      { header: 'Standar (dtk)', key: 'standar', width: 15 },
      { header: 'Selisih (dtk)', key: 'selisih', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    cycleSheet.getRow(1).font = { bold: true };
    cycleSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    cycleLog.forEach(c => {
      const status = c.standard_sec == null
        ? 'Tanpa Standar'
        : c.variance_sec! > 0 ? 'Lebih Lambat' : 'Sesuai/Lebih Cepat';

      const row = cycleSheet.addRow({
        ws: `${c.id_workstation} — ${c.nama_ws}`,
        produk: `${c.kode_produk} — ${c.nama_produk}`,
        mulai: c.waktu_mulai,
        selesai: c.waktu_selesai,
        aktual: c.actual_sec,
        standar: c.standard_sec ?? '—',
        selisih: c.variance_sec ?? '—',
        status,
      });

      if (c.standard_sec != null) {
        const over = c.variance_sec! > 0;
        row.getCell('selisih').font = { bold: true, color: { argb: over ? 'FF9C0006' : 'FF006100' } };
        row.getCell('status').font = { color: { argb: over ? 'FF9C0006' : 'FF006100' } };
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=laporan-sesi-${sessionId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
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
          gambar_utama_url: stepDetails?.gambar_utama_url,
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
      gambar_utama_url: stepDetails?.gambar_utama_url,
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
    gambar_utama_url: stepDetails?.gambar_utama_url,
    bom,
  };
}}