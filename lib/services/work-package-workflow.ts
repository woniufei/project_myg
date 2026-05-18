import { prisma } from "@/lib/prisma";
import { isPersonalProjectId, PERSONAL_PROJECT_ID } from "@/lib/project-constants";
import {
  mapWorkPackage,
  mapWorkPackageApproval,
  mapWorkPackageComment,
  toStoredWorkPackageApprovalStatus,
  toStoredWorkPackageCommentSource,
  toStoredWorkPackageCommentType,
  toStoredDifficulty,
  toStoredWorkPackageOrigin,
  toStoredWorkPackageType,
  type StoredWorkPackage,
  type StoredWorkPackageApproval,
  type StoredWorkPackageComment
} from "@/lib/repositories/workspace-mappers";
import { userHasRole } from "@/lib/rbac";
import { isWorkPackageOverdue } from "@/lib/work-package-status";
import { createWorkPackageActivityNotifications } from "@/lib/services/notification-center";
import type {
  Priority,
  Difficulty,
  User,
  WorkPackage,
  WorkPackageApproval,
  WorkPackageApprovalStatus,
  WorkPackageComment,
  WorkPackageCommentSource,
  WorkPackageCommentType,
  WorkPackageOrigin,
  WorkPackageStatus,
  WorkPackageType
} from "@/lib/types";
import { assertProjectVisible, ServiceError } from "./auth-context";
import { assertCapability } from "./permission-workflow";

export interface RequirementInput {
  content: string;
  sortOrder?: number;
}

export interface AssignmentInput {
  personId: string;
  role?: string;
  responsibility?: string;
  sortOrder?: number;
}

export interface AttachmentInput {
  fileName: string;
  contentType: string;
  size: number;
  dataUrl: string;
}

export interface WorkPackageProgressInput {
  percentComplete?: number;
  status?: WorkPackageStatus;
  lastProgressNote?: string;
  blockedReason?: string | null;
  blockedStartedAt?: string | null;
  blockedResolvedAt?: string | null;
  delayReason?: string | null;
  delayDays?: number;
  delayStartedAt?: string | null;
  delayResolvedAt?: string | null;
  riskLevel?: WorkPackage["riskLevel"] | null;
  assigneeId?: string;
  projectId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateHours?: number | null;
  subject?: string;
  description?: string;
  priority?: Priority;
  difficulty?: Difficulty;
  parentId?: number | null;
  /** 需求项列表（项目拆解模式） */
  requirements?: Array<RequirementInput | string>;
  /** 工作项成员分工明细，支持多成员协同执行 */
  memberAssignments?: Array<AssignmentInput | string>;
  /** 工作项附件，当前用于创建时上传验收证据或说明文档。 */
  attachments?: AttachmentInput[];
}

export interface WorkPackageCreateInput {
  projectId?: string | null;
  type: WorkPackageType;
  subject: string;
  description?: string;
  status?: WorkPackageStatus;
  priority?: Priority;
  difficulty?: Difficulty;
  origin?: WorkPackageOrigin;
  assigneeId?: string;
  parentId?: number;
  startDate?: string;
  dueDate?: string;
  estimateHours?: number;
  requiredSkills?: string[];
  riskLevel?: WorkPackage["riskLevel"];
  riskImpact?: string;
  riskMitigation?: string;
  dependencies?: number[];
  lastProgressNote?: string;
  /** 需求项列表（项目拆解模式） */
  requirements?: Array<RequirementInput | string>;
  /** 工作项成员分工明细，支持多成员协同执行 */
  memberAssignments?: Array<AssignmentInput | string>;
  /** 工作项附件，当前用于本地演示预览。 */
  attachments?: AttachmentInput[];
}

export interface WorkPackageCommentInput {
  body: string;
  type?: WorkPackageCommentType;
  mentionsPersonIds?: string[];
  source?: WorkPackageCommentSource;
  sourceChannelId?: string;
  externalMessageId?: string;
  externalThreadId?: string;
  authorDisplayName?: string;
  authorPersonId?: string;
}

export interface WorkPackageApprovalInput {
  status: WorkPackageApprovalStatus;
  comment: string;
  reviewerPersonId?: string;
}

const STATUS_PROGRESS_FLOOR: Partial<Record<WorkPackageStatus, number>> = {
  review: 5,
  inProgress: 10
};

const STATUS_PROGRESS_RESET: Partial<Record<WorkPackageStatus, number>> = {
  reviewFailed: 0
};

/**
 * Creates a new work package after permission and project scope validation.
 */
