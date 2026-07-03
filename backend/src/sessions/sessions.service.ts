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
}
