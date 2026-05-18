-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "skills" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "health" TEXT NOT NULL DEFAULT 'MEDIUM',
    "initialDifficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "difficultyOverride" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "enabledModules" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" TEXT,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkPackage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkPackage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkPackage_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPackageRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workPackageId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPackageRequirement_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPackageComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workPackageId" INTEGER NOT NULL,
    "authorPersonId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mentionsPersonIds" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'PLATFORM',
    "sourceChannelId" TEXT,
    "externalMessageId" TEXT,
    "externalThreadId" TEXT,
    "authorDisplayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPackageComment_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPackageComment_authorPersonId_fkey" FOREIGN KEY ("authorPersonId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPackageApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workPackageId" INTEGER NOT NULL,
    "reviewerPersonId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPackageApproval_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPackageApproval_reviewerPersonId_fkey" FOREIGN KEY ("reviewerPersonId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPackageProgressEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workPackageId" INTEGER NOT NULL,
    "projectId" TEXT,
    "phaseRef" TEXT,
    "nodeRef" TEXT,
    "personId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "reason" TEXT,
    "previousJson" TEXT NOT NULL DEFAULT '{}',
    "nextJson" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPackageProgressEvent_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPackageImpactEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "sourceWorkPackageId" INTEGER NOT NULL,
    "impactedWorkPackageId" INTEGER NOT NULL,
    "dependencyPathJson" TEXT NOT NULL DEFAULT '[]',
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPackageImpactEvent_sourceWorkPackageId_fkey" FOREIGN KEY ("sourceWorkPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPackageImpactEvent_impactedWorkPackageId_fkey" FOREIGN KEY ("impactedWorkPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StewardMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StewardMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "audienceRoles" TEXT NOT NULL DEFAULT '[]',
    "audiencePersonIds" TEXT NOT NULL DEFAULT '[]',
    "secret" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "eventTypes" TEXT NOT NULL DEFAULT '[]',
    "minLevel" TEXT NOT NULL,
    "audienceRoles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationRuleChannel" (
    "ruleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    PRIMARY KEY ("ruleId", "channelId"),
    CONSTRAINT "NotificationRuleChannel_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationRuleChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "NotificationChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "audienceRoles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDelivery_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "NotificationChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationDelivery_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformFeatureFlag" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "siteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "roleOverrides" TEXT NOT NULL DEFAULT '{}',
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PermissionOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'global',
    "scopeId" TEXT NOT NULL DEFAULT '__global__',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "allowedTools" TEXT NOT NULL DEFAULT '[]',
    "allowedRoles" TEXT NOT NULL DEFAULT '[]',
    "qpsLimit" INTEGER NOT NULL DEFAULT 5,
    "dailyLimit" INTEGER NOT NULL DEFAULT 1000,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentToolInvocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toolName" TEXT NOT NULL,
    "callerUserId" TEXT,
    "callerApiKeyId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'rest',
    "inputJson" TEXT NOT NULL DEFAULT '{}',
    "outputJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "parentInvocationId" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentToolInvocation_callerUserId_fkey" FOREIGN KEY ("callerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentToolInvocation_callerApiKeyId_fkey" FOREIGN KEY ("callerApiKeyId") REFERENCES "AgentApiKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentBreakdownDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "analysisJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentBreakdownDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentBreakdownDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleBaseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "appliedByUserId" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduleScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "baselineId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "draftJson" TEXT NOT NULL,
    "agentSummary" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleScenario_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "ScheduleBaseline" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "targetRef" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleChange_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScheduleScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectQualitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "scenarioId" TEXT,
    "baselineId" TEXT,
    "projectProgress" INTEGER NOT NULL,
    "projectDifficulty" TEXT NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "phaseCount" INTEGER NOT NULL,
    "nodeCount" INTEGER NOT NULL,
    "taskItemCount" INTEGER NOT NULL,
    "metricJson" TEXT NOT NULL DEFAULT '{}',
    "aiContextJson" TEXT NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectQualitySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectQualityMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityRef" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "numericValue" REAL,
    "textValue" TEXT,
    "difficultyValue" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "personId" TEXT,
    "teamRef" TEXT,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectQualityMetric_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ProjectQualitySnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectQualityMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE INDEX "TeamMembership_personId_idx" ON "TeamMembership"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_personId_key" ON "TeamMembership"("teamId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_identifier_key" ON "Project"("identifier");

-- CreateIndex
CREATE INDEX "Project_parentId_idx" ON "Project"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMembership_userId_projectId_key" ON "ProjectMembership"("userId", "projectId");

-- CreateIndex
CREATE INDEX "WorkPackage_projectId_type_idx" ON "WorkPackage"("projectId", "type");

-- CreateIndex
CREATE INDEX "WorkPackage_projectId_status_idx" ON "WorkPackage"("projectId", "status");

-- CreateIndex
CREATE INDEX "WorkPackage_createdByUserId_idx" ON "WorkPackage"("createdByUserId");

-- CreateIndex
CREATE INDEX "WorkPackage_assigneeId_idx" ON "WorkPackage"("assigneeId");

-- CreateIndex
CREATE INDEX "WorkPackage_parentId_idx" ON "WorkPackage"("parentId");

-- CreateIndex
CREATE INDEX "WorkPackageRequirement_workPackageId_idx" ON "WorkPackageRequirement"("workPackageId");

-- CreateIndex
CREATE INDEX "WorkPackageRequirement_workPackageId_sortOrder_idx" ON "WorkPackageRequirement"("workPackageId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkPackageComment_workPackageId_createdAt_idx" ON "WorkPackageComment"("workPackageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPackageComment_source_externalMessageId_key" ON "WorkPackageComment"("source", "externalMessageId");

-- CreateIndex
CREATE INDEX "WorkPackageApproval_workPackageId_createdAt_idx" ON "WorkPackageApproval"("workPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkPackageProgressEvent_workPackageId_occurredAt_idx" ON "WorkPackageProgressEvent"("workPackageId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkPackageProgressEvent_projectId_occurredAt_idx" ON "WorkPackageProgressEvent"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkPackageProgressEvent_personId_eventType_idx" ON "WorkPackageProgressEvent"("personId", "eventType");

-- CreateIndex
CREATE INDEX "WorkPackageProgressEvent_eventType_occurredAt_idx" ON "WorkPackageProgressEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkPackageImpactEvent_projectId_createdAt_idx" ON "WorkPackageImpactEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkPackageImpactEvent_sourceWorkPackageId_idx" ON "WorkPackageImpactEvent"("sourceWorkPackageId");

-- CreateIndex
CREATE INDEX "WorkPackageImpactEvent_impactedWorkPackageId_idx" ON "WorkPackageImpactEvent"("impactedWorkPackageId");

-- CreateIndex
CREATE INDEX "WorkPackageImpactEvent_resolvedAt_idx" ON "WorkPackageImpactEvent"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionOverride_subjectType_subjectId_permissionKey_scopeType_scopeId_key" ON "PermissionOverride"("subjectType", "subjectId", "permissionKey", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "PermissionOverride_subjectType_subjectId_idx" ON "PermissionOverride"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "PermissionOverride_permissionKey_idx" ON "PermissionOverride"("permissionKey");

-- CreateIndex
CREATE INDEX "PermissionOverride_scopeType_scopeId_idx" ON "PermissionOverride"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentApiKey_keyPrefix_key" ON "AgentApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "AgentToolInvocation_toolName_createdAt_idx" ON "AgentToolInvocation"("toolName", "createdAt");

-- CreateIndex
CREATE INDEX "AgentToolInvocation_callerUserId_createdAt_idx" ON "AgentToolInvocation"("callerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentToolInvocation_callerApiKeyId_createdAt_idx" ON "AgentToolInvocation"("callerApiKeyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolInvocation_idempotencyKey_toolName_key" ON "AgentToolInvocation"("idempotencyKey", "toolName");

-- CreateIndex
CREATE INDEX "ScheduleBaseline_projectId_appliedAt_idx" ON "ScheduleBaseline"("projectId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBaseline_projectId_version_key" ON "ScheduleBaseline"("projectId", "version");

-- CreateIndex
CREATE INDEX "ScheduleScenario_projectId_status_idx" ON "ScheduleScenario"("projectId", "status");

-- CreateIndex
CREATE INDEX "ScheduleScenario_projectId_updatedAt_idx" ON "ScheduleScenario"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "ScheduleChange_scenarioId_createdAt_idx" ON "ScheduleChange"("scenarioId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectQualitySnapshot_projectId_createdAt_idx" ON "ProjectQualitySnapshot"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectQualitySnapshot_projectId_source_createdAt_idx" ON "ProjectQualitySnapshot"("projectId", "source", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectQualitySnapshot_scenarioId_idx" ON "ProjectQualitySnapshot"("scenarioId");

-- CreateIndex
CREATE INDEX "ProjectQualitySnapshot_baselineId_idx" ON "ProjectQualitySnapshot"("baselineId");

-- CreateIndex
CREATE INDEX "ProjectQualityMetric_snapshotId_idx" ON "ProjectQualityMetric"("snapshotId");

-- CreateIndex
CREATE INDEX "ProjectQualityMetric_projectId_entityType_metricKey_idx" ON "ProjectQualityMetric"("projectId", "entityType", "metricKey");

-- CreateIndex
CREATE INDEX "ProjectQualityMetric_personId_metricKey_idx" ON "ProjectQualityMetric"("personId", "metricKey");

-- CreateIndex
CREATE INDEX "ProjectQualityMetric_teamRef_metricKey_idx" ON "ProjectQualityMetric"("teamRef", "metricKey");