export async function createWorkPackage(
  input: WorkPackageCreateInput,
  user: User
): Promise<WorkPackage> {
  const projectId = input.projectId ?? PERSONAL_PROJECT_ID;
  const isPersonal = isPersonalProjectId(projectId);

  if (isPersonal) {
    await assertCapability(user, "createPersonalWorkPackage");
  } else {
    assertProjectVisible(user, projectId);
    await assertProjectWorkPackageCreatePolicy(input, user, projectId);
  }

  if (!input.subject.trim()) {
    throw new ServiceError("工作项标题不能为空。", 400);
  }

  const requirements = normalizeRequirements(input.requirements);
  const memberAssignments = normalizeAssignments(input.memberAssignments);
  const attachments = normalizeAttachments(input.attachments);
  const primaryAssigneeId = input.assigneeId ?? memberAssignments[0]?.personId;
  assertRequirementPolicy(user, requirements);
  await assertAssignmentPolicy(input.parentId, primaryAssigneeId, memberAssignments, user, projectId);

  const created = await prisma.workPackage.create({
    data: {
      projectId,
      type: toStoredWorkPackageType(input.type),
      subject: input.subject.trim(),
      description: input.description ?? "",
      status: input.status ?? defaultStatusForType(input.type),
      priority: input.priority ?? "P1",
      difficulty: toStoredDifficulty(input.difficulty ?? "medium"),
      origin: toStoredWorkPackageOrigin(input.origin ?? (isPersonal ? "self" : "manager")),
      createdByUserId: user.id,
      assigneeId: isPersonal ? primaryAssigneeId ?? user.personId : primaryAssigneeId,
      parentId: input.parentId,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      estimateHours: input.estimateHours,
      lastProgressNote: input.lastProgressNote ?? "",
      dependencies: JSON.stringify(input.dependencies ?? []),
      requiredSkills: JSON.stringify(input.requiredSkills ?? []),
      riskLevel: input.riskLevel ? input.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" : null,
      riskImpact: input.riskImpact,
      riskMitigation: input.riskMitigation
    }
  });

  if (requirements.length > 0) {
    await prisma.workPackageRequirement.createMany({
      data: requirements.map((req, idx) => ({
        workPackageId: created.id,
        content: req.content,
        sortOrder: req.sortOrder ?? idx
      }))
    });
  }

  if (memberAssignments.length > 0) {
    await prisma.workPackageAssignment.createMany({
      data: memberAssignments.map((assignment, idx) => ({
        workPackageId: created.id,
        personId: assignment.personId,
        role: assignment.role ?? (idx === 0 ? "主负责人" : "协作成员"),
        responsibility: assignment.responsibility ?? "",
        sortOrder: assignment.sortOrder ?? idx
      }))
    });
  }

  if (attachments.length > 0) {
    await prisma.workPackageAttachment.createMany({
      data: attachments.map((attachment) => ({
        workPackageId: created.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        size: attachment.size,
        dataUrl: attachment.dataUrl
      }))
    });
  }

  // Reload to include nested relations when the Prisma delegate supports it.
  const reloaded = prisma.workPackage.findUniqueOrThrow
    ? await prisma.workPackage.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          requirements: { orderBy: { sortOrder: "asc" } },
          assignments: { orderBy: { sortOrder: "asc" } },
          attachments: { orderBy: { createdAt: "asc" } }
        }
      })
    : created;

  return mapWorkPackage(reloaded as StoredWorkPackage);
}

/**
 * Updates a work package through the server-side permission and project scope
 * boundary.
 */
