import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
})

async function main() {
  console.log('Seeding database with TPS Lab data (including Products & NG Data)...');

  // 1. Clear existing data in reverse relation order
  await prisma.logLogistik.deleteMany();
  await prisma.logAndon.deleteMany();
  await prisma.logProdukNG.deleteMany();
  await prisma.logSiklusKanban.deleteMany();
  await prisma.stokLiveWorkstation.deleteMany();
  await prisma.targetProduksi.deleteMany();
  await prisma.sesiPraktikum.deleteMany();
  await prisma.bomLangkah.deleteMany();
  await prisma.skenarioLangkahKerja.deleteMany();
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

  // 3. MASTER DATA - Produk (Heijunka Setup)
  const prodA = await prisma.produk.create({ data: { kode_produk: 'TYPE-A', nama_produk: 'Mobil Standard' }});
  const prodB = await prisma.produk.create({ data: { kode_produk: 'TYPE-B', nama_produk: 'Mobil Premium' }});

  // 4. MASTER DATA - Workstations
  await prisma.workstation.createMany({
    data: [
      { id: 'WS1', nama_ws: 'Perakitan Chassis & Axle', tipe: 'ASSEMBLY' },
      { id: 'WS2', nama_ws: 'Perakitan Roda', tipe: 'ASSEMBLY' },
      { id: 'WS3', nama_ws: 'Pemasangan Body', tipe: 'ASSEMBLY' },
      { id: 'WS4', nama_ws: 'Quality Inspection', tipe: 'INSPECTION' },
      { id: 'WAREHOUSE', nama_ws: 'Gudang Logistik', tipe: 'LOGISTICS' },
    ],
  });

  // 5. SCENARIO SETUP - 4 Workstation Baseline
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

  // 6. STEPS & BOM (Bill of Materials linked to Products)
  // Step for Product A
  const step1A = await prisma.skenarioLangkahKerja.create({
    data: { id_skenario: scenario.id, id_produk: prodA.id, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Pasang Body Standard', standard_time_detik: 30 },
  });
  await prisma.bomLangkah.create({ data: { id_langkah: step1A.id, id_bahan: b_body_a.id, qty_dibutuhkan: 1 } });

  // Step for Product B (Takes longer)
  const step1B = await prisma.skenarioLangkahKerja.create({
    data: { id_skenario: scenario.id, id_produk: prodB.id, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Pasang Body Premium (Perlu Kalibrasi)', standard_time_detik: 50 },
  });
  await prisma.bomLangkah.create({ data: { id_langkah: step1B.id, id_bahan: b_body_b.id, qty_dibutuhkan: 1 } });

  // 7. LIVE SESSION DATA
  const pastSession = await prisma.sesiPraktikum.create({
    data: {
      id_skenario: scenario.id,
      waktu_mulai: new Date(Date.now() - 1000 * 60 * 60 * 2), // Started 2 hours ago
      waktu_selesai: new Date(Date.now() - 1000 * 60 * 30),  // Finished 30 mins ago
      status: 'COMPLETED',
    },
  });

  // PPIC Target
  await prisma.targetProduksi.createMany({
    data: [
      { id_sesi: pastSession.id, id_produk: prodA.id, target_qty: 10 },
      { id_sesi: pastSession.id, id_produk: prodB.id, target_qty: 5 },
    ]
  });

  // 8. SIMULATE OEE & HEIJUNKA DATA
  const baseTime = pastSession.waktu_mulai.getTime();
  
  for (let i = 1; i <= 15; i++) {
    const isPremium = i % 3 === 0; // Every 3rd car is Premium (Type B)
    const activeProdId = isPremium ? prodB.id : prodA.id;
    const isNg = i === 7; // Car #7 will be a complete failure (NG)
    
    await prisma.logSiklusKanban.create({
      data: {
        id_sesi: pastSession.id,
        id_produk: activeProdId,
        kode_produk: `CAR-${isPremium ? 'B' : 'A'}-${String(i).padStart(3, '0')}`,
        id_workstation: 'WS1',
        waktu_mulai: new Date(baseTime + (i * 1000 * 100)),
        waktu_selesai: new Date(baseTime + (i * 1000 * 100) + 138000), 
        status: isNg ? 'NG' : 'DONE',
      },
    });

    // If it's NG, log it to the new NG table!
    if (isNg) {
      await prisma.logProdukNG.create({
        data: {
          id_sesi: pastSession.id,
          id_produk: activeProdId,
          kode_produk: `CAR-${isPremium ? 'B' : 'A'}-${String(i).padStart(3, '0')}`,
          id_workstation: 'WS3', // Let's say WS3 broke the body completely
          alasan_ng: 'Body retak saat proses perakitan, produk harus di-scrap.',
          waktu_kejadian: new Date(baseTime + (i * 1000 * 100) + 120000)
        }
      });
    }
  }

  // Create Downtime/Andon events
  await prisma.logAndon.create({
    data: {
      id_sesi: pastSession.id,
      id_workstation: 'WS1',
      jenis_gangguan: 'DEFECT_MATERIAL',
      waktu_lapor: new Date(baseTime + 1000 * 60 * 15),
      waktu_selesai: new Date(baseTime + 1000 * 60 * 18), 
      id_bahan_dibuang: b_chassis.id,
      qty_dibuang: 1, 
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