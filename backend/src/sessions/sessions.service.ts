import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Assuming you have a PrismaService

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

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
        status: 'QUEUED'
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

    return this.prisma.$transaction(async (tx) => {
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

  return this.prisma.$transaction(async (tx) => {
    // ====================================================================
    // 1. CHECK FOR ACTIVE WORK (WIP) — unchanged
    // ====================================================================
    const activeWip = await tx.logSiklusKanban.findFirst({
      where: { id_sesi: sessionId, id_workstation: wsId, status: 'WIP' },
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
          where: { id_skenario: session.id_skenario, id_produk: activeWip.id_produk, id_workstation: wsId, urutan_langkah: nextStepNum }
        });

        return {
          action: 'NEXT',
          kode_produk: activeWip.kode_produk,
          langkah_sekarang: nextStepNum,
          total_langkah: maxSteps,
          deskripsi_tugas: stepDetails?.deskripsi_tugas || `Langkah ${nextStepNum}`,
          message: `Lanjut ke langkah ${nextStepNum}/${maxSteps}`,
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
    // 2. LOOK UP THIS STATION'S CONFIG — now used for is_pacemaker instead
    //    of a wip_limit that no longer exists on this model.
    // ====================================================================
    const wsConfig = await tx.skenarioWorkstation.findFirst({
      where: { id_skenario: session.id_skenario, id_workstation: wsId },
    });
    if (!wsConfig) {
      throw new BadRequestException(`Konfigurasi untuk ${wsId} tidak ditemukan di skenario ini.`);
    }
    const isPacemaker = wsConfig.is_pacemaker;

    // ====================================================================
    // 3. CHECK FOR VISUAL QUEUE TICKET (ghost ticket left by a downstream pull)
    // ====================================================================
    const pendingVisualQueue = await tx.logSiklusKanban.findFirst({
      where: { id_sesi: sessionId, id_workstation: wsId, status: 'QUEUE' },
      orderBy: { id: 'asc' }
    });

    // ====================================================================
    // 4. PEEK the candidate item (don't claim yet) — we need to know which
    //    product it is *before* checking the safety-stock gate, since the
    //    limit is now per-product (SkenarioWorkstationProduk) rather than
    //    a single flat number per station.
    // ====================================================================
    let idProduk: number;
    let kodeProduk: string;
    let sourceLogId: number | null = null;
    let sourceStatus: string | null = null;
    let previousWsId: string | null = null;

    if (isPacemaker) {
      // ----------------------------------------------------
      // PACEMAKER: The Digital -> Physical release point
      // ----------------------------------------------------
      const nextInQueue = await tx.antrianHeijunka.findFirst({
        where: { id_sesi: sessionId, status: 'QUEUED' },
        orderBy: { urutan: 'asc' },
      });
      if (!nextInQueue) throw new BadRequestException('Antrian Heijunka kosong! Tidak ada pesanan.');

      idProduk = nextInQueue.id_produk;
      kodeProduk = nextInQueue.kode_produk;

      if (pendingVisualQueue) {
        sourceLogId = pendingVisualQueue.id;
        sourceStatus = 'QUEUE';
      }

      // Claim the heijunka ticket now (safe to do before the gate check,
      // since this ticket is *this station's* input, not its output — the
      // gate below only cares about this station's own DONE buffer).
      const claimedTicket = await tx.antrianHeijunka.updateMany({
        where: { id: nextInQueue.id, status: 'QUEUED' },
        data: { status: 'RELEASED' },
      });
      if (claimedTicket.count === 0) {
        throw new BadRequestException('Item antrian baru saja diambil oleh proses lain, coba lagi.');
      }
    } else {
      // ----------------------------------------------------
      // SUPERMARKET STATION: Physical -> Physical pull
      // ----------------------------------------------------
      // NOTE: still derives the previous station from the "WSn" naming
      // convention — is_pacemaker fixes the pacemaker check, but there's
      // still no explicit ordering field for "who feeds whom" downstream.
      const wsNumber = parseInt(wsId.replace('WS', ''));
      previousWsId = `WS${wsNumber - 1}`;

      const availableStock = await tx.logSiklusKanban.findFirst({
        where: { id_sesi: sessionId, id_workstation: previousWsId, status: 'DONE' },
        orderBy: { waktu_selesai: 'asc' },
      });
      if (!availableStock) {
        throw new BadRequestException(`Menunggu suplai dari ${previousWsId}.`);
      }

      idProduk = availableStock.id_produk;
      kodeProduk = availableStock.kode_produk;
      sourceLogId = availableStock.id;
      sourceStatus = 'DONE';
    }

    // ====================================================================
    // 5. SAFETY STOCK GATE — per (skenario, workstation, produk) now
    // ====================================================================
    const productLimit = await tx.skenarioWorkstationProduk.findFirst({
      where: { id_skenario: session.id_skenario, id_workstation: wsId, id_produk: idProduk },
    });

    if (productLimit) {
      const currentStock = await tx.logSiklusKanban.count({
        where: { id_sesi: sessionId, id_workstation: wsId, status: 'DONE', id_produk: idProduk },
      });

      if (currentStock >= productLimit.safety_stock) {
        throw new BadRequestException(
          `${wsId} tidak bisa mulai — safety stock ${kodeProduk} penuh (${currentStock}/${productLimit.safety_stock}). Tunggu stasiun berikutnya menarik stok.`
        );
      }
    }

    // ====================================================================
    // 6. Ghost ticket for the supermarket path (unchanged from before,
    //    now placed after the gate so we don't leave a ghost ticket behind
    //    for a pull that then gets rejected by the safety-stock check).
    // ====================================================================
    if (!isPacemaker && previousWsId) {
      await tx.logSiklusKanban.create({
        data: {
          id_sesi: sessionId,
          id_produk: idProduk,
          kode_produk: kodeProduk,
          id_workstation: previousWsId,
          status: 'QUEUE',
          waktu_mulai: new Date(),
        }
      });
    }

    // ====================================================================
    // 7. CLAIM + INITIALIZE WORK — same atomic guarded transition as before
    // ====================================================================
    if (sourceLogId) {
      const claimed = await tx.logSiklusKanban.updateMany({
        where: { id: sourceLogId, status: sourceStatus! },
        data: {
          id_produk: idProduk,
          kode_produk: kodeProduk,
          id_workstation: wsId,
          status: 'WIP',
          langkah_sekarang: 1,
          waktu_mulai: new Date(),
          waktu_selesai: null,
        },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('Item baru saja diambil oleh proses lain, coba lagi.');
      }

      if (pendingVisualQueue && pendingVisualQueue.id !== sourceLogId) {
        await tx.logSiklusKanban.deleteMany({
          where: { id: pendingVisualQueue.id, status: 'QUEUE' },
        });
      }
    } else {
      await tx.logSiklusKanban.create({
        data: {
          id_sesi: sessionId,
          id_produk: idProduk,
          kode_produk: kodeProduk,
          id_workstation: wsId,
          status: 'WIP',
          langkah_sekarang: 1,
          waktu_mulai: new Date(),
        },
      });
    }

    const totalSteps = await tx.skenarioLangkahKerja.count({
      where: { id_skenario: session.id_skenario, id_produk: idProduk, id_workstation: wsId }
    });
    const stepDetails = await tx.skenarioLangkahKerja.findFirst({
      where: { id_skenario: session.id_skenario, id_produk: idProduk, id_workstation: wsId, urutan_langkah: 1 }
    });

    return {
      action: 'START',
      kode_produk: kodeProduk,
      langkah_sekarang: 1,
      total_langkah: totalSteps > 0 ? totalSteps : 1,
      deskripsi_tugas: stepDetails?.deskripsi_tugas || 'Langkah 1',
      message: `${wsId} mulai mengerjakan ${kodeProduk}`,
    };
  });  
    }

}