export async function updateWorkPackage(
  workPackageId: number,
  input: WorkPackageProgressInput,
  user: User
): Promise<WorkPackage> {
  const wp = await loadWorkPackageForUser(workPackageId, user, "updateOwnWorkPackages");
  const isOwnParticipantWorkPackage =
    wp.createdByUserId === user.id ||
    wp.assigneeId === user.personId ||
    wp.assignments?.some((assignment) => assignment.personId === user.personId);
  const isCreatorProjectAttach = isProjectAttachOnly(input) && wp.createdByUserId === user.id;
  if (user.role === "participant" && !isOwnParticipantWorkPackage && !isCreatorProjectAttach) {
    throw new ServiceError("项目参与员只能更新本人工作项。", 403);
  }

  assertWorkPackageUpdatePolicy(wp, input, user);

  const requestedPercentComplete = input.percentComplete === undefined
    ? undefined
    : Math.min(100, Math.max(0, Math.round(input.percentComplete)));
  const status = resolveAutomatedStatus(wp, input, user, requestedPercentComplete);
  const percentComplete = resolveAutomatedPercentComplete(wp, requestedPercentComplete, status);
  const isAutomaticDeadlineBlock =
    status === "blocked" &&
    wp.status !== "blocked" &&
    input.blockedReason === undefined &&
    input.blockedStartedAt === undefined;
  const nextProjectId = resolveProjectChange(wp, input.projectId, user);
  const eventTypes = collectProgressEventTypes(wp, input, percentComplete);
  if (status === "blocked" && wp.status !== "blocked") {
    eventTypes.push("BLOCKED");
  }
  const isRequirementsUpdate = input.requirements !== undefined;
  const requirements = isRequirementsUpdate ? normalizeRequirements(input.requirements) : undefined;
  if (requirements) {
    assertRequirementPolicy(user, requirements);
  }
  const isMemberAssignmentsUpdate = input.memberAssignments !== undefined;
  const memberAssignments = isMemberAssignmentsUpdate ? normalizeAssignments(input.memberAssignments) : undefined;
  const nextAssigneeId = resolveNextAssigneeId(input, memberAssignments, user);
  if (nextAssigneeId || memberAssignments) {
    await assertAssignablePeoplePolicy(
      Array.from(new Set([nextAssigneeId, ...(memberAssignments?.map((item) => item.personId) ?? [])].filter((id): id is string => Boolean(id)))),
      user,
      wp.projectId
    );
  }

  const updated = await prisma.workPackage.update({
    where: { id: workPackageId },
    data: {
      projectId: nextProjectId,
      percentComplete,
      status,
      lastProgressNote: input.lastProgressNote,
      blockedReason: input.blockedReason === undefined
        ? isAutomaticDeadlineBlock
          ? "已超过截止日期且进度未完成，系统自动标记为阻塞。"
          : undefined
        : input.blockedReason,
      blockedStartedAt: input.blockedStartedAt === undefined
        ? isAutomaticDeadlineBlock
          ? new Date()
          : undefined
        : input.blockedStartedAt ? new Date(input.blockedStartedAt) : null,
      blockedResolvedAt: input.blockedResolvedAt === undefined ? undefined : input.blockedResolvedAt ? new Date(input.blockedResolvedAt) : null,
      delayReason: input.delayReason === undefined
        ? isAutomaticDeadlineBlock
          ? "已超过截止日期且进度未完成。"
          : undefined
        : input.delayReason,
      delayDays: input.delayDays === undefined
        ? isAutomaticDeadlineBlock
          ? calculateOverdueDays(wp, new Date())
          : undefined
        : Math.max(0, Math.round(input.delayDays)),
      delayStartedAt: input.delayStartedAt === undefined
        ? isAutomaticDeadlineBlock
          ? wp.dueDate
            ? new Date(wp.dueDate)
            : new Date()
          : undefined
        : input.delayStartedAt ? new Date(input.delayStartedAt) : null,
      delayResolvedAt: input.delayResolvedAt === undefined ? undefined : input.delayResolvedAt ? new Date(input.delayResolvedAt) : null,
      progressUpdatedByUserId: percentComplete === undefined ? undefined : user.id,
      completedAt: percentComplete !== undefined && percentComplete >= 100 ? new Date() : undefined,
      assigneeId: nextAssigneeId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      difficulty: input.difficulty ? toStoredDifficulty(input.difficulty) : undefined,
      riskLevel: input.riskLevel === undefined ? undefined : input.riskLevel ? input.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" : null,
      parentId: input.parentId === undefined ? undefined : input.parentId,
      startDate: input.startDate === undefined ? undefined : input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      estimateHours: input.estimateHours === undefined ? undefined : input.estimateHours
    }
  });

  if (isRequirementsUpdate) {
    await prisma.workPackageRequirement.deleteMany({ where: { workPackageId } });
    if (requirements!.length > 0) {
      await prisma.workPackageRequirement.createMany({
        data: requirements!.map((req, idx) => ({
          workPackageId,
          content: req.content,
          sortOrder: req.sortOrder ?? idx
        }))
      });
    }
  }

  if (isMemberAssignmentsUpdate) {
    await prisma.workPackageAssignment.deleteMany({ where: { workPackageId } });
    if (memberAssignments!.length > 0) {
      await prisma.workPackageAssignment.createMany({
        data: memberAssignments!.map((assignment, idx) => ({
          workPackageId,
          personId: assignment.personId,
          role: assignment.role ?? (idx === 0 ? "主负责人" : "协作成员"),
          responsibility: assignment.responsibility ?? "",
          sortOrder: assignment.sortOrder ?? idx
        }))
      });
      if (wp.type === "phase" && updated.projectId) {
        await ensureProjectMembershipsForTeamLeadPersons(
          updated.projectId,
          memberAssignments!.map((assignment) => assignment.personId)
        );
      }
    }
  }

  for (const eventType of eventTypes) {
    await prisma.workPackageProgressEvent.create({
      data: {
        workPackageId,
        projectId: updated.projectId,
        personId: updated.assigneeId,
        userId: user.id,
        eventType,
        reason: input.lastProgressNote ?? input.blockedReason ?? input.delayReason,
        previousJson: JSON.stringify({
          percentComplete: wp.percentComplete,
          status: wp.status,
          blockedReason: wp.blockedReason,
          delayReason: wp.delayReason,
          delayDays: wp.delayDays,
          riskLevel: wp.riskLevel
        }),
        nextJson: JSON.stringify({
          percentComplete: updated.percentComplete,
          status: updated.status,
          blockedReason: updated.blockedReason,
          delayReason: updated.delayReason,
          delayDays: updated.delayDays,
          riskLevel: updated.riskLevel
        })
      }
    });
  }

  if (updated.projectId && !isPersonalProjectId(updated.projectId) && eventTypes.length > 0) {
    await createWorkPackageActivityNotifications({
      projectId: updated.projectId,
      workPackageId,
      activityType: eventTypes.some((eventType) =>
        eventType === "BLOCKED" || eventType === "DELAYED" || eventType === "RISK_CHANGED"
      )
        ? "blocker"
        : "progress",
      content: input.lastProgressNote ?? input.blockedReason ?? input.delayReason ?? "工作项进展已更新。",
      senderPersonId: user.personId
    });
  }

  if (isRequirementsUpdate || isMemberAssignmentsUpdate) {
    const reloaded = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
      include: {
        requirements: { orderBy: { sortOrder: "asc" } },
        assignments: { orderBy: { sortOrder: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } }
      }
    });

    return mapWorkPackage((reloaded ?? updated) as StoredWorkPackage);
  }

  return mapWorkPackage(updated as StoredWorkPackage);
}

