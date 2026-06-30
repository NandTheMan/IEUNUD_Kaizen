import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
})

async function main() {
  console.log('Seeding database with TPS Lab data...');

  // 1. Clear existing data to prevent duplicates if you run this multiple times
  await prisma.logLogistik.deleteMany();
  await prisma.logAndon.deleteMany();
  await prisma.logSiklusKanban.deleteMany();
  await prisma.stokLiveWorkstation.deleteMany();
  await prisma.sesiPraktikum.deleteMany();
  await prisma.bomLangkah.deleteMany();
  await prisma.skenarioLangkahKerja.deleteMany();
  await prisma.skenarioWorkstation.deleteMany();
  await prisma.skenarioGame.deleteMany();
  await prisma.workstation.deleteMany();
  await prisma.bahan.deleteMany();

  // 2. MASTER DATA - Bahan (Materials)
  const b_chassis = await prisma.bahan.create({ data: { nama_bahan: 'Chassis Utama', kuantitas_pack: 2, harga_satuan: 500000 } });
  const b_axle = await prisma.bahan.create({ data: { nama_bahan: 'Axle Depan/Belakang', kuantitas_pack: 4, harga_satuan: 150000 } });
  const b_roda = await prisma.bahan.create({ data: { nama_bahan: 'Roda Karet', kuantitas_pack: 4, harga_satuan: 75000 } });
  const b_baut = await prisma.bahan.create({ data: { nama_bahan: 'Baut 10mm', kuantitas_pack: 50, harga_satuan: 2000 } });
  const b_body = await prisma.bahan.create({ data: { nama_bahan: 'Body Atas', kuantitas_pack: 1, harga_satuan: 300000 } });

  // 3. MASTER DATA - Workstations
  await prisma.workstation.createMany({
    data: [
      { id: 'WS1', nama_ws: 'Perakitan Chassis & Axle', tipe: 'ASSEMBLY' },
      { id: 'WS2', nama_ws: 'Perakitan Roda', tipe: 'ASSEMBLY' },
      { id: 'WS3', nama_ws: 'Pemasangan Body', tipe: 'ASSEMBLY' },
      { id: 'WS4', nama_ws: 'Quality Inspection', tipe: 'INSPECTION' },
      { id: 'WAREHOUSE', nama_ws: 'Gudang Logistik', tipe: 'LOGISTICS' },
    ],
  });

  // 4. SCENARIO SETUP - 4 Workstation Baseline
  const scenario = await prisma.skenarioGame.create({
    data: {
      nama_skenario: 'Baseline TPS - 4 Workstations',
      deskripsi: 'Simulasi awal sebelum Kaizen. Sering terjadi bottleneck di WS1.',
    },
  });

  await prisma.skenarioWorkstation.createMany({
    data: [
      { id_skenario: scenario.id, id_workstation: 'WS1', wip_limit: 2 },
      { id_skenario: scenario.id, id_workstation: 'WS2', wip_limit: 2 },
      { id_skenario: scenario.id, id_workstation: 'WS3', wip_limit: 2 },
      { id_skenario: scenario.id, id_workstation: 'WS4', wip_limit: 1 },
    ],
  });

  // 5. STEPS & BOM (Bill of Materials)
  const step1 = await prisma.skenarioLangkahKerja.create({
    data: { id_skenario: scenario.id, id_workstation: 'WS1', urutan_langkah: 1, deskripsi_tugas: 'Rakit 2 Axle ke Chassis Utama', standard_time_detik: 45 },
  });
  await prisma.bomLangkah.createMany({
    data: [
      { id_langkah: step1.id, id_bahan: b_chassis.id, qty_dibutuhkan: 1 },
      { id_langkah: step1.id, id_bahan: b_axle.id, qty_dibutuhkan: 2 },
      { id_langkah: step1.id, id_bahan: b_baut.id, qty_dibutuhkan: 8 },
    ],
  });

  const step2 = await prisma.skenarioLangkahKerja.create({
    data: { id_skenario: scenario.id, id_workstation: 'WS2', urutan_langkah: 1, deskripsi_tugas: 'Pasang 4 Roda ke Axle', standard_time_detik: 45 },
  });
  await prisma.bomLangkah.createMany({
    data: [
      { id_langkah: step2.id, id_bahan: b_roda.id, qty_dibutuhkan: 4 },
      { id_langkah: step2.id, id_bahan: b_baut.id, qty_dibutuhkan: 16 },
    ],
  });

  // 6. LIVE SESSION DATA (Creating a completed game session)
  const pastSession = await prisma.sesiPraktikum.create({
    data: {
      id_skenario: scenario.id,
      waktu_mulai: new Date(Date.now() - 1000 * 60 * 60 * 2), // Started 2 hours ago
      waktu_selesai: new Date(Date.now() - 1000 * 60 * 30),  // Finished 30 mins ago
      status: 'COMPLETED',
    },
  });

  // Insert Mock Live Stock for that session
  await prisma.stokLiveWorkstation.createMany({
    data: [
      { id_sesi: pastSession.id, id_workstation: 'WS1', id_bahan: b_chassis.id, stok_sekarang: 5, safety_stock_threshold: 2 },
      { id_sesi: pastSession.id, id_workstation: 'WS2', id_bahan: b_roda.id, stok_sekarang: 12, safety_stock_threshold: 4 },
    ]
  });

  // 7. SIMULATE OEE DATA (Lots of logs for your charts)
  const baseTime = pastSession.waktu_mulai.getTime();
  
  // Create Cycle Times (Performance Metric)
  for (let i = 1; i <= 15; i++) {
    const isRework = i === 4 || i === 9; // Simulate a few reworks
    await prisma.logSiklusKanban.create({
      data: {
        id_sesi: pastSession.id,
        kode_produk: `CAR-${String(i).padStart(3, '0')}`,
        id_workstation: 'WS1',
        waktu_mulai: new Date(baseTime + (i * 1000 * 100)), // Slowed down WS1 (bottleneck)
        waktu_selesai: new Date(baseTime + (i * 1000 * 100) + 138000), // 138 seconds as per proposal!
        status: isRework ? 'REWORK' : 'DONE',
      },
    });
  }

  // Create Downtime/Andon events (Availability & Quality Metrics)
  await prisma.logAndon.createMany({
    data: [
      {
        id_sesi: pastSession.id,
        id_workstation: 'WS1',
        jenis_gangguan: 'DEFECT_MATERIAL',
        waktu_lapor: new Date(baseTime + 1000 * 60 * 15),
        waktu_selesai: new Date(baseTime + 1000 * 60 * 18), // 3 minutes downtime
        id_bahan_dibuang: b_chassis.id,
        qty_dibuang: 1, // Defect wasted 1 chassis
      },
      {
        id_sesi: pastSession.id,
        id_workstation: 'WS3',
        jenis_gangguan: 'MACHINE_DOWN',
        waktu_lapor: new Date(baseTime + 1000 * 60 * 45),
        waktu_selesai: new Date(baseTime + 1000 * 60 * 55), // 10 minutes downtime
      }
    ]
  });

  // Create Logistics Logs
  await prisma.logLogistik.create({
    data: {
      id_sesi: pastSession.id,
      id_workstation: 'WS1',
      id_bahan: b_chassis.id,
      qty_diminta: 2,
      waktu_diminta: new Date(baseTime + 1000 * 60 * 20),
      waktu_dipenuhi: new Date(baseTime + 1000 * 60 * 21), // Took 1 minute to fulfill
    }
  });

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });