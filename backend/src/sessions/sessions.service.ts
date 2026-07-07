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

    return this.prisma.sesiPraktikum.update({
      where: { id: activeSession.id },
      data: {
        status: 'COMPLETED',
        waktu_selesai: new Date(),
      },
    });
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
      // Note: standard_time_detik requires joining SkenarioLangkahKerja if you want it dynamic!
      standard_time_detik: 120,
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
      };
    });

    this.eventsGateway.broadcastKanbanUpdate();
    return result;
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
          nama_bahan: b.bahan.nama_bahan,
          qty_dibutuhkan: b.qty_dibutuhkan,
        })) || [];

        return {
          action: 'NEXT',
          kode_produk: activeWip.kode_produk,
          nama_produk: activeWip.produk.nama_produk,
          langkah_sekarang: nextStepNum,
          total_langkah: maxSteps,
          deskripsi_tugas: stepDetails?.deskripsi_tugas || `Langkah ${nextStepNum}`,
          message: `Lanjut ke langkah ${nextStepNum}/${maxSteps}`,
          bom: bomForStep,
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

    // No active WIP, so we are pulling new work.

    const wsConfig = await tx.skenarioWorkstation.findFirst({
      where: { id_skenario: session.id_skenario, id_workstation: wsId },
    });
    if (!wsConfig) {
      throw new BadRequestException(`Konfigurasi untuk ${wsId} tidak ditemukan di skenario ini.`);
    }

    if (wsConfig.is_pacemaker) {
      // PACEMAKER LOGIC (e.g., WS3)
      // Reads the Heijunka queue and creates a new GENERIC part tagged for a specific final product.
      const nextInQueue = await tx.antrianHeijunka.findFirst({
        where: { id_sesi: sessionId, status: 'QUEUED' },
        orderBy: { urutan: 'asc' },
        include: { produk: true },
      });
      if (!nextInQueue) throw new BadRequestException('Antrian Heijunka kosong! Tidak ada pesanan.');

      // Check safety stock for the GENERIC product that WS1 produces.
      const productLimit = await tx.skenarioWorkstationProduk.findFirst({
        where: { id_skenario: session.id_skenario, id_workstation: wsId, id_produk: 99 },
      });
      if (productLimit) {
        const currentStock = await tx.logSiklusKanban.count({
          where: { id_sesi: sessionId, id_workstation: wsId, status: 'DONE', id_produk: 99 },
        });
        if (currentStock >= productLimit.safety_stock) {
          throw new BadRequestException(`Safety stock di ${wsId} untuk produk generik penuh.`);
        }
      }

      // All checks passed. Atomically claim the Heijunka ticket and create the new physical part.
      const claimedTicket = await tx.antrianHeijunka.updateMany({
        where: { id: nextInQueue.id, status: 'QUEUED' },
        data: { status: 'RELEASED' },
      });
      if (claimedTicket.count === 0) throw new BadRequestException('Item antrian baru saja diambil oleh proses lain.');

      // Create the new physical part log. It's a GENERIC part (id: 99)
      // but it carries the FINAL product's code for traceability.
      activeWip = await tx.logSiklusKanban.create({
        data: {
          id_sesi: sessionId,
          id_produk: 99, // Start by building a generic part
          kode_produk: nextInQueue.kode_produk, // But tag it with the final order code
          id_workstation: wsId,
          status: 'WIP',
          langkah_sekarang: 1,
          waktu_mulai: new Date(),
        },
        include: { produk: true },
      });

    } else {
      // NON-PACEMAKER LOGIC (WS2, WS3, WS4)
      // Pulls a finished part from the upstream station if its own output buffer is not full.
      
      const wsNumber = parseInt(wsId.replace('WS', ''));
      if (wsNumber <= 1) throw new Error('Non-pacemaker logic error: Should not apply to WS1.');
      const previousWsId = `WS${wsNumber - 1}`;

      // 1. Find the oldest available part from the upstream station's DONE stock.
      const availableStock = await tx.logSiklusKanban.findFirst({
        where: { id_sesi: sessionId, id_workstation: previousWsId, status: 'DONE' },
        orderBy: { waktu_selesai: 'asc' },
        include: { produk: true },
      });
      if (!availableStock) throw new BadRequestException(`Menunggu suplai dari ${previousWsId}.`);

      let finalProductId = availableStock.id_produk;
      let finalProductKode = availableStock.kode_produk;
      let finalProductInfo = availableStock.produk;

      // 2. If this is the transformation station (WS3), determine the final product ID.
      if (wsId === 'WS3') {
        const codeParts = availableStock.kode_produk.split('-');
        const baseCode = codeParts.slice(0, -1).join('-'); // Handles 'TYPE-A-001' -> 'TYPE-A'
        const targetProduct = await tx.produk.findFirst({ where: { kode_produk: baseCode } });
        if (!targetProduct) throw new BadRequestException(`Produk final untuk kode ${baseCode} tidak ditemukan.`);
        
        finalProductId = targetProduct.id;
        finalProductInfo = targetProduct;
      }

      // 3. Check the safety stock for the product this station is about to have.
      // This is the PULL SIGNAL: we only pull if we have space in our output buffer.
      const productLimit = await tx.skenarioWorkstationProduk.findFirst({
        where: { id_skenario: session.id_skenario, id_workstation: wsId, id_produk: finalProductId },
      });
      if (productLimit) {
        const currentStock = await tx.logSiklusKanban.count({
          where: { id_sesi: sessionId, id_workstation: wsId, status: 'DONE', id_produk: finalProductId },
        });
        if (currentStock >= productLimit.safety_stock) {
          throw new BadRequestException(`Safety stock di ${wsId} untuk produk ${finalProductKode} penuh.`);
        }
      }

      // 4. All checks passed. Atomically claim the upstream part.
      const claimedStock = await tx.logSiklusKanban.updateMany({
        where: { id: availableStock.id, status: 'DONE' },
        data: {
          id_produk: finalProductId, // This applies the transformation at WS3
          id_workstation: wsId,
          status: 'WIP',
          langkah_sekarang: 1,
          waktu_mulai: new Date(),
          waktu_selesai: null,
        },
      });
      if (claimedStock.count === 0) throw new BadRequestException('Komponen baru saja diambil oleh proses lain.');

      // Set activeWip to the newly claimed item to fetch its steps
      activeWip = { 
        ...availableStock, 
        id_produk: finalProductId, 
        produk: finalProductInfo,
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
      nama_bahan: b.bahan.nama_bahan,
      qty_dibutuhkan: b.qty_dibutuhkan,
    })) || [];

    const productInfo = await tx.produk.findUniqueOrThrow({
      where: { id: activeWip.id_produk }
    });

    return {
      action: 'START',
      kode_produk: activeWip.kode_produk,
      nama_produk: productInfo.nama_produk,
      langkah_sekarang: 1,
      total_langkah: totalSteps > 0 ? totalSteps : 1,
      deskripsi_tugas: stepDetails?.deskripsi_tugas || 'Langkah 1',
      message: `${wsId} mulai mengerjakan ${activeWip.kode_produk}`,
      bom: bomForStep,
    };
  });

  this.eventsGateway.broadcastKanbanUpdate();
  return result;
}

}