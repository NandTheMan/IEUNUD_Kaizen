import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database with TPS Lab data (including Kanban Pull System)...');

  // 1. Clear existing data in reverse relation order
  await prisma.logLogistik.deleteMany();
  await prisma.logAndon.deleteMany();
  await prisma.logProdukNG.deleteMany();
  await prisma.logSiklusKanban.deleteMany();
  await prisma.stokLiveWorkstation.deleteMany();
  await prisma.targetProduksi.deleteMany();
  await prisma.antrianHeijunka.deleteMany(); // NEW Table
  await prisma.sesiPraktikum.deleteMany();
  await prisma.bomLangkah.deleteMany();
  await prisma.skenarioLangkahKerja.deleteMany();
  await prisma.skenarioWorkstationProduk.deleteMany(); // NEW Table
  await prisma.skenarioWorkstation.deleteMany();
  await prisma.skenarioGame.deleteMany();
  await prisma.produk.deleteMany();
  await prisma.workstation.deleteMany();
  await prisma.bahan.deleteMany();

  // 2. MASTER DATA - Bahan (Materials)
  const b_chassis = await prisma.bahan.create({ data: { nama_bahan: 'Chassis Utama', kuantitas_pack: 2, harga_satuan: 500000 } });
  const b_axle = await prisma.bahan.create({ data: { nama_bahan: 'Axle Depan/Belakang', kuantitas_pack: 4, harga_satuan: 150000 } });
  const b_roda = await prisma.bahan.create({ data: { nama_bahan: 'Roda Karet', kuantitas_pack: 4, harga_satuan: 75000 } });
  const b_baut = await prisma.bahan.create({ data: { nama_bahan: 'Baut 10mm', kuantitas_pack: 50, harga_satuan: 2000 } });
  const b_body_a = await prisma.bahan.create({ data: { nama_bahan: 'Body Tipe A (Standard)', kuantitas_pack: 1, harga_satuan: 300000 } });
  const b_body_b = await prisma.bahan.create({ data: { nama_bahan: 'Body Tipe B (Premium)', kuantitas_pack: 1, harga_satuan: 450000 } });

  // 3. MASTER DATA - Produk
  // NOTE: We force ID 99 for the Generic part so it matches the backend logic!
  const prodGeneric = await prisma.produk.create({ data: { id: 99, kode_produk: 'GENERIC', nama_produk: 'Generic Base Chassis' }});
  const prodA = await prisma.produk.create({ data: { id: 1, kode_produk: 'TYPE-A', nama_produk: 'Mobil Standard' }});
  const prodB = await prisma.produk.create({ data: { id: 2, kode_produk: 'TYPE-B', nama_produk: 'Mobil Premium' }});

  // 4. MASTER DATA - Workstations
  await prisma.workstation.createMany({
    data: [
      { id: 'WS1', nama_ws: 'Perakitan Chassis & Axle', tipe: 'ASSEMBLY' },
      { id: 'WS2', nama_ws: 'Perakitan Roda', tipe: 'ASSEMBLY' },
      { id: 'WS3', nama_ws: 'Pemasangan Body (Pacemaker)', tipe: 'ASSEMBLY' },
      { id: 'WS4', nama_ws: 'Quality Inspection', tipe: 'INSPECTION' },
    ],
  });

  // 5. SCENARIO SETUP
  const scenario = await prisma.skenarioGame.create({
    data: {
      nama_skenario: 'Baseline TPS - Supermarket Pull System',
      deskripsi: 'Simulasi Kanban Pull. WS3 menarik dari WS2. WS2 menarik dari WS1.',
    },
  });

  // Old WIP Limits (Overall workstation limits)
  await prisma.skenarioWorkstation.createMany({
    data: [
      { id_skenario: scenario.id, id_workstation: 'WS1', is_pacemaker: true },
      { id_skenario: scenario.id, id_workstation: 'WS2', is_pacemaker: false },
      { id_skenario: scenario.id, id_workstation: 'WS3', is_pacemaker: false },
      { id_skenario: scenario.id, id_workstation: 'WS4', is_pacemaker: false },
    ],
  });

  // NEW: Dynamic Product-Specific Safety Stock Targets!
  await prisma.skenarioWorkstationProduk.createMany({
    data: [
      { id_skenario: scenario.id, id_workstation: 'WS1', id_produk: 99, safety_stock: 2 }, // WS1 holds 2 generics
      { id_skenario: scenario.id, id_workstation: 'WS2', id_produk: 99, safety_stock: 2 }, // WS2 holds 2 generics
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 1, safety_stock: 2 },  // WS3 holds 2 Type-A
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 2, safety_stock: 2 },  // WS3 holds 2 Type-B
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 1, safety_stock: 1 },  // Inspect 1 at a time
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 2, safety_stock: 1 },
    ]
  });

  // 6. STEPS (Added WS1 and WS2 so the Simulator has text to display)
  const stepWs1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS1', urutan_langkah: 1, deskripsi_tugas: 'Rakit Chassis Utama dengan 2 Axle.', standard_time_detik: 20 }});
  const stepWs2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 1, deskripsi_tugas: 'Pasang 4 Roda pada Axle.', standard_time_detik: 25 }});
  const stepWs3A = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Pasang Body Standard pada rolling chassis.', standard_time_detik: 30 }});
  const stepWs3B = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Pasang Body Premium (Perlu Kalibrasi).', standard_time_detik: 50 }});
  const stepWs4A = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Inspeksi Visual & Fungsi untuk mobil standard.', standard_time_detik: 15 }});
  const stepWs4B = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Inspeksi Lengkap untuk mobil premium.', standard_time_detik: 20 }});

  // NEW: BOM for each step
  await prisma.bomLangkah.createMany({
    data: [
      // WS1: Rakit Chassis Utama
      { id_langkah: stepWs1.id, id_bahan: b_chassis.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs1.id, id_bahan: b_axle.id, qty_dibutuhkan: 2 },
      // WS2: Pasang 4 Roda
      { id_langkah: stepWs2.id, id_bahan: b_roda.id, qty_dibutuhkan: 4 },
      { id_langkah: stepWs2.id, id_bahan: b_baut.id, qty_dibutuhkan: 16 }, // 4 per roda
      // WS3: Pasang Body
      { id_langkah: stepWs3A.id, id_bahan: b_body_a.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3B.id, id_bahan: b_body_b.id, qty_dibutuhkan: 1 },
      // WS4: No materials used, just inspection
    ]
  });

  // 7. CREATE AN ACTIVE GAME SESSION TO PLAY IMMEDIATELY
  const activeSession = await prisma.sesiPraktikum.create({
    data: {
      id_skenario: scenario.id,
      status: 'ACTIVE',
    },
  });

  // 8. INITIALIZE FACTORY SAFETY STOCK
  // The factory floor is populated so WS3 can immediately pull from WS2, and WS2 from WS1.
  const safetyStockToInsert = [
    // WS1 is fully stocked with 2 Generic Chassis, tagged for initial products
    { id_sesi: activeSession.id, id_produk: 99, kode_produk: 'TYPE-A-000', id_workstation: 'WS1', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
    { id_sesi: activeSession.id, id_produk: 99, kode_produk: 'TYPE-B-000', id_workstation: 'WS1', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
    
    // WS2 is fully stocked with 2 Generic Rolling Chassis, tagged for initial products
    { id_sesi: activeSession.id, id_produk: 99, kode_produk: 'TYPE-A-001', id_workstation: 'WS2', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
    { id_sesi: activeSession.id, id_produk: 99, kode_produk: 'TYPE-B-001', id_workstation: 'WS2', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
    
    // WS3 has 1 Type-A and 1 Type-B ready to be inspected by WS4
    { id_sesi: activeSession.id, id_produk: 1, kode_produk: 'TYPE-A-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
    { id_sesi: activeSession.id, id_produk: 2, kode_produk: 'TYPE-B-002', id_workstation: 'WS3', status: 'DONE', langkah_sekarang: 1, waktu_mulai: new Date(), waktu_selesai: new Date() },
  ];

  await prisma.logSiklusKanban.createMany({
    data: safetyStockToInsert
  });

  console.log(`✅ Factory Initialized! Active Session ID is: ${activeSession.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });