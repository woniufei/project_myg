import { prisma } from "@/lib/prisma";
import { userHasRole } from "@/lib/rbac";
import { mapWorkPackage, toStoredVerificationStatus, type StoredWorkPackage } from "@/lib/repositories/workspace-mappers";
import { ServiceError } from "./auth-context";
import { assertCapability } from "./permission-workflow";
import type { User, WorkPackage, VerificationStatus } from "@/lib/types";

/**
 * 团队成员提交工作项完成自报。
 *
 * 约束条件：
 * - 工作项 must exist 且 requiresVerification = true
 * - 仅 assignee 本人或 admin 可操作
 * - 当前 status 必须为 "PENDING"（首次自报）或 "REJECTED"（驳回后重新提交）
 */
export async function selfReportDone(
  workPackageId: number,
  user: User
): Promise<WorkPackage> {
  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId }
  });

  if (!wp) {
    throw new ServiceError("工作项不存在。", 404);
  }

  const mapped = mapWorkPackage(wp as StoredWorkPackage);

  // 只有 requiresVerification 的工作项才允许自报
  if (!mapped.requiresVerification) {
    throw new ServiceError("该工作项不需要核对流程。", 400);
  }

  // 权限：assignee 本人或 admin
  if (!userHasRole(user, "admin") && mapped.assigneeId !== user.personId) {
    throw new ServiceError("只有工作项负责人或管理员可以提交完成。", 403);
  }

  // 仅允许从 pending 或 rejected 状态自报
  if (
    mapped.verificationStatus !== "pending" &&
    mapped.verificationStatus !== "rejected"
  ) {
    throw new ServiceError(
      `当前核对状态为 "${mapped.verificationStatus}"，无法提交完成。`,
      400
    );
  }

  const now = new Date().toISOString();

  const updated = await prisma.workPackage.update({
    where: { id: workPackageId },
    data: {
      verificationStatus: "SELF_REPORTED_DONE",
      verifiedByUserId: null,
      verifiedAt: null,
      rejectedReason: null
    }
  });

  // 记录核对事件
  await prisma.workPackageProgressEvent.create({
    data: {
      workPackageId,
      projectId: updated.projectId,
      personId: updated.assigneeId,
      userId: user.id,
      eventType: "PROGRESS_UPDATED",
      reason: `团队成员自报完成`,
      nextJson: JSON.stringify({ verificationStatus: "SELF_REPORTED_DONE" })
    }
  });

  return mapWorkPackage(updated as StoredWorkPackage);
}

/** `reject` 的别名导出，供 API 路由使用 */
export { reject as rejectVerification };

/**
 * 团队负责人（或 admin）核对通过工作项完成情况。
 *
 * 约束条件：
 * - 工作项 must exist
 * - 当前 verificationStatus 必须为 SELF_REPORTED_DONE
 * - 操作者必须拥有 verifyWorkPackages 权限
 */
export async function verify(
  workPackageId: number,
  user: User
): Promise<WorkPackage> {
  await assertCapability(user, "verifyWorkPackages");

  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId }
  });

  if (!wp) {
    throw new ServiceError("工作项不存在。", 404);
  }

  const mapped = mapWorkPackage(wp as StoredWorkPackage);

  if (mapped.verificationStatus !== "selfReportedDone") {
    throw new ServiceError(
      `当前核对状态为 "${mapped.verificationStatus}"，无法通过核对。`,
      400
    );
  }

  const now = new Date().toISOString();

  const updated = await prisma.workPackage.update({
    where: { id: workPackageId },
    data: {
      verificationStatus: "VERIFIED",
      verifiedByUserId: user.id,
      verifiedAt: now,
      rejectedReason: null
    }
  });

  // 记录核对事件
  await prisma.workPackageProgressEvent.create({
    data: {
      workPackageId,
      projectId: updated.projectId,
      personId: updated.assigneeId,
      userId: user.id,
      eventType: "PROGRESS_UPDATED",
      reason: `团队负责人核对通过`,
      nextJson: JSON.stringify({
        verificationStatus: "VERIFIED",
        verifiedByUserId: user.id,
        verifiedAt: now
      })
    }
  });

  return mapWorkPackage(updated as StoredWorkPackage);
}

/**
 * 团队负责人（或 admin）驳回工作项完成情况。
 *
 * 约束条件：
 * - 工作项 must exist
 * - 当前 verificationStatus 必须为 SELF_REPORTED_DONE
 * - 操作者必须拥有 verifyWorkPackages 权限
 * - rejectedReason 不能为空
 */
export async function reject(
  workPackageId: number,
  user: User,
  rejectedReason: string
): Promise<WorkPackage> {
  await assertCapability(user, "verifyWorkPackages");

  if (!rejectedReason || !rejectedReason.trim()) {
    throw new ServiceError("驳回时必须填写原因。", 400);
  }

  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId }
  });

  if (!wp) {
    throw new ServiceError("工作项不存在。", 404);
  }

  const mapped = mapWorkPackage(wp as StoredWorkPackage);

  if (mapped.verificationStatus !== "selfReportedDone") {
    throw new ServiceError(
      `当前核对状态为 "${mapped.verificationStatus}"，无法驳回。`,
      400
    );
  }

  const now = new Date().toISOString();
  const reason = rejectedReason.trim();

  const updated = await prisma.workPackage.update({
    where: { id: workPackageId },
    data: {
      verificationStatus: "REJECTED",
      verifiedByUserId: user.id,
      verifiedAt: now,
      rejectedReason: reason
    }
  });

  // 记录核对事件
  await prisma.workPackageProgressEvent.create({
    data: {
      workPackageId,
      projectId: updated.projectId,
      personId: updated.assigneeId,
      userId: user.id,
      eventType: "PROGRESS_UPDATED",
      reason: `团队负责人驳回：${reason}`,
      nextJson: JSON.stringify({
        verificationStatus: "REJECTED",
        verifiedByUserId: user.id,
        verifiedAt: now,
        rejectedReason: reason
      })
    }
  });

  return mapWorkPackage(updated as StoredWorkPackage);
}