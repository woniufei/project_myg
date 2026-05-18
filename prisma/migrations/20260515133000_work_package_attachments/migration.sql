-- CreateTable
CREATE TABLE "WorkPackageAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workPackageId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPackageAttachment_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkPackageAttachment_workPackageId_idx" ON "WorkPackageAttachment"("workPackageId");

-- CreateIndex
CREATE INDEX "WorkPackageAttachment_workPackageId_createdAt_idx" ON "WorkPackageAttachment"("workPackageId", "createdAt");
