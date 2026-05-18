-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "cardTemplateJson" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "workPackageId" INTEGER,
    "commentId" TEXT,
    "approvalId" TEXT,
    "senderPersonId" TEXT,
    "recipientPersonId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionRequired" BOOLEAN NOT NULL DEFAULT false,
    "decisionStatus" TEXT NOT NULL DEFAULT 'NONE',
    "readAt" DATETIME,
    "decidedByUserId" TEXT,
    "decidedAt" DATETIME,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationMessage_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationMessage_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "WorkPackageComment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationMessage_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "WorkPackageApproval" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationMessage_senderPersonId_fkey" FOREIGN KEY ("senderPersonId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationMessage_recipientPersonId_fkey" FOREIGN KEY ("recipientPersonId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationMessage_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_activityType_key" ON "NotificationTemplate"("activityType");

-- CreateIndex
CREATE INDEX "NotificationMessage_recipientUserId_createdAt_idx" ON "NotificationMessage"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationMessage_recipientPersonId_createdAt_idx" ON "NotificationMessage"("recipientPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationMessage_projectId_createdAt_idx" ON "NotificationMessage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationMessage_workPackageId_createdAt_idx" ON "NotificationMessage"("workPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationMessage_commentId_idx" ON "NotificationMessage"("commentId");

-- CreateIndex
CREATE INDEX "NotificationMessage_activityType_decisionStatus_idx" ON "NotificationMessage"("activityType", "decisionStatus");
