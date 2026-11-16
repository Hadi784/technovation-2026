-- TECHNOVATION database schema (PostgreSQL 13+).

BEGIN;

CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'STUDENT', 'JUDGE');

CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED');

CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "userId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "grade" VARCHAR(80) NOT NULL DEFAULT '',
    "campus" VARCHAR(120) NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "photoId" UUID,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "overview" TEXT NOT NULL DEFAULT '',
    "objectives" TEXT NOT NULL DEFAULT '',
    "problem" TEXT NOT NULL DEFAULT '',
    "solution" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "applications" TEXT NOT NULL DEFAULT '',
    "technical" TEXT NOT NULL DEFAULT '',
    "journey" TEXT NOT NULL DEFAULT '',
    "contribution" TEXT NOT NULL DEFAULT '',
    "teamMembers" TEXT NOT NULL DEFAULT '',
    "githubUrl" TEXT NOT NULL DEFAULT '',
    "demoUrl" TEXT NOT NULL DEFAULT '',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "coverId" UUID,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Upload" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storageKey" UUID NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMedia" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "uploadId" UUID NOT NULL,
    "caption" VARCHAR(255) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectDocument" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "uploadId" UUID NOT NULL,
    "caption" VARCHAR(255) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Judge" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "specialty" VARCHAR(160) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JudgeAssignment" (
    "id" SERIAL NOT NULL,
    "judgeId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "revisionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JudgeAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evaluation" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "innovation" SMALLINT NOT NULL,
    "technicalKnowledge" SMALLINT NOT NULL,
    "workingDemonstration" SMALLINT NOT NULL,
    "creativity" SMALLINT NOT NULL,
    "problemSolving" SMALLINT NOT NULL,
    "presentation" SMALLINT NOT NULL,
    "total" SMALLINT NOT NULL,
    "strengths" TEXT NOT NULL DEFAULT '',
    "weaknesses" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QRCode" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QRCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Award" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(120),
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "logoId" UUID,
    "studentSubmissions" BOOLEAN NOT NULL DEFAULT false,
    "resultsPublished" BOOLEAN NOT NULL DEFAULT false,
    "feedbackVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE UNIQUE INDEX "Student_photoId_key" ON "Student"("photoId");
CREATE INDEX "Student_isPublic_name_idx" ON "Student"("isPublic", "name");
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Project_coverId_key" ON "Project"("coverId");
CREATE INDEX "Project_studentId_idx" ON "Project"("studentId");
CREATE INDEX "Project_categoryId_status_idx" ON "Project"("categoryId", "status");
CREATE INDEX "Project_status_publishedAt_idx" ON "Project"("status", "publishedAt");
CREATE UNIQUE INDEX "Upload_storageKey_key" ON "Upload"("storageKey");
CREATE INDEX "Upload_uploadedById_createdAt_idx" ON "Upload"("uploadedById", "createdAt");
CREATE UNIQUE INDEX "ProjectMedia_projectId_uploadId_key" ON "ProjectMedia"("projectId", "uploadId");
CREATE INDEX "ProjectMedia_uploadId_idx" ON "ProjectMedia"("uploadId");
CREATE UNIQUE INDEX "ProjectDocument_projectId_uploadId_key" ON "ProjectDocument"("projectId", "uploadId");
CREATE INDEX "ProjectDocument_uploadId_idx" ON "ProjectDocument"("uploadId");
CREATE UNIQUE INDEX "Judge_userId_key" ON "Judge"("userId");
CREATE UNIQUE INDEX "JudgeAssignment_judgeId_projectId_key" ON "JudgeAssignment"("judgeId", "projectId");
CREATE INDEX "JudgeAssignment_projectId_idx" ON "JudgeAssignment"("projectId");
CREATE UNIQUE INDEX "Evaluation_assignmentId_key" ON "Evaluation"("assignmentId");
CREATE INDEX "Evaluation_submittedAt_idx" ON "Evaluation"("submittedAt");
CREATE UNIQUE INDEX "QRCode_projectId_key" ON "QRCode"("projectId");
CREATE UNIQUE INDEX "QRCode_tokenHash_key" ON "QRCode"("tokenHash");
CREATE UNIQUE INDEX "Award_projectId_title_key" ON "Award"("projectId", "title");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");
CREATE UNIQUE INDEX "Setting_logoId_key" ON "Setting"("logoId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Award" ADD CONSTRAINT "Award_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_email_canonical" CHECK (
    "email" = lower(btrim("email")) AND char_length("email") > 0
);

ALTER TABLE "Session" ADD CONSTRAINT "Session_token_digest" CHECK (
    "id" ~ '^[0-9a-f]{64}$' AND "expiresAt" > "createdAt"
);

ALTER TABLE "Student" ADD CONSTRAINT "Student_name_required" CHECK (char_length(btrim("name")) > 0);
ALTER TABLE "Project" ADD CONSTRAINT "Project_title_required" CHECK (char_length(btrim("title")) > 0);
ALTER TABLE "Category" ADD CONSTRAINT "Category_slug_valid" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_byte_size_positive" CHECK ("byteSize" > 0);

ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_criterion_ranges" CHECK (
    "innovation" BETWEEN 0 AND 20
    AND "technicalKnowledge" BETWEEN 0 AND 20
    AND "workingDemonstration" BETWEEN 0 AND 20
    AND "creativity" BETWEEN 0 AND 15
    AND "problemSolving" BETWEEN 0 AND 15
    AND "presentation" BETWEEN 0 AND 10
);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_total_matches_scores" CHECK (
    "total" = "innovation" + "technicalKnowledge" + "workingDemonstration"
        + "creativity" + "problemSolving" + "presentation"
);

ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_token_and_scan_count" CHECK (
    "tokenHash" ~ '^[0-9a-f]{64}$' AND char_length("tokenCiphertext") > 0 AND "scanCount" >= 0
);

ALTER TABLE "Setting" ADD CONSTRAINT "Setting_singleton" CHECK ("id" = 1);

COMMIT;
