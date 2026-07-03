-- CreateTable
CREATE TABLE "AntrianHeijunka" (
    "id" SERIAL NOT NULL,
    "id_sesi" INTEGER NOT NULL,
    "id_produk" INTEGER NOT NULL,
    "kode_produk" VARCHAR(100) NOT NULL,
    "urutan" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "AntrianHeijunka_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AntrianHeijunka" ADD CONSTRAINT "AntrianHeijunka_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "SesiPraktikum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntrianHeijunka" ADD CONSTRAINT "AntrianHeijunka_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "Produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
