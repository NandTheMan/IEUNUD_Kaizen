-- CreateTable
CREATE TABLE "LogProdukNG" (
    "id" SERIAL NOT NULL,
    "id_sesi" INTEGER NOT NULL,
    "id_produk" INTEGER NOT NULL,
    "kode_produk" VARCHAR(100) NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "alasan_ng" TEXT NOT NULL,
    "waktu_kejadian" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogProdukNG_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LogProdukNG" ADD CONSTRAINT "LogProdukNG_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogProdukNG" ADD CONSTRAINT "LogProdukNG_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "Produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogProdukNG" ADD CONSTRAINT "LogProdukNG_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
