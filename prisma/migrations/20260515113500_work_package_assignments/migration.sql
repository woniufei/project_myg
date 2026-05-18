-- CreateTable
CREATE TABLE "WorkPackageAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workPackageId" INTEGER NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '执行成员',
    "responsibility" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPackageAssignment_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPackageAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkPackageAssignment_workPackageId_personId_key" ON "WorkPackageAssignment"("workPackageId", "personId");

-- CreateIndex
CREATE INDEX "WorkPackageAssignment_workPackageId_idx" ON "WorkPackageAssignment"("workPackageId");

-- CreateIndex
CREATE INDEX "WorkPackageAssignment_personId_idx" ON "WorkPackageAssignment"("personId");

-- CreateIndex
CREATE INDEX "WorkPackageAssignment_workPackageId_sortOrder_idx" ON "WorkPackageAssignment"("workPackageId", "sortOrder");
