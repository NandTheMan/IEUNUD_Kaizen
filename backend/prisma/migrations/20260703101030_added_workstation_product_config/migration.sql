/*
  Warnings:

  - You are about to drop the column `wip_limit` on the `SkenarioWorkstation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SkenarioWorkstation" DROP CONSTRAINT "SkenarioWorkstation_id_skenario_fkey";

-- AlterTable
ALTER TABLE "SkenarioWorkstation" DROP COLUMN "wip_limit",
ADD COLUMN     "is_pacemaker" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "SkenarioWorkstation" ADD CONSTRAINT "SkenarioWorkstation_id_skenario_fkey" FOREIGN KEY ("id_skenario") REFERENCES "SkenarioGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