/**
 * Deletes a work package when the current user is the creator or has the
 * administrator override permission.
 */
export async function deleteWorkPackage(workPackageId: number, user: User): Promise<WorkPackage> {
  const wp = await prisma.workPackage.findUnique({ where: { id: workPackageId } });
  if (!wp) {
    throw new ServiceError("工作项不存在。", 404);
  }

  const mapped = mapWorkPackage(wp as StoredWorkPackage);
  const isCreator = mapped.createdByUserId === user.id;

  await assertCapability(user, "deleteOwnWorkPackage", mapped.projectId ? { type: "project", id: mapped.projectId } : undefined);
  if (!isCreator) {
    throw new ServiceError("只能删除本人创建的工作项。", 403);
  }

  if (mapped.projectId) {
    assertProjectVisible(user, mapped.projectId);
  }

  await prisma.workPackage.delete({ where: { id: workPackageId } });
  return mapped;
}

/**
 * Persists a work package comment or evidence record after project scope
 * validation.
 */
export async function addWorkPackageComment(
  workPackageId: number,
  input: WorkPackageCommentInput,
  user: User
): Promise<WorkPackageComment> {
  const wp = await loadWorkPackageForUser(workPackageId, user, "updateOwnWorkPackages");
  if (!input.body.trim()) {
    throw new ServiceError("评论内容不能为空。", 400);
  }

  const existing = input.externalMessageId
    ? await prisma.workPackageComment.findFirst({
        where: {
          externalMessageId: input.externalMessageId,
          source: toStoredWorkPackageCommentSource(input.source ?? "generic")
        }
      })
    : null;
  if (existing) {
    return mapWorkPackageComment(existing as StoredWorkPackageComment);
  }

  const comment = await prisma.workPackageComment.create({
    data: {
      workPackageId: wp.id,
      authorPersonId: input.authorPersonId ?? user.personId,
      body: input.body.trim(),
      type: toStoredWorkPackageCommentType(input.type ?? "comment"),
      mentionsPersonIds: JSON.stringify(input.mentionsPersonIds ?? []),
      source: toStoredWorkPackageCommentSource(input.source ?? "platform"),
      sourceChannelId: input.sourceChannelId,
      externalMessageId: input.externalMessageId,
      externalThreadId: input.externalThreadId,
      authorDisplayName: input.authorDisplayName
    }
  });

  if (wp.projectId) {
    if ((input.type ?? "comment") === "decision" && wp.status !== "done") {
      await prisma.workPackage.update({
        where: { id: wp.id },
        data: {
          status: "review",
          percentComplete: Math.max(wp.percentComplete, STATUS_PROGRESS_FLOOR.review ?? 5)
        }
      });
    }

    await createWorkPackageActivityNotifications({
      projectId: wp.projectId,
      workPackageId: wp.id,
      activityType: input.type ?? "comment",
      content: input.body.trim(),
      senderPersonId: input.authorPersonId ?? user.personId,
      commentId: comment.id
    });
  }

  return mapWorkPackageComment(comment as StoredWorkPackageComment);
}

