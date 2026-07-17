import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Pastikan DATABASE_URL Anda ter-set di environment
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Master Data TPS Lab (Book1.pdf) - Tanpa Active Session...');

  // 1. Clear existing data in reverse relation order (Aman untuk di-run berulang kali)
  await prisma.logLogistik.deleteMany();
  await prisma.logAndon.deleteMany();
  await prisma.logProdukNG.deleteMany();
  await prisma.logSiklusKanban.deleteMany();
  await prisma.stokLiveWorkstation.deleteMany();
  await prisma.targetProduksi.deleteMany();
  await prisma.antrianHeijunka.deleteMany(); 
  await prisma.sesiPraktikum.deleteMany();
  await prisma.bomLangkah.deleteMany();
  await prisma.skenarioLangkahKerja.deleteMany();
  await prisma.skenarioWorkstationProduk.deleteMany(); 
  await prisma.skenarioWorkstation.deleteMany();
  await prisma.skenarioGame.deleteMany();
  await prisma.produk.deleteMany();
  await prisma.workstation.deleteMany();
  await prisma.bahan.deleteMany();

  // 2. MASTER DATA - Bahan (Materials) Berdasarkan Book1.pdf (Halaman 1-2)
  const b_chassis = await prisma.bahan.create({ data: { id: 1, nama_bahan: 'Chassis (12345-001)', kuantitas_pack: 2, harga_satuan: 150000 } });
  const b_axle = await prisma.bahan.create({ data: { id: 2, nama_bahan: 'Axle (12345-002)', kuantitas_pack: 10, harga_satuan: 25000 } });
  const b_axle_holder = await prisma.bahan.create({ data: { id: 3, nama_bahan: 'Axle Holder (12345-003)', kuantitas_pack: 8, harga_satuan: 10000 } });
  const b_short_bolt = await prisma.bahan.create({ data: { id: 4, nama_bahan: 'Short Bolt (12345-004)', kuantitas_pack: 20, harga_satuan: 500 } });
  
  const b_wheel = await prisma.bahan.create({ data: { id: 5, nama_bahan: 'Wheel (12345-005)', kuantitas_pack: 8, harga_satuan: 15000 } });
  const b_nut_wheel = await prisma.bahan.create({ data: { id: 6, nama_bahan: 'Nut Wheel (12345-006)', kuantitas_pack: 8, harga_satuan: 1000 } });
  
  const b_front_cabin = await prisma.bahan.create({ data: { id: 7, nama_bahan: 'Front Cabin (12345-007)', kuantitas_pack: 1, harga_satuan: 50000 } });
  const b_pu_cabin = await prisma.bahan.create({ data: { id: 8, nama_bahan: 'PU Cabin (12345-008)', kuantitas_pack: 2, harga_satuan: 40000 } });
  const b_rear_cabin = await prisma.bahan.create({ data: { id: 9, nama_bahan: 'Rear Cabin (12345-009)', kuantitas_pack: 2, harga_satuan: 45000 } });
  const b_center_cabin = await prisma.bahan.create({ data: { id: 10, nama_bahan: 'Center Cabin (12345-010)', kuantitas_pack: 2, harga_satuan: 45000 } });
  const b_long_bolt = await prisma.bahan.create({ data: { id: 11, nama_bahan: 'Long Bolt (12345-011)', kuantitas_pack: 4, harga_satuan: 1000 } });

  // 3. MASTER DATA - Produk (Berdasarkan 3 Varian di PDF)
  // ID 99 digunakan oleh WS1 & WS2 karena sasis dan roda sama untuk semua tipe mobil
  const prodGeneric = await prisma.produk.create({ data: { id: 99, kode_produk: 'GENERIC', nama_produk: 'Generic Rolling Chassis' }});
  
  const prodPickUp = await prisma.produk.create({ data: { id: 1, kode_produk: 'F/A-001', nama_produk: 'Mobil Pick Up' }});
  const prodDCab = await prisma.produk.create({ data: { id: 2, kode_produk: 'A-002', nama_produk: 'Mobil D-CAB' }});
  const prodMPV = await prisma.produk.create({ data: { id: 3, kode_produk: 'F/A-003', nama_produk: 'Mobil MPV' }});

  // 4. MASTER DATA - Workstations
  await prisma.workstation.createMany({
    data: [
      { id: 'WS1', nama_ws: 'Assy Axle', tipe: 'ASSEMBLY' },
      { id: 'WS2', nama_ws: 'Assy Wheel', tipe: 'ASSEMBLY' },
      { id: 'WS3', nama_ws: 'Final Assy', tipe: 'ASSEMBLY' },
      { id: 'WS4', nama_ws: 'Quality Inspection', tipe: 'INSPECTION' },
    ],
  });

  // 5. SCENARIO SETUP - Konfigurasi Game (Hanya Blueprint)
  const scenario = await prisma.skenarioGame.create({
    data: {
      nama_skenario: 'Simulasi Lini Produksi Kendaraan (Pick Up, D-Cab, MPV)',
      deskripsi: 'Skenario Kanban Pull System dengan variasi 3 produk di WS3.',
    },
  });

  // Konfigurasi dasar WIP Limits
  await prisma.skenarioWorkstation.createMany({
    data: [
      { id_skenario: scenario.id, id_workstation: 'WS1', is_pacemaker: true }, // Pacemaker!
      { id_skenario: scenario.id, id_workstation: 'WS2', is_pacemaker: false },
      { id_skenario: scenario.id, id_workstation: 'WS3', is_pacemaker: false },
      { id_skenario: scenario.id, id_workstation: 'WS4', is_pacemaker: false },
    ],
  });

  // Safety Stock / WIP Target per Produk per WS
  await prisma.skenarioWorkstationProduk.createMany({
    data: [
      { id_skenario: scenario.id, id_workstation: 'WS1', id_produk: 99, safety_stock: 2 }, // Stok WIP Generic Chasis
      { id_skenario: scenario.id, id_workstation: 'WS2', id_produk: 99, safety_stock: 2 }, // Stok WIP Generic Rolling Chasis
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 1, safety_stock: 1 },  // Pick up ready
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 2, safety_stock: 1 },  // D-Cab ready
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 3, safety_stock: 1 },  // MPV ready
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 1, safety_stock: 1 },
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 2, safety_stock: 1 },
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 3, safety_stock: 1 },
    ]
  });

  // 6. STEPS (Langkah Kerja Berdasarkan Book1.pdf)
  // WS 1: Generic Chassis
  const stepWs1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS1', urutan_langkah: 1, deskripsi_tugas: 'Rakit 1 Chassis, 2 Axle, 4 Holder menggunakan 8 Short Bolt.', standard_time_detik: 45 }});
  // WS 2: Generic Wheel
  const stepWs2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 1, deskripsi_tugas: 'Pasang 4 Wheel dan kencangkan dengan 4 Nut Wheel.', standard_time_detik: 30 }});
  
  // WS 3: Cabins (Berbeda tiap produk)
  const stepWs3PickUp = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Pasang Front Cabin & PU Cabin menggunakan 2 Short Bolt.', standard_time_detik: 40 }});
  const stepWs3DCab = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Pasang Front, PU, & Rear Cabin menggunakan Short (2) & Long Bolt (1).', standard_time_detik: 55 }});
  const stepWs3MPV = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Pasang Front, PU, & Center Cabin menggunakan Short (2) & Long Bolt (1).', standard_time_detik: 55 }});
  
  // WS 4: Inspection
  const stepWs4PickUp = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Cek 10 Baut, Holder/Cabin di Checking Fixture, 4 Tuas Ban.', standard_time_detik: 25 }});
  const stepWs4DCab = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Cek 11 Baut, Holder/Cabin di Checking Fixture, 4 Tuas Ban.', standard_time_detik: 30 }});
  const stepWs4MPV = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Cek 11 Baut, Holder/Cabin di Checking Fixture, 4 Tuas Ban.', standard_time_detik: 30 }});

  // 7. BILL OF MATERIALS (Sesuai tabel di Halaman 1, 2, dan 3)
  await prisma.bomLangkah.createMany({
    data: [
      // WS1: S/A-001 (Assy Axle)
      { id_langkah: stepWs1.id, id_bahan: b_chassis.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs1.id, id_bahan: b_axle.id, qty_dibutuhkan: 2 },
      { id_langkah: stepWs1.id, id_bahan: b_axle_holder.id, qty_dibutuhkan: 4 },
      { id_langkah: stepWs1.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 8 },
      
      // WS2: S/A-002 (Assy Wheel) - Asumsi 4 roda dan 4 nut per mobil
      { id_langkah: stepWs2.id, id_bahan: b_wheel.id, qty_dibutuhkan: 4 },
      { id_langkah: stepWs2.id, id_bahan: b_nut_wheel.id, qty_dibutuhkan: 4 },
      
      // WS3: Pick Up (F/A-001)
      { id_langkah: stepWs3PickUp.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 2 },
      { id_langkah: stepWs3PickUp.id, id_bahan: b_front_cabin.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3PickUp.id, id_bahan: b_pu_cabin.id, qty_dibutuhkan: 1 },
      
      // WS3: D-CAB (A-002)
      { id_langkah: stepWs3DCab.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 2 },
      { id_langkah: stepWs3DCab.id, id_bahan: b_front_cabin.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3DCab.id, id_bahan: b_pu_cabin.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3DCab.id, id_bahan: b_rear_cabin.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3DCab.id, id_bahan: b_long_bolt.id, qty_dibutuhkan: 1 },
      
      // WS3: MPV (F/A-003)
      { id_langkah: stepWs3MPV.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 2 },
      { id_langkah: stepWs3MPV.id, id_bahan: b_front_cabin.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3MPV.id, id_bahan: b_pu_cabin.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3MPV.id, id_bahan: b_center_cabin.id, qty_dibutuhkan: 1 },
      { id_langkah: stepWs3MPV.id, id_bahan: b_long_bolt.id, qty_dibutuhkan: 1 },
    ]
  });

  console.log(`✅ Master Data Database Berhasil Disiapkan (Tanpa Sesi Aktif)!`);
  console.log(`Panggil API '/session/start' (yg akan Anda buat) untuk mulai simulasi dan mengisi LogSiklusKanban.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });