-- CreateTable
CREATE TABLE "SkenarioWorkstationProduk" (
    "id_skenario" INTEGER NOT NULL,
    "id_workstation" VARCHAR(50) NOT NULL,
    "id_produk" INTEGER NOT NULL,
    "safety_stock" INTEGER NOT NULL,

    CONSTRAINT "SkenarioWorkstationProduk_pkey" PRIMARY KEY ("id_skenario","id_workstation","id_produk")
);

-- AddForeignKey
ALTER TABLE "SkenarioWorkstationProduk" ADD CONSTRAINT "SkenarioWorkstationProduk_id_skenario_fkey" FOREIGN KEY ("id_skenario") REFERENCES "SkenarioGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkenarioWorkstationProduk" ADD CONSTRAINT "SkenarioWorkstationProduk_id_workstation_fkey" FOREIGN KEY ("id_workstation") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkenarioWorkstationProduk" ADD CONSTRAINT "SkenarioWorkstationProduk_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "Produk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