/**
 * Persists a project-manager approval decision for a work package.
 */
export async function addWorkPackageApproval(
  workPackageId: number,
  input: WorkPackageApprovalInput,
  user: User
): Promise<WorkPackageApproval> {
  const wp = await loadWorkPackageForUser(workPackageId, user, "approveWorkPackages");
  if (!input.comment.trim()) {
    throw new ServiceError("签核意见不能为空。", 400);
  }

  const approval = await prisma.workPackageApproval.create({
    data: {
      workPackageId: wp.id,
      reviewerPersonId: input.reviewerPersonId ?? user.personId,
      status: toStoredWorkPackageApprovalStatus(input.status),
      comment: input.comment.trim()
    }
  });

  const approvalWorkflowUpdate = resolveApprovalWorkflowUpdate(input.status, wp);
  if (approvalWorkflowUpdate) {
    await prisma.workPackage.update({
      where: { id: wp.id },
      data: approvalWorkflowUpdate
    });
  }

  if (wp.projectId) {
    await createWorkPackageActivityNotifications({
      projectId: wp.projectId,
      workPackageId: wp.id,
      activityType: "approval",
      content: `${input.status === "approved" ? "同意" : "拒绝"}：${input.comment.trim()}`,
      senderPersonId: input.reviewerPersonId ?? user.personId,
      approvalId: approval.id
    });
  }

  return mapWorkPackageApproval(approval as StoredWorkPackageApproval);
}

