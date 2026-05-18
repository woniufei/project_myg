import type {
  WorkPackage,
  WorkPackageApproval,
  WorkPackageApprovalStatus,
  WorkPackageComment,
  WorkPackageCommentSource,
  WorkPackageCommentType,
  WorkspaceSnapshot
} from "./types";

export interface WorkPackageCollaborationInsight {
  workPackageId: number;
  workPackageSubject: string;
  assigneeId?: string;
  commentCount: number;
  decisionCount: number;
  blockerCount: number;
  pendingApproverIds: string[];
  approvedReviewerIds: string[];
  changesRequestedReviewerIds: string[];
  status: WorkPackageApprovalStatus;
  aiSummary: string;
  nextAction: string;
}

/**
 * Builds work-package-level collaboration insights from comments and approvals.
 */
export function buildWorkPackageCollaborationInsights(
  snapshot: WorkspaceSnapshot
): WorkPackageCollaborationInsight[] {
  return snapshot.workPackages
    .filter((wp) => wp.type !== "risk")
    .map((wp) =>
      buildWorkPackageCollaborationInsight(wp, snapshot.workPackageComments, snapshot.workPackageApprovals)
    )
    .sort((left, right) => {
      const statusWeight = getApprovalWeight(right.status) - getApprovalWeight(left.status);
      if (statusWeight !== 0) {
        return statusWeight;
      }

      return right.blockerCount - left.blockerCount;
    });
}

/**
 * Builds one work package's collaboration insight with an AI-style summary.
 */
export function buildWorkPackageCollaborationInsight(
  workPackage: WorkPackage,
  comments: WorkPackageComment[],
  approvals: WorkPackageApproval[]
): WorkPackageCollaborationInsight {
  const wpComments = comments.filter((comment) => comment.workPackageId === workPackage.id);
  const wpApprovals = approvals.filter((approval) => approval.workPackageId === workPackage.id);
  const pending = wpApprovals.filter((approval) => approval.status === "pending");
  const approved = wpApprovals.filter((approval) => approval.status === "approved");
  const changesRequested = wpApprovals.filter((approval) => approval.status === "changesRequested");
  const blockerCount = wpComments.filter((comment) => comment.type === "blocker").length;
  const decisionCount = wpComments.filter((comment) => comment.type === "decision").length;
  const status = inferApprovalStatus(workPackage, pending, approved, changesRequested);

  return {
    workPackageId: workPackage.id,
    workPackageSubject: workPackage.subject,
    assigneeId: workPackage.assigneeId,
    commentCount: wpComments.length,
    decisionCount,
    blockerCount,
    pendingApproverIds: pending.map((approval) => approval.reviewerPersonId),
    approvedReviewerIds: approved.map((approval) => approval.reviewerPersonId),
    changesRequestedReviewerIds: changesRequested.map((approval) => approval.reviewerPersonId),
    status,
    aiSummary: summarizeCollaboration(workPackage, wpComments, wpApprovals),
    nextAction: buildNextAction(workPackage, status, wpComments)
  };
}

/**
 * Creates an approval entry with a deterministic shape for UI actions and tests.
 */
export function createWorkPackageApproval(
  workPackageId: number,
  reviewerPersonId: string,
  status: Exclude<WorkPackageApprovalStatus, "pending">,
  comment: string,
  now = new Date()
): WorkPackageApproval {
  return {
    id: `approval-${workPackageId}-${reviewerPersonId}-${Date.parse(now.toISOString())}`,
    workPackageId,
    reviewerPersonId,
    status,
    comment,
    createdAt: now.toISOString()
  };
}

/**
 * Creates a typed collaboration comment for evidence, decisions, or blockers.
 */
export function createWorkPackageComment(
  workPackageId: number,
  authorPersonId: string,
  body: string,
  type: WorkPackageCommentType = "comment",
  mentionsPersonIds: string[] = [],
  now = new Date(),
  metadata: Partial<
    Pick<
      WorkPackageComment,
      "source" | "sourceChannelId" | "externalMessageId" | "externalThreadId" | "authorDisplayName"
    >
  > = {}
): WorkPackageComment {
  return {
    id: `comment-${workPackageId}-${authorPersonId}-${Date.parse(now.toISOString())}`,
    workPackageId,
    authorPersonId,
    body,
    type,
    createdAt: now.toISOString(),
    mentionsPersonIds,
    source: "platform",
    ...metadata
  };
}

export interface ExternalWorkPackageCommentPayload {
  source: Exclude<WorkPackageCommentSource, "platform">;
  text: string;
  externalMessageId: string;
  senderName: string;
  /** Optional explicit work package id. */
  workPackageId?: number;
  senderPersonId?: string;
  sourceChannelId?: string;
  externalThreadId?: string;
}

export interface ImportExternalWorkPackageCommentResult {
  status: "imported" | "duplicate" | "unmatched";
  comment?: WorkPackageComment;
  reason?: string;
}

/**
 * Imports an IM message as a work package comment after mapping it to a work
 * package and author.
 */
