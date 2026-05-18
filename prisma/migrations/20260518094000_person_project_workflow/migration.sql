-- Anchor personal work items to a real project row instead of NULL projectId.
PRAGMA foreign_keys=OFF;

ALTER TABLE "Project" ADD COLUMN "createdByUserId" TEXT;

INSERT OR IGNORE INTO "Project" (
  "id",
  "identifier",
  "name",
  "description",
  "createdByUserId",
  "status",
  "health",
  "initialDifficulty",
  "progress",
  "enabledModules",
  "createdAt",
  "updatedAt"
) VALUES (
  'personProject',
  'person-project',
  '个人事项默认项目',
  '系统内置的个人事项挂载项目，不在普通项目列表中展示。',
  'u-admin',
  'ACTIVE',
  'LOW',
  'LOW',
  0,
  '["overview","work_packages"]',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

UPDATE "WorkPackage"
SET "projectId" = 'personProject'
WHERE "projectId" IS NULL;

CREATE TABLE "new_WorkPackage" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "projectId" TEXT NOT NULL DEFAULT 'personProject',
  "type" TEXT NOT NULL DEFAULT 'TASK',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'todo',
  "priority" TEXT NOT NULL DEFAULT 'P1',
  "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
  "origin" TEXT NOT NULL DEFAULT 'MANAGER',
  "createdByUserId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "parentId" INTEGER,
  "startDate" DATETIME,
  "dueDate" DATETIME,
  "estimateHours" INTEGER,
  "percentComplete" INTEGER NOT NULL DEFAULT 0,
  "lastProgressNote" TEXT NOT NULL DEFAULT '',
  "blockedReason" TEXT,
  "blockedStartedAt" DATETIME,
  "blockedResolvedAt" DATETIME,
  "delayReason" TEXT,
  "delayDays" INTEGER NOT NULL DEFAULT 0,
  "delayStartedAt" DATETIME,
  "delayResolvedAt" DATETIME,
  "progressUpdatedByUserId" TEXT,
  "completedAt" DATETIME,
  "dependencies" TEXT NOT NULL DEFAULT '[]',
  "requiredSkills" TEXT NOT NULL DEFAULT '[]',
  "isOnCriticalPath" BOOLEAN NOT NULL DEFAULT false,
  "riskLevel" TEXT,
  "riskImpact" TEXT,
  "riskMitigation" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
  "verifiedByUserId" TEXT,
  "verifiedAt" DATETIME,
  "rejectedReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WorkPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkPackage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkPackage_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WorkPackage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_WorkPackage" (
  "id",
  "projectId",
  "type",
  "subject",
  "description",
  "status",
  "priority",
  "difficulty",
  "origin",
  "createdByUserId",
  "assigneeId",
  "parentId",
  "startDate",
  "dueDate",
  "estimateHours",
  "percentComplete",
  "lastProgressNote",
  "blockedReason",
  "blockedStartedAt",
  "blockedResolvedAt",
  "delayReason",
  "delayDays",
  "delayStartedAt",
  "delayResolvedAt",
  "progressUpdatedByUserId",
  "completedAt",
  "dependencies",
  "requiredSkills",
  "isOnCriticalPath",
  "riskLevel",
  "riskImpact",
  "riskMitigation",
  "verificationStatus",
  "requiresVerification",
  "verifiedByUserId",
  "verifiedAt",
  "rejectedReason",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  COALESCE("projectId", 'personProject'),
  "type",
  "subject",
  "description",
  "status",
  "priority",
  "difficulty",
  "origin",
  "createdByUserId",
  "assigneeId",
  "parentId",
  "startDate",
  "dueDate",
  "estimateHours",
  "percentComplete",
  "lastProgressNote",
  "blockedReason",
  "blockedStartedAt",
  "blockedResolvedAt",
  "delayReason",
  "delayDays",
  "delayStartedAt",
  "delayResolvedAt",
  "progressUpdatedByUserId",
  "completedAt",
  "dependencies",
  "requiredSkills",
  "isOnCriticalPath",
  "riskLevel",
  "riskImpact",
  "riskMitigation",
  "verificationStatus",
  "requiresVerification",
  "verifiedByUserId",
  "verifiedAt",
  "rejectedReason",
  "createdAt",
  "updatedAt"
FROM "WorkPackage";

DROP TABLE "WorkPackage";
ALTER TABLE "new_WorkPackage" RENAME TO "WorkPackage";

CREATE INDEX "Project_createdByUserId_idx" ON "Project"("createdByUserId");
CREATE INDEX "WorkPackage_projectId_type_idx" ON "WorkPackage"("projectId", "type");
CREATE INDEX "WorkPackage_projectId_status_idx" ON "WorkPackage"("projectId", "status");
CREATE INDEX "WorkPackage_createdByUserId_idx" ON "WorkPackage"("createdByUserId");
CREATE INDEX "WorkPackage_assigneeId_idx" ON "WorkPackage"("assigneeId");
CREATE INDEX "WorkPackage_parentId_idx" ON "WorkPackage"("parentId");

PRAGMA foreign_keys=ON;
