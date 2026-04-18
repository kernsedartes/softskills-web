-- CreateTable
CREATE TABLE "SkillScoreHistory" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "score" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillScoreHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SkillScoreHistory" ADD CONSTRAINT "SkillScoreHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