export function importExternalWorkPackageComment(
  payload: ExternalWorkPackageCommentPayload,
  snapshot: Pick<WorkspaceSnapshot, "workPackages" | "people" | "workPackageComments">,
  now = new Date()
): ImportExternalWorkPackageCommentResult {
  if (
    snapshot.workPackageComments.some(
      (comment) => comment.externalMessageId === payload.externalMessageId
    )
  ) {
    return { status: "duplicate", reason: "外部消息已回流，跳过重复写入。" };
  }

  const workPackageId =
    payload.workPackageId ?? inferWorkPackageId(payload.text, snapshot.workPackages);
  if (workPackageId === undefined || !snapshot.workPackages.some((wp) => wp.id === workPackageId)) {
    return { status: "unmatched", reason: "未能从外部消息中识别工作项 ID。" };
  }

  const authorPersonId =
    payload.senderPersonId ??
    snapshot.people.find((person) => payload.senderName.includes(person.name))?.id ??
    snapshot.workPackages.find((wp) => wp.id === workPackageId)?.assigneeId ??
    snapshot.people[0]?.id;

  if (!authorPersonId) {
    return { status: "unmatched", reason: "未能映射外部消息作者。" };
  }

  return {
    status: "imported",
    comment: createWorkPackageComment(
      workPackageId,
      authorPersonId,
      normalizeExternalText(payload),
      inferCommentType(payload.text),
      inferMentions(payload.text, snapshot.people),
      now,
      {
        source: payload.source,
        sourceChannelId: payload.sourceChannelId,
        externalMessageId: payload.externalMessageId,
        externalThreadId: payload.externalThreadId,
        authorDisplayName: payload.senderName
      }
    )
  };
}

function inferApprovalStatus(
  workPackage: WorkPackage,
  pending: WorkPackageApproval[],
  approved: WorkPackageApproval[],
  changesRequested: WorkPackageApproval[]
): WorkPackageApprovalStatus {
  if (changesRequested.length > 0 || workPackage.status === "blocked") {
    return "changesRequested";
  }

  if (pending.length > 0 || (workPackage.status === "review" && approved.length === 0)) {
    return "pending";
  }

  if (approved.length > 0 || workPackage.status === "done") {
    return "approved";
  }

  return "pending";
}

function summarizeCollaboration(
  workPackage: WorkPackage,
  comments: WorkPackageComment[],
  approvals: WorkPackageApproval[]
): string {
  const latestComment = [...comments].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )[0];
  const approval = [...approvals].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )[0];
  const blockers = comments.filter((comment) => comment.type === "blocker").length;
  const decisions = comments.filter((comment) => comment.type === "decision").length;
  const fragments = [
    `${workPackage.subject} 当前进度 ${workPackage.percentComplete}%`,
    comments.length ? `沉淀 ${comments.length} 条协作记录` : "暂无协作记录",
    decisions ? `${decisions} 条决策已沉淀` : "暂无明确决策",
    blockers ? `${blockers} 个阻塞待处理` : "未发现协作阻塞"
  ];

  if (latestComment) {
    fragments.push(`最新证据：${latestComment.body}`);
  }

  if (approval) {
    fragments.push(`最近签核：${approval.status}，${approval.comment}`);
  }

  return fragments.join("；");
}

function buildNextAction(
  workPackage: WorkPackage,
  status: WorkPackageApprovalStatus,
  comments: WorkPackageComment[]
): string {
  if (status === "changesRequested") {
    return "补充证据并重新提交项目经理签核";
  }

  if (status === "pending") {
    return workPackage.status === "review" ? "等待项目经理完成签核" : "补充工作项证据后进入评审";
  }

  if (comments.some((comment) => comment.type === "decision")) {
    return "把已批准决策同步到计划与通知中心";
  }

  return "保持进展更新并沉淀关键结论";
}

function inferWorkPackageId(text: string, workPackages: WorkPackage[]): number | undefined {
  const explicit = text.match(/[#＃](\d+)/)?.[1];
  if (explicit) {
    const id = Number(explicit);
    if (workPackages.some((wp) => wp.id === id)) {
      return id;
    }
  }

  return workPackages.find((wp) => text.toLowerCase().includes(wp.subject.toLowerCase()))?.id;
}

function inferCommentType(text: string): WorkPackageCommentType {
  if (/阻塞|卡住|无法|风险/.test(text)) {
    return "blocker";
  }

  if (/决定|决策|结论|采用|确认/.test(text)) {
    return "decision";
  }

  if (/证据|截图|链接|已完成|补充|验证/.test(text)) {
    return "evidence";
  }

  return "comment";
}

function inferMentions(text: string, people: WorkspaceSnapshot["people"]): string[] {
  return people
    .filter((person) => text.includes(`@${person.name}`) || text.includes(person.name))
    .map((person) => person.id);
}

function normalizeExternalText(payload: ExternalWorkPackageCommentPayload): string {
  const sourceLabel: Record<Exclude<WorkPackageCommentSource, "platform">, string> = {
    feishu: "飞书",
    wecomBot: "企业微信",
    dingtalk: "钉钉",
    slack: "Slack",
    email: "邮件",
    generic: "外部系统"
  };

  return `【${sourceLabel[payload.source]}回流】${payload.text.trim()}`;
}

function getApprovalWeight(status: WorkPackageApprovalStatus): number {
  if (status === "changesRequested") {
    return 3;
  }

  if (status === "pending") {
    return 2;
  }

  return 1;
}