async function loadWorkPackageForUser(
  workPackageId: number,
  user: User,
  permissionKey: string
): Promise<WorkPackage> {
  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    include: {
      requirements: { orderBy: { sortOrder: "asc" } },
      assignments: { orderBy: { sortOrder: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!wp) {
    throw new ServiceError("工作项不存在。", 404);
  }

  const mapped = mapWorkPackage(wp as StoredWorkPackage);
  await assertCapability(
    user,
    permissionKey,
    mapped.projectId ? { type: "project", id: mapped.projectId } : undefined
  );
  if (mapped.projectId) {
    assertProjectVisible(user, mapped.projectId);
  } else if (mapped.createdByUserId !== user.id && !userHasRole(user, "admin")) {
    throw new ServiceError("当前用户无权访问该个人工作项。", 403);
  }
  return mapped;
}

function defaultStatusForType(_type: WorkPackageType): WorkPackageStatus {
  return "todo";
}

function resolveProjectChange(
  workPackage: WorkPackage,
  projectId: string | null | undefined,
  user: User
): string | undefined {
  if (projectId === undefined) {
    return undefined;
  }

  if (isPersonalProjectId(projectId)) {
    if (!workPackage.projectId) {
      return undefined;
    }
    throw new ServiceError("暂不支持把项目工作项改回个人事项。", 400);
  }

  const targetProjectId = projectId;
  if (!targetProjectId) {
    throw new ServiceError("项目标识不能为空。", 400);
  }
  if (targetProjectId === workPackage.projectId) {
    return undefined;
  }

  if (workPackage.projectId) {
    throw new ServiceError("只有个人事项可以挂载到项目。", 400);
  }

  if (workPackage.createdByUserId !== user.id) {
    throw new ServiceError("只有创建者本人可以挂载个人事项。", 403);
  }

  assertProjectVisible(user, targetProjectId);
  return targetProjectId;
}

function assertWorkPackageUpdatePolicy(
  workPackage: WorkPackage,
  input: WorkPackageProgressInput,
  user: User
) {
  if (user.role === "participant") {
    const isAttachOnly = isProjectAttachOnly(input);
    const allowedKeys = new Set(isAttachOnly ? ["projectId"] : ["percentComplete", "lastProgressNote"]);
    const invalidKey = Object.keys(input).find((key) => !allowedKeys.has(key));
    if (invalidKey) {
      throw new ServiceError("项目参与员只能更新本人工作项进度，不能修改状态或分配信息。", 403);
    }
    if (isAttachOnly) {
      return;
    }
  }
}

function isProjectAttachOnly(input: WorkPackageProgressInput) {
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === "projectId" && input.projectId !== undefined;
}

function resolveAutomatedStatus(
  workPackage: WorkPackage,
  input: WorkPackageProgressInput,
  user: User,
  percentComplete: number | undefined
): WorkPackageStatus | undefined {
  const nextPercent = percentComplete ?? workPackage.percentComplete;
  const requestedStatus = user.role === "participant" ? undefined : input.status;
  let status = requestedStatus ?? inferStatusFromPercent(percentComplete, workPackage.type);

  const effectiveStatus = status ?? workPackage.status;
  if (
    effectiveStatus === "inProgress" &&
    isWorkPackageOverdue({ ...workPackage, percentComplete: nextPercent }) &&
    !workPackage.delayResolvedAt &&
    !isFinalWorkPackageStatus(effectiveStatus)
  ) {
    status = "blocked";
  }

  return status;
}

function resolveAutomatedPercentComplete(
  workPackage: WorkPackage,
  percentComplete: number | undefined,
  status: WorkPackageStatus | undefined
) {
  if (!status) {
    return percentComplete;
  }

  if (STATUS_PROGRESS_RESET[status] !== undefined) {
    return STATUS_PROGRESS_RESET[status];
  }

  if (isFinalWorkPackageStatus(status)) {
    return 100;
  }

  const baseProgress = percentComplete ?? workPackage.percentComplete;
  const floor = STATUS_PROGRESS_FLOOR[status];
  if (floor !== undefined) {
    return Math.max(baseProgress, floor);
  }

  if (status === "todo") {
    return 0;
  }

  return percentComplete;
}

function resolveApprovalWorkflowUpdate(
  status: WorkPackageApprovalStatus,
  workPackage: WorkPackage
): {
  status: WorkPackageStatus;
  percentComplete: number;
  blockedResolvedAt?: Date;
  delayReason?: string;
  delayDays?: number;
  delayStartedAt?: Date;
  delayResolvedAt?: Date;
} | undefined {
  if (status === "approved") {
    return {
      status: "inProgress",
      percentComplete: Math.max(workPackage.percentComplete, STATUS_PROGRESS_FLOOR.inProgress ?? 10),
      ...resolveRecoveredDelayAndBlock(workPackage)
    };
  }

  if (status === "changesRequested") {
    return {
      status: "review",
      percentComplete: Math.max(workPackage.percentComplete, STATUS_PROGRESS_FLOOR.review ?? 5)
    };
  }

  return undefined;
}

/**
 * Marks a previously blocked or delayed item as recovered when review passes,
 * while keeping grey history tags for later project review.
 */
function resolveRecoveredDelayAndBlock(workPackage: WorkPackage) {
  const now = new Date();
  const update: {
    blockedResolvedAt?: Date;
    delayReason?: string;
    delayDays?: number;
    delayStartedAt?: Date;
    delayResolvedAt?: Date;
  } = {};

  if (workPackage.blockedStartedAt && !workPackage.blockedResolvedAt) {
    update.blockedResolvedAt = now;
  }

  const overdueDays = calculateOverdueDays(workPackage, now);
  const shouldMarkDelay =
    overdueDays > 0 ||
    Boolean(workPackage.delayStartedAt && !workPackage.delayResolvedAt) ||
    Boolean(workPackage.delayDays && workPackage.delayDays > 0);

  if (shouldMarkDelay) {
    update.delayReason = workPackage.delayReason ?? workPackage.blockedReason ?? "评审通过后恢复推进，保留历史逾期痕迹。";
    update.delayDays = Math.max(workPackage.delayDays ?? 0, overdueDays);
    if (!workPackage.delayStartedAt) {
      update.delayStartedAt = workPackage.dueDate
        ? new Date(workPackage.dueDate)
        : workPackage.blockedStartedAt
          ? new Date(workPackage.blockedStartedAt)
          : now;
    }
    if (!workPackage.delayResolvedAt) {
      update.delayResolvedAt = now;
    }
  }

  return update;
}

function calculateOverdueDays(workPackage: Pick<WorkPackage, "dueDate">, now = new Date()) {
  if (!workPackage.dueDate) {
    return 0;
  }

  const dueAt = new Date(workPackage.dueDate);
  if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() > now.getTime()) {
    return 0;
  }

  return Math.max(1, Math.ceil((now.getTime() - dueAt.getTime()) / (24 * 60 * 60 * 1000)));
}

function isFinalWorkPackageStatus(status: WorkPackageStatus) {
  return status === "done";
}

async function assertAssignmentPolicy(
  parentId: number | undefined,
  assigneeId: string | undefined,
  assignments: AssignmentInput[],
  user: User,
  projectId?: string | null
) {
  const personIds = Array.from(new Set([
    assigneeId,
    ...assignments.map((assignment) => assignment.personId)
  ].filter((id): id is string => Boolean(id))));

  await assertAssignablePeoplePolicy(personIds, user, projectId);

  if (!parentId || user.role === "admin" || user.role === "projectManager" || user.role === "teamLead") {
    return;
  }

  const parent = await prisma.workPackage.findUnique({
    where: { id: parentId },
    include: { assignments: true }
  });
  if (!parent) {
    throw new ServiceError("父工作项不存在。", 404);
  }
  const isParentOwner =
    parent.assigneeId === user.personId ||
    parent.assignments.some((assignment) => assignment.personId === user.personId);
  if (!isParentOwner) {
    throw new ServiceError("只有工作项负责人可以继续拆分并分配子任务。", 403);
  }
}

async function assertProjectWorkPackageCreatePolicy(
  input: WorkPackageCreateInput,
  user: User,
  projectId: string
) {
  if (user.role === "projectManager") {
    if (input.type !== "phase") {
      throw new ServiceError("项目经理只能在项目计划中创建阶段。", 403);
    }
    return;
  }

  if (user.role !== "teamLead") {
    throw new ServiceError("当前角色无权在项目内直接创建工作项。", 403);
  }

  if (!input.parentId) {
    throw new ServiceError("团队负责人创建节点或任务时必须选择父级阶段或节点。", 400);
  }

  const parent = await prisma.workPackage.findUnique({
    where: { id: input.parentId },
    include: { assignments: true }
  });
  if (!parent) {
    throw new ServiceError("父工作项不存在。", 404);
  }
  if (parent.projectId !== projectId) {
    throw new ServiceError("父级工作项不属于当前项目。", 403);
  }

  if (input.type === "milestone" && parent.type === "PHASE") {
    return;
  }

  if (input.type === "task" && parent.type === "MILESTONE") {
    return;
  }

  throw new ServiceError("团队负责人只能在阶段下创建节点，并在节点下创建任务。", 403);
}

async function assertAssignablePeoplePolicy(
  personIds: string[],
  user: User,
  projectId?: string | null
) {
  if (
    personIds.length === 0 ||
    user.role === "admin" ||
    user.role === "projectManager"
  ) {
    return;
  }

  if (user.role !== "teamLead") {
    const invalid = personIds.find((personId) => personId !== user.personId);
    if (invalid) {
      throw new ServiceError("只能把工作项分配给自己。", 403);
    }
    return;
  }

  const memberships = await prisma.teamMembership.findMany({
    where: {
      personId: { in: personIds.filter((personId) => personId !== user.personId) },
      team: {
        leadId: user.personId
      }
    }
  });
  const projectMembers = projectId
    ? await prisma.user.findMany({
        where: {
          personId: { in: personIds },
          memberships: { some: { projectId } }
        },
        select: { personId: true }
      })
    : [];
  const allowedPersonIds = new Set([
    user.personId,
    ...memberships.map((membership) => membership.personId),
    ...projectMembers.map((member) => member.personId)
  ]);
  const invalid = personIds.find((personId) => !allowedPersonIds.has(personId));
  if (invalid) {
    throw new ServiceError("团队负责人只能把工作项分配给所管辖团队或项目内的成员。", 403);
  }
}

async function ensureProjectMembershipsForTeamLeadPersons(projectId: string, personIds: string[]) {
  const uniquePersonIds = Array.from(new Set(personIds.filter(Boolean)));
  if (uniquePersonIds.length === 0) {
    return;
  }

  const teamLeadUsers = await prisma.user.findMany({
    where: {
      role: "TEAM_LEAD",
      personId: { in: uniquePersonIds }
    },
    select: {
      id: true
    }
  });

  for (const teamLeadUser of teamLeadUsers) {
    await prisma.projectMembership.upsert({
      where: { userId_projectId: { userId: teamLeadUser.id, projectId } },
      create: {
        userId: teamLeadUser.id,
        projectId,
        isLead: false
      },
      update: {}
    });
  }
}

function normalizeRequirements(input: WorkPackageCreateInput["requirements"]): RequirementInput[] {
  return (input ?? [])
    .map((item, index) => {
      if (typeof item === "string") {
        return { content: item, sortOrder: index };
      }
      return { content: item.content, sortOrder: item.sortOrder ?? index };
    })
    .map((item) => ({ ...item, content: item.content.trim() }))
    .filter((item) => item.content.length > 0);
}

function normalizeAttachments(input: WorkPackageCreateInput["attachments"]): AttachmentInput[] {
  const attachments = (input ?? [])
    .map((item) => ({
      fileName: item.fileName.trim(),
      contentType: item.contentType.trim() || "application/octet-stream",
      size: Math.max(0, Math.round(item.size)),
      dataUrl: item.dataUrl.trim()
    }))
    .filter((item) => item.fileName.length > 0 && item.dataUrl.length > 0);

  if (attachments.length > 5) {
    throw new ServiceError("单个工作项最多上传 5 个附件。", 400);
  }

  const tooLarge = attachments.find((item) => item.size > 2 * 1024 * 1024);
  if (tooLarge) {
    throw new ServiceError(`附件「${tooLarge.fileName}」超过 2MB。`, 400);
  }

  const invalidDataUrl = attachments.find((item) => !item.dataUrl.startsWith("data:"));
  if (invalidDataUrl) {
    throw new ServiceError("附件内容格式不正确。", 400);
  }

  return attachments;
}

function assertRequirementPolicy(user: User, requirements: RequirementInput[]) {
  const requiresAtLeastOne =
    user.role === "admin" ||
    user.role === "projectManager" ||
    user.role === "teamLead";

  if (requiresAtLeastOne && requirements.length === 0) {
    throw new ServiceError("管理员、项目经理、团队负责人创建或更新工作项时至少需要填写 1 条需求项。", 400);
  }

  const tooLong = requirements.find((item) => item.content.length > 500);
  if (tooLong) {
    throw new ServiceError("单条需求项不能超过 500 字。", 400);
  }
}

function normalizeAssignments(input: WorkPackageCreateInput["memberAssignments"]): AssignmentInput[] {
  const seen = new Set<string>();
  const assignments = (input ?? [])
    .map((item, index) => {
      if (typeof item === "string") {
        return { personId: item, sortOrder: index };
      }
      return {
        personId: item.personId,
        role: item.role,
        responsibility: item.responsibility,
        sortOrder: item.sortOrder ?? index
      };
    })
    .map((item) => ({
      ...item,
      personId: item.personId.trim(),
      role: item.role?.trim(),
      responsibility: item.responsibility?.trim()
    }))
    .filter((item) => {
      if (!item.personId || seen.has(item.personId)) {
        return false;
      }
      seen.add(item.personId);
      return true;
    });

  const tooLong = assignments.find((item) => (item.responsibility ?? "").length > 240);
  if (tooLong) {
    throw new ServiceError("成员分工说明不能超过 240 字。", 400);
  }

  return assignments;
}

function resolveNextAssigneeId(
  input: WorkPackageProgressInput,
  memberAssignments: AssignmentInput[] | undefined,
  user: User
) {
  if (user.role === "participant") {
    return undefined;
  }

  if (input.assigneeId !== undefined) {
    return input.assigneeId;
  }

  return memberAssignments?.[0]?.personId;
}

function inferStatusFromPercent(
  percentComplete: number | undefined,
  _type: WorkPackageType
): WorkPackageStatus | undefined {
  if (percentComplete === undefined) {
    return undefined;
  }

  if (percentComplete >= 100) {
    return "done";
  }

  if (percentComplete > 0) {
    return "inProgress";
  }

  return "todo";
}

function collectProgressEventTypes(
  current: WorkPackage,
  input: WorkPackageProgressInput,
  percentComplete: number | undefined
) {
  const events: Array<"PROGRESS_UPDATED" | "BLOCKED" | "BLOCKED_RESOLVED" | "DELAYED" | "DELAY_RESOLVED" | "RISK_CHANGED" | "COMPLETED"> = [];
  if (percentComplete !== undefined && percentComplete !== current.percentComplete) {
    events.push("PROGRESS_UPDATED");
    if (percentComplete >= 100) events.push("COMPLETED");
  }
  if (input.blockedStartedAt !== undefined && input.blockedStartedAt && !current.blockedStartedAt) {
    events.push("BLOCKED");
  }
  if (input.blockedResolvedAt !== undefined && input.blockedResolvedAt) {
    events.push("BLOCKED_RESOLVED");
  }
  if ((input.delayDays ?? 0) > (current.delayDays ?? 0) || (input.delayStartedAt !== undefined && input.delayStartedAt && !current.delayStartedAt)) {
    events.push("DELAYED");
  }
  if (input.delayResolvedAt !== undefined && input.delayResolvedAt) {
    events.push("DELAY_RESOLVED");
  }
  if (input.riskLevel !== undefined && input.riskLevel !== current.riskLevel) {
    events.push("RISK_CHANGED");
  }
  return Array.from(new Set(events));
}
