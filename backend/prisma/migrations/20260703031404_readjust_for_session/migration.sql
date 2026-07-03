-- DropForeignKey
ALTER TABLE "LogAndon" DROP CONSTRAINT "LogAndon_id_sesi_fkey";

-- DropForeignKey
ALTER TABLE "LogLogistik" DROP CONSTRAINT "LogLogistik_id_sesi_fkey";

-- DropForeignKey
ALTER TABLE "LogProdukNG" DROP CONSTRAINT "LogProdukNG_id_sesi_fkey";

-- DropForeignKey
ALTER TABLE "LogSiklusKanban" DROP CONSTRAINT "LogSiklusKanban_id_sesi_fkey";

-- DropForeignKey
ALTER TABLE "StokLiveWorkstation" DROP CONSTRAINT "StokLiveWorkstation_id_sesi_fkey";

-- DropForeignKey
ALTER TABLE "TargetProduksi" DROP CONSTRAINT "TargetProduksi_id_sesi_fkey";

-- AddForeignKey
ALTER TABLE "TargetProduksi" ADD CONSTRAINT "TargetProduksi_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokLiveWorkstation" ADD CONSTRAINT "StokLiveWorkstation_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogSiklusKanban" ADD CONSTRAINT "LogSiklusKanban_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogProdukNG" ADD CONSTRAINT "LogProdukNG_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAndon" ADD CONSTRAINT "LogAndon_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogLogistik" ADD CONSTRAINT "LogLogistik_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
