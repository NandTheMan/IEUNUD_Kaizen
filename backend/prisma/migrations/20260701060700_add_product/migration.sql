/*
  Warnings:

  - Added the required column `id_produk` to the `LogSiklusKanban` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_produk` to the `SkenarioLangkahKerja` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LogSiklusKanban" ADD COLUMN     "id_produk" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SkenarioLangkahKerja" ADD COLUMN     "id_produk" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Produk" (
    "id" SERIAL NOT NULL,
    "kode_produk" VARCHAR(50) NOT NULL,
    "nama_produk" VARCHAR(255) NOT NULL,

    CONSTRAINT "Produk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetProduksi" (
    "id_sesi" INTEGER NOT NULL,
    "id_produk" INTEGER NOT NULL,
    "target_qty" INTEGER NOT NULL,

    CONSTRAINT "TargetProduksi_pkey" PRIMARY KEY ("id_sesi","id_produk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produk_kode_produk_key" ON "Produk"("kode_produk");

-- AddForeignKey
ALTER TABLE "SkenarioLangkahKerja" ADD CONSTRAINT "SkenarioLangkahKerja_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "Produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProduksi" ADD CONSTRAINT "TargetProduksi_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProduksi" ADD CONSTRAINT "TargetProduksi_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "Produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSiklusKanban" ADD CONSTRAINT "LogSiklusKanban_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "Produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
