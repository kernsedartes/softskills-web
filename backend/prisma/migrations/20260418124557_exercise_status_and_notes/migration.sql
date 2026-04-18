/*
  Warnings:

  - You are about to drop the column `completed` on the `ProgramExercise` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExerciseStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- AlterTable
ALTER TABLE "ProgramExercise" DROP COLUMN "completed",
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "status" "ExerciseStatus" NOT NULL DEFAULT 'not_started';
