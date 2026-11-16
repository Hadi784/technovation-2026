CREATE TABLE "ProjectMember" (
    "projectId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId", "studentId")
);

CREATE INDEX "ProjectMember_studentId_idx" ON "ProjectMember"("studentId");

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
