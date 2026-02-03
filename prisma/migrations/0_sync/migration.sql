-- AlterEnum
ALTER TYPE "StockAdjustmentType" ADD VALUE 'CORRECT_ENTRY_ERROR';

-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN     "reason" TEXT;

