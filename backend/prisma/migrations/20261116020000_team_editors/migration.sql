ALTER TABLE "Project"
    ADD COLUMN "teamName" VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN "editorStudentId" INTEGER;

CREATE UNIQUE INDEX "Project_editorStudentId_key" ON "Project"("editorStudentId");

ALTER TABLE "Project"
    ADD CONSTRAINT "Project_editorStudentId_fkey"
    FOREIGN KEY ("editorStudentId") REFERENCES "Student"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
