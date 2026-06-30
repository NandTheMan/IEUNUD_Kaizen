-- CreateTable
CREATE TABLE "Bahan" (
    "id" SERIAL NOT NULL,
    "nama_bahan" VARCHAR(255) NOT NULL,
    "kuantitas_pack" INTEGER NOT NULL,
    "harga_satuan" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Bahan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workstation" (
    "id" VARCHAR(50) NOT NULL,
    "nama_ws" VARCHAR(255) NOT NULL,
    "tipe" VARCHAR(50) NOT NULL,

    CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkenarioGame" (
    "id" SERIAL NOT NULL,
    "nama_skenario" VARCHAR(255) NOT NULL,
    "deskripsi" TEXT,

    CONSTRAINT "SkenarioGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkenarioWorkstation" (
    "id_skenario" INTEGER NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "wip_limit" INTEGER NOT NULL,

    CONSTRAINT "SkenarioWorkstation_pkey" PRIMARY KEY ("id_skenario","id_workstation")
);

-- CreateTable
CREATE TABLE "SkenarioLangkahKerja" (
    "id" SERIAL NOT NULL,
    "id_skenario" INTEGER NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "urutan_langkah" INTEGER NOT NULL,
    "deskripsi_tugas" TEXT NOT NULL,
    "standard_time_detik" INTEGER NOT NULL,

    CONSTRAINT "SkenarioLangkahKerja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLangkah" (
    "id_langkah" INTEGER NOT NULL,
    "id_bahan" INTEGER NOT NULL,
    "qty_dibutuhkan" INTEGER NOT NULL,

    CONSTRAINT "BomLangkah_pkey" PRIMARY KEY ("id_langkah","id_bahan")
);

-- CreateTable
CREATE TABLE "SesiPraktikum" (
    "id" SERIAL NOT NULL,
    "id_skenario" INTEGER NOT NULL,
    "waktu_mulai" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waktu_selesai" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "SesiPraktikum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokLiveWorkstation" (
    "id_sesi" INTEGER NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "id_bahan" INTEGER NOT NULL,
    "stok_sekarang" INTEGER NOT NULL,
    "safety_stock_threshold" INTEGER NOT NULL,

    CONSTRAINT "StokLiveWorkstation_pkey" PRIMARY KEY ("id_sesi","id_workstation","id_bahan")
);

-- CreateTable
CREATE TABLE "LogSiklusKanban" (
    "id" SERIAL NOT NULL,
    "id_sesi" INTEGER NOT NULL,
    "kode_produk" VARCHAR(100) NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "waktu_mulai" TIMESTAMPTZ NOT NULL,
    "waktu_selesai" TIMESTAMPTZ,
    "status" VARCHAR(50) NOT NULL,

    CONSTRAINT "LogSiklusKanban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAndon" (
    "id" SERIAL NOT NULL,
    "id_sesi" INTEGER NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "jenis_gangguan" VARCHAR(100) NOT NULL,
    "waktu_lapor" TIMESTAMPTZ NOT NULL,
    "waktu_selesai" TIMESTAMPTZ,
    "id_bahan_dibuang" INTEGER,
    "qty_dibuang" INTEGER,

    CONSTRAINT "LogAndon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogLogistik" (
    "id" SERIAL NOT NULL,
    "id_sesi" INTEGER NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "id_bahan" INTEGER NOT NULL,
    "qty_diminta" INTEGER NOT NULL,
    "waktu_diminta" TIMESTAMPTZ NOT NULL,
    "waktu_dipenuhi" TIMESTAMPTZ,

    CONSTRAINT "LogLogistik_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SkenarioWorkstation" ADD CONSTRAINT "SkenarioWorkstation_id_skenario_fkey" FOREIGN KEY ("id_skenario") REFERENCES "SkenarioGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkenarioWorkstation" ADD CONSTRAINT "SkenarioWorkstation_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkenarioLangkahKerja" ADD CONSTRAINT "SkenarioLangkahKerja_id_skenario_fkey" FOREIGN KEY ("id_skenario") REFERENCES "SkenarioGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkenarioLangkahKerja" ADD CONSTRAINT "SkenarioLangkahKerja_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLangkah" ADD CONSTRAINT "BomLangkah_id_langkah_fkey" FOREIGN KEY ("id_langkah") REFERENCES "SkenarioLangkahKerja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLangkah" ADD CONSTRAINT "BomLangkah_id_bahan_fkey" FOREIGN KEY ("id_bahan") REFERENCES "Bahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesiPraktikum" ADD CONSTRAINT "SesiPraktikum_id_skenario_fkey" FOREIGN KEY ("id_skenario") REFERENCES "SkenarioGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokLiveWorkstation" ADD CONSTRAINT "StokLiveWorkstation_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokLiveWorkstation" ADD CONSTRAINT "StokLiveWorkstation_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokLiveWorkstation" ADD CONSTRAINT "StokLiveWorkstation_id_bahan_fkey" FOREIGN KEY ("id_bahan") REFERENCES "Bahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSiklusKanban" ADD CONSTRAINT "LogSiklusKanban_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSiklusKanban" ADD CONSTRAINT "LogSiklusKanban_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAndon" ADD CONSTRAINT "LogAndon_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAndon" ADD CONSTRAINT "LogAndon_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAndon" ADD CONSTRAINT "LogAndon_id_bahan_dibuang_fkey" FOREIGN KEY ("id_bahan_dibuang") REFERENCES "Bahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogLogistik" ADD CONSTRAINT "LogLogistik_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogLogistik" ADD CONSTRAINT "LogLogistik_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogLogistik" ADD CONSTRAINT "LogLogistik_id_bahan_fkey" FOREIGN KEY ("id_bahan") REFERENCES "Bahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
