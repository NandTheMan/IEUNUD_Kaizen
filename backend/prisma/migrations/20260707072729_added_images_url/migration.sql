-- AlterTable
ALTER TABLE "Bahan" ADD COLUMN     "gambar_url" VARCHAR(255);

-- AlterTable
ALTER TABLE "Produk" ADD COLUMN     "gambar_url" VARCHAR(255);

-- AlterTable
ALTER TABLE "SkenarioLangkahKerja" ADD COLUMN     "catatan_tambahan" TEXT,
ADD COLUMN     "gambar_tambahan_url" VARCHAR(255),
ADD COLUMN     "gambar_utama_url" VARCHAR(255);
