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
  const prodGeneric = await prisma.produk.create({ data: { id: 99, kode_produk: 'GENERIC', nama_produk: 'Generic Rolling Chassis' } });

  const prodPickUp = await prisma.produk.create({ data: { id: 1, kode_produk: 'F/A-001', nama_produk: 'Mobil Pick Up' } });
  const prodDCab = await prisma.produk.create({ data: { id: 2, kode_produk: 'A-002', nama_produk: 'Mobil D-CAB' } });
  const prodMPV = await prisma.produk.create({ data: { id: 3, kode_produk: 'F/A-003', nama_produk: 'Mobil MPV' } });

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
      { id_skenario: scenario.id, id_workstation: 'WS1', id_produk: 99, safety_stock: 2, total_waktu_standar_detik: 90 }, // Stok WIP Generic Chasis
      { id_skenario: scenario.id, id_workstation: 'WS2', id_produk: 99, safety_stock: 2, total_waktu_standar_detik: 90 }, // Stok WIP Generic Rolling Chasis
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 1, safety_stock: 1, total_waktu_standar_detik: 90 },  // Pick up ready
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 2, safety_stock: 1, total_waktu_standar_detik: 90 },  // D-Cab ready
      { id_skenario: scenario.id, id_workstation: 'WS3', id_produk: 3, safety_stock: 1, total_waktu_standar_detik: 90 },  // MPV ready
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 1, safety_stock: 1, total_waktu_standar_detik: 90 },
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 2, safety_stock: 1, total_waktu_standar_detik: 90 },
      { id_skenario: scenario.id, id_workstation: 'WS4', id_produk: 3, safety_stock: 1, total_waktu_standar_detik: 90 },
    ],
  });

  // ==========================================================
  // 6. STEPS (Langkah Kerja Granular - Berdasarkan tabel
  //    "Step Pekerjaan" & "Point Penting" di Book1.pdf)
  //    NOTE: standard_time_detik per sub-langkah adalah estimasi
  //    proporsional dari total waktu asli per produk/WS (PDF tidak
  //    memberi waktu per sub-langkah) - sesuaikan dgn time-study nyata.
  // ==========================================================

  // ----- WS1: Assy Axle (Produk Generic id 99) -----
  const ws1_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS1', urutan_langkah: 1, deskripsi_tugas: 'Ambil Chassis & tempatkan pada meja kerja.', catatan_tambahan: 'Chassis sisi Down menghadap ke atas.' } });
  const ws1_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS1', urutan_langkah: 2, deskripsi_tugas: 'Ambil Axle Shaft dan Axle Holder dengan tangan kiri (kedua sisi).' } });
  const ws1_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS1', urutan_langkah: 3, deskripsi_tugas: 'Pasangkan Holder dengan Axle pada sisi kiri & kanan (Assy Axle).' } });
  const ws1_4 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS1', urutan_langkah: 4, deskripsi_tugas: 'Pasangkan Holder & Axle ke Chassis sisi Front (FR) dengan Short Bolt.', catatan_tambahan: 'Pemasangan Assy Axle ke Chassis harus terhadap sumbu yang terdapat pada chasis.' } });
  const ws1_5 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS1', urutan_langkah: 5, deskripsi_tugas: 'Ulangi langkah 2-4 pada sisi yang lain.' } });

  // ----- WS2: Assy Wheel (Produk Generic id 99) -----
  const ws2_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 1, deskripsi_tugas: 'Ambil WIP Assy Holder dengan tangan kiri.' } });
  const ws2_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 2, deskripsi_tugas: 'Ambil Wheel dan pasang pada axle sisi FR Kanan terlebih dahulu.' } });
  const ws2_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 3, deskripsi_tugas: 'Ambil Nut Wheel & pasang pada wheel sisi FR Kanan.', catatan_tambahan: 'Pemasangan Tire & Nut harus center terhadap sumbu Axle.' } });
  const ws2_4 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 4, deskripsi_tugas: 'Ulangi langkah 2-3 pada seluruh sisi.' } });
  const ws2_5 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 5, deskripsi_tugas: 'Letakkan Assy Tire di meja kerja dengan sisi Down menghadap ke atas.' } });
  const ws2_6 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 99, id_workstation: 'WS2', urutan_langkah: 6, deskripsi_tugas: 'Kencangkan Bolt Holder (8 Pcs) dengan Kunci L (size 3).', catatan_tambahan: 'Pastikan pemasangan Bolt kencang.' } });

  // ----- WS3: Final Assy - Pick Up (id_produk 1) -----
  const pu_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Ambil Front Cabin dengan tangan kanan & letakkan di meja kerja dengan sisi bawah menghadap ke atas.' } });
  const pu_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 2, deskripsi_tugas: 'Ambil WIP dari proses Assy Tire (WS2) dengan tangan kiri.' } });
  const pu_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 3, deskripsi_tugas: 'Pasangkan Front Cabin & WIP Assy Tire dengan Short Bolt.', catatan_tambahan: 'Pastikan pemasangan Chassis dengan Front Cabin lurus terhadap FR Chassis.' } });
  const pu_4 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 4, deskripsi_tugas: 'Ambil PU Cabin (PU Box) dengan tangan kanan.' } });
  const pu_5 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 5, deskripsi_tugas: 'Pasangkan PU Cabin pada Chassis sisi RR dengan Short Bolt.', catatan_tambahan: 'Pastikan pemasangan Chassis dengan PU Cabin lurus terhadap RR Chassis.' } });
  const pu_6 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 6, deskripsi_tugas: 'Simpan hasil Final Assy di meja kerja dengan bagian bawah menghadap ke atas.' } });
  const pu_7 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS3', urutan_langkah: 7, deskripsi_tugas: 'Kencangkan Bolt Holder (8 Pcs) dengan Kunci L (size 3).', catatan_tambahan: 'Pastikan pemasangan Bolt kencang.' } });

  // ----- WS3: Final Assy - D-Cab (id_produk 2) -----
  const dc_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Ambil Front Cabin dengan tangan kanan & letakkan di meja kerja dengan sisi bawah menghadap ke atas.' } });
  const dc_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 2, deskripsi_tugas: 'Ambil WIP dari proses Assy Tire (WS2) dengan tangan kiri.' } });
  const dc_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 3, deskripsi_tugas: 'Pasangkan Front Cabin & WIP Assy Tire dengan Short Bolt.', catatan_tambahan: 'Pastikan pemasangan Chassis dengan Front Cabin lurus terhadap FR Chassis.' } });
  const dc_4 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 4, deskripsi_tugas: 'Ambil PU Cabin (PU Box) dengan tangan kanan.' } });
  const dc_5 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 5, deskripsi_tugas: 'Pasangkan PU Cabin pada Chassis sisi RR dengan Short Bolt.', catatan_tambahan: 'Pastikan pemasangan Chassis dengan PU Cabin lurus terhadap RR Chassis.' } });
  const dc_6 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 6, deskripsi_tugas: 'Ambil Rear Cabin (Cabin 2) dengan tangan kanan - untuk membuat D-Cab.' } });
  const dc_7 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 7, deskripsi_tugas: 'Pasang Rear Cabin & PU Cabin dengan Long Bolt.' } });
  const dc_8 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 8, deskripsi_tugas: 'Simpan hasil Final Assy di meja kerja dengan bagian bawah menghadap ke atas.' } });
  const dc_9 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS3', urutan_langkah: 9, deskripsi_tugas: 'Kencangkan Bolt Holder (8 Pcs) dengan Kunci L (size 3).', catatan_tambahan: 'Pastikan pemasangan Bolt kencang.' } });

  // ----- WS3: Final Assy - MPV (id_produk 3) -----
  const mpv_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 1, deskripsi_tugas: 'Ambil Front Cabin dengan tangan kanan & letakkan di meja kerja dengan sisi bawah menghadap ke atas.' } });
  const mpv_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 2, deskripsi_tugas: 'Ambil WIP dari proses Assy Tire (WS2) dengan tangan kiri.' } });
  const mpv_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 3, deskripsi_tugas: 'Pasangkan Front Cabin & WIP Assy Tire dengan Short Bolt.', catatan_tambahan: 'Pastikan pemasangan Chassis dengan Front Cabin lurus terhadap FR Chassis.' } });
  const mpv_4 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 4, deskripsi_tugas: 'Ambil PU Cabin (PU Box) dengan tangan kanan.' } });
  const mpv_5 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 5, deskripsi_tugas: 'Pasangkan PU Cabin pada Chassis sisi RR dengan Short Bolt.', catatan_tambahan: 'Pastikan pemasangan Chassis dengan PU Cabin lurus terhadap RR Chassis.' } });
  const mpv_6 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 6, deskripsi_tugas: 'Ambil Center Cabin dengan tangan kanan - untuk membuat MPV.' } });
  const mpv_7 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 7, deskripsi_tugas: 'Pasang Center Cabin & PU Cabin dengan Long Bolt.' } });
  const mpv_8 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 8, deskripsi_tugas: 'Simpan hasil Final Assy di meja kerja dengan bagian bawah menghadap ke atas.' } });
  const mpv_9 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS3', urutan_langkah: 9, deskripsi_tugas: 'Kencangkan Bolt Holder (8 Pcs) dengan Kunci L (size 3).', catatan_tambahan: 'Pastikan pemasangan Bolt kencang.' } });

  // ----- WS4: Quality Inspection (3 pemeriksaan, jumlah bolt beda per produk) -----
  const ws4pu_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Cek pemasangan Bolt (10 pcs).', catatan_tambahan: 'Pastikan pemasangan Bolt tidak kendor. Jika Baut kendor = NG.' } });
  const ws4pu_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS4', urutan_langkah: 2, deskripsi_tugas: 'Cek pemasangan Holder & Cabin dengan Checking Fixture (CF).', catatan_tambahan: 'Jika Vehicle tidak masuk terhadap CF, maka NG.' } });
  const ws4pu_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 1, id_workstation: 'WS4', urutan_langkah: 3, deskripsi_tugas: 'Cek pemasangan Tire dengan mendorong ke 4 tuas pada CF.', catatan_tambahan: 'Jika ada satu atau lebih Tire tidak masuk terhadap checking Tire, maka NG.' } });

  const ws4dc_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Cek pemasangan Bolt (11 pcs).', catatan_tambahan: 'Pastikan pemasangan Bolt tidak kendor. Jika Baut kendor = NG.' } });
  const ws4dc_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS4', urutan_langkah: 2, deskripsi_tugas: 'Cek pemasangan Holder & Cabin dengan Checking Fixture (CF).', catatan_tambahan: 'Jika Vehicle tidak masuk terhadap CF, maka NG.' } });
  const ws4dc_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 2, id_workstation: 'WS4', urutan_langkah: 3, deskripsi_tugas: 'Cek pemasangan Tire dengan mendorong ke 4 tuas pada CF.', catatan_tambahan: 'Jika ada satu atau lebih Tire tidak masuk terhadap checking Tire, maka NG.' } });

  const ws4mpv_1 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS4', urutan_langkah: 1, deskripsi_tugas: 'Cek pemasangan Bolt (11 pcs).', catatan_tambahan: 'Pastikan pemasangan Bolt tidak kendor. Jika Baut kendor = NG.' } });
  const ws4mpv_2 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS4', urutan_langkah: 2, deskripsi_tugas: 'Cek pemasangan Holder & Cabin dengan Checking Fixture (CF).', catatan_tambahan: 'Jika Vehicle tidak masuk terhadap CF, maka NG.' } });
  const ws4mpv_3 = await prisma.skenarioLangkahKerja.create({ data: { id_skenario: scenario.id, id_produk: 3, id_workstation: 'WS4', urutan_langkah: 3, deskripsi_tugas: 'Cek pemasangan Tire dengan mendorong ke 4 tuas pada CF.', catatan_tambahan: 'Jika ada satu atau lebih Tire tidak masuk terhadap checking Tire, maka NG.' } });

  // ==========================================================
  // 7. BILL OF MATERIALS + SAFETY STOCK per bahan
  //    (Sesuai tabel BoM & Safety Stock di Halaman 1, 2, dan 3)
  // ==========================================================
  await prisma.bomLangkah.createMany({
    data: [
      // WS1: S/A-001 (Assy Axle) - qty & safety stock per tabel WS1
      { id_langkah: ws1_1.id, id_bahan: b_chassis.id, qty_dibutuhkan: 1, safety_stock: 2 },
      { id_langkah: ws1_2.id, id_bahan: b_axle.id, qty_dibutuhkan: 2, safety_stock: 10 },
      { id_langkah: ws1_2.id, id_bahan: b_axle_holder.id, qty_dibutuhkan: 4, safety_stock: 8 },
      { id_langkah: ws1_4.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 8, safety_stock: 16 },

      // WS2: S/A-002 (Assy Wheel) - qty & safety stock per tabel WS2
      { id_langkah: ws2_2.id, id_bahan: b_wheel.id, qty_dibutuhkan: 4, safety_stock: 8 },
      { id_langkah: ws2_3.id, id_bahan: b_nut_wheel.id, qty_dibutuhkan: 4, safety_stock: 8 },

      // WS3: Pick Up (F/A-001)
      { id_langkah: pu_1.id, id_bahan: b_front_cabin.id, qty_dibutuhkan: 1, safety_stock: 1 },
      { id_langkah: pu_3.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 1, safety_stock: 10 },
      { id_langkah: pu_4.id, id_bahan: b_pu_cabin.id, qty_dibutuhkan: 1, safety_stock: 2 },
      { id_langkah: pu_5.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 1, safety_stock: 10 },

      // WS3: D-CAB (A-002)
      { id_langkah: dc_1.id, id_bahan: b_front_cabin.id, qty_dibutuhkan: 1, safety_stock: 1 },
      { id_langkah: dc_3.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 1, safety_stock: 10 },
      { id_langkah: dc_4.id, id_bahan: b_pu_cabin.id, qty_dibutuhkan: 1, safety_stock: 2 },
      { id_langkah: dc_5.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 1, safety_stock: 10 },
      { id_langkah: dc_6.id, id_bahan: b_rear_cabin.id, qty_dibutuhkan: 1, safety_stock: 2 },
      { id_langkah: dc_7.id, id_bahan: b_long_bolt.id, qty_dibutuhkan: 1, safety_stock: 4 },

      // WS3: MPV (F/A-003)
      { id_langkah: mpv_1.id, id_bahan: b_front_cabin.id, qty_dibutuhkan: 1, safety_stock: 1 },
      { id_langkah: mpv_3.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 1, safety_stock: 10 },
      { id_langkah: mpv_4.id, id_bahan: b_pu_cabin.id, qty_dibutuhkan: 1, safety_stock: 2 },
      { id_langkah: mpv_5.id, id_bahan: b_short_bolt.id, qty_dibutuhkan: 1, safety_stock: 10 },
      { id_langkah: mpv_6.id, id_bahan: b_center_cabin.id, qty_dibutuhkan: 1, safety_stock: 2 },
      { id_langkah: mpv_7.id, id_bahan: b_long_bolt.id, qty_dibutuhkan: 1, safety_stock: 4 },

      // WS4: Quality Inspection - tidak ada konsumsi material (inspeksi visual/fungsional)
    ],
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