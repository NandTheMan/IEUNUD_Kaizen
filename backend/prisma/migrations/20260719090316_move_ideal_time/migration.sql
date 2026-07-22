/*
  Warnings:

  - You are about to drop the column `waktu_mulai_langkah` on the `LogSiklusKanban` table. All the data in the column will be lost.
  - You are about to drop the column `standard_time_detik` on the `SkenarioLangkahKerja` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LogSiklusKanban" DROP COLUMN "waktu_mulai_langkah";

-- AlterTable
ALTER TABLE "SkenarioLangkahKerja" DROP COLUMN "standard_time_detik";

-- AlterTable
ALTER TABLE "SkenarioWorkstationProduk" ADD COLUMN     "total_waktu_standar_detik" INTEGER;
