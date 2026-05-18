import { prisma } from "@/lib/prisma";
import { buildPayloadForChannel } from "@/lib/notifications/channels";
import { roleLabels, userHasRole } from "@/lib/rbac";
import type {
  NotificationActivityType,
  NotificationDecisionStatus,
  NotificationMessage,
  NotificationTemplate,
  User,
  WorkPackageApprovalStatus,
  WorkPackageCommentType
} from "@/lib/types";
import { assertProjectVisible, ServiceError } from "./auth-context";
import { assertCapability } from "./permission-workflow";

interface TemplateSeed {
  activityType: NotificationActivityType;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
}

export interface NotificationTemplateInput {
  id?: string;
  activityType?: NotificationActivityType;
  name?: string;
  titleTemplate: string;
  bodyTemplate: string;
  enabled?: boolean;
  cardTemplate?: Record<string, unknown>;
}

export interface WorkPackageActivityNotificationInput {
  projectId: string;
  workPackageId: number;
  activityType: WorkPackageCommentType | "approval" | "progress";
  content: string;
  senderPersonId?: string;
  commentId?: string;
  approvalId?: string;
}

export interface ResolveDecisionInput {
  messageId: string;
  decision: Exclude<WorkPackageApprovalStatus, "pending">;
  approvalId?: string;
  decidedByUser: User;
}

const ACTIVITY_LABELS: Record<NotificationActivityType, string> = {
  comment: "评论",
  decision: "待决策",
  blocker: "阻塞",
  evidence: "证据",
  approval: "决策结果",
  progress: "进展"
};

const DEFAULT_NOTIFICATION_TEMPLATES: TemplateSeed[] = [
  {
    activityType: "comment",
    name: "项目评论提醒",
    titleTemplate: "{projectName} 有新的项目评论",
    bodyTemplate: "{projectName} 的成员 {actorName} 围绕工作项「{workPackageSubject}」发表了评论：{content}"
  },
  {
    activityType: "decision",
    name: "待决策提醒",
    titleTemplate: "{projectName} 发起待决策事项",
    bodyTemplate:
      "{projectName} 的成员 {actorName} 发起了一项待决策信息，关联工作项「{workPackageSubject}」。请团队负责人或项目经理确认同意/拒绝后再推进状态流转：{content}"
  },
  {
    activityType: "blocker",
    name: "阻塞同步提醒",
    titleTemplate: "{projectName} 出现阻塞信息",
    bodyTemplate: "{projectName} 的成员 {actorName} 反馈工作项「{workPackageSubject}」存在阻塞：{content}"
  },
  {
    activityType: "evidence",
    name: "证据留痕提醒",
    titleTemplate: "{projectName} 新增交付证据",
    bodyTemplate: "{projectName} 的成员 {actorName} 为工作项「{workPackageSubject}」补充了交付证据：{content}"
  },
  {
    activityType: "approval",
    name: "决策结果提醒",
    titleTemplate: "{projectName} 决策已完成",
    bodyTemplate: "{projectName} 的 {actorName} 已对工作项「{workPackageSubject}」完成决策：{content}"
  },
  {
    activityType: "progress",
    name: "进展提醒",
    titleTemplate: "{projectName} 工作项进展更新",
    bodyTemplate: "{projectName} 的成员 {actorName} 更新了工作项「{workPackageSubject}」的进展：{content}"
  }
];

const DEMO_NOTIFICATION_MESSAGES = [
  {
    id: "notif-role-demo-pm-comment",
    projectId: "proj-ai-pm",
    projectName: "AI 项目管理平台",
    projectIdentifier: "ai-pm",
    workPackageId: 2,
    workPackageSubject: "实现对话式任务拆解",
    senderPersonId: "p3",
    senderName: "后端开发",
    recipientPersonId: "p1",
    recipientUserId: "u-pm",
    activityType: "comment" as const,
    title: "AI 项目管理平台 有新的项目评论",
    body: "AI 项目管理平台的成员 后端开发 围绕工作项「实现对话式任务拆解」发表了评论：服务端接口已完成联调，建议项目经理确认下一轮验收窗口。",
    actionRequired: false,
    decisionStatus: "none" as const,
    payload: { channelType: "feishu", preview: "项目经理评论提醒卡片消息预览" },
    createdAt: "2026-05-15T07:10:00.000Z"
  },
  {
    id: "notif-role-demo-lead-decision",
    projectId: "proj-ai-pm",
    projectName: "AI 项目管理平台",
    projectIdentifier: "ai-pm",
    workPackageId: 4,
    workPackageSubject: "Docker 与 VPS 部署模板",
    senderPersonId: "p4",
    senderName: "测试与部署",
    recipientPersonId: "p3",
    recipientUserId: "u-teamlead",
    activityType: "decision" as const,
    title: "AI 项目管理平台 发起待决策事项",
    body: "AI 项目管理平台的成员 测试与部署 发起了一项待决策信息，关联工作项「Docker 与 VPS 部署模板」。请团队负责人或项目经理确认同意/拒绝后再推进状态流转：是否先按模拟凭据完成 CI 验证，再等待正式 VPS 凭据接入？",
    actionRequired: true,
    decisionStatus: "pending" as const,
    payload: { channelType: "feishu", preview: "团队负责人待决策卡片消息预览" },
    createdAt: "2026-05-15T07:11:00.000Z"
  },
  {
    id: "notif-role-demo-member-evidence",
    projectId: "proj-ai-pm",
    projectName: "AI 项目管理平台",
    projectIdentifier: "ai-pm",
    workPackageId: 3,
    workPackageSubject: "构建 OpenProject 风格工作项表格与详情面板",
    senderPersonId: "p1",
    senderName: "项目经理",
    recipientPersonId: "p2",
    recipientUserId: "u-member",
    activityType: "evidence" as const,
    title: "AI 项目管理平台 新增交付证据",
    body: "AI 项目管理平台的成员 项目经理 为工作项「构建 OpenProject 风格工作项表格与详情面板」补充了交付证据：UI 复审截图和验收口径已归档，项目参与员可进入工作项查看。",
    actionRequired: false,
    decisionStatus: "none" as const,
    payload: { channelType: "feishu", preview: "项目参与员证据提醒卡片消息预览" },
    createdAt: "2026-05-15T07:12:00.000Z"
  }
];

/**
 * Lists notification templates, creating the first-version defaults when the
 * database has no template configuration yet.
 */
export async function listNotificationTemplates(): Promise<NotificationTemplate[]> {
  try {
    if (!hasNotificationTemplateDelegate()) {
      return DEFAULT_NOTIFICATION_TEMPLATES.map((template) => ({
        ...template,
        id: `default-${template.activityType}`,
        cardTemplate: {},
        enabled: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }));
    }
    await ensureDefaultNotificationTemplates();
    const templates = await prisma.notificationTemplate.findMany({
      orderBy: { activityType: "asc" }
    });
    return templates.map(mapNotificationTemplate);
  } catch {
    return DEFAULT_NOTIFICATION_TEMPLATES.map((template) => ({
      ...template,
      id: `default-${template.activityType}`,
      cardTemplate: {},
      enabled: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    }));
  }
}

/**
 * Saves editable template copy. The template type remains stable so existing
 * activity routing keeps a predictable audit contract.
 */
export async function saveNotificationTemplates(
  inputs: NotificationTemplateInput[],
  user: User
): Promise<NotificationTemplate[]> {
  await assertCapability(user, "manageNotifications");
  await ensureDefaultNotificationTemplates();

  for (const input of inputs) {
    const titleTemplate = input.titleTemplate.trim();
    const bodyTemplate = input.bodyTemplate.trim();
    if (!titleTemplate || !bodyTemplate) {
      throw new ServiceError("通知模板标题和正文不能为空。", 400);
    }

    if (input.id) {
      await prisma.notificationTemplate.update({
        where: { id: input.id },
        data: {
          name: input.name?.trim() || undefined,
          titleTemplate,
          bodyTemplate,
          enabled: input.enabled,
          cardTemplateJson: JSON.stringify(input.cardTemplate ?? {})
        }
      });
      continue;
    }

    if (!input.activityType) {
      throw new ServiceError("新增通知模板必须指定活动类型。", 400);
    }

    await prisma.notificationTemplate.upsert({
      where: { activityType: toStoredActivityType(input.activityType) },
      create: {
        activityType: toStoredActivityType(input.activityType),
        name: input.name?.trim() || ACTIVITY_LABELS[input.activityType],
        titleTemplate,
        bodyTemplate,
        enabled: input.enabled ?? true,
        cardTemplateJson: JSON.stringify(input.cardTemplate ?? {})
      },
      update: {
        name: input.name?.trim() || ACTIVITY_LABELS[input.activityType],
        titleTemplate,
        bodyTemplate,
        enabled: input.enabled ?? true,
        cardTemplateJson: JSON.stringify(input.cardTemplate ?? {})
      }
    });
  }

  return listNotificationTemplates();
}

/**
 * Lists persisted notification messages visible to the current user. Admins can
 * audit all rows; other roles see rows addressed to their project memberships.
 */
export async function listNotificationMessages(user: User): Promise<NotificationMessage[]> {
  try {
    if (!hasNotificationMessageDelegate()) {
      return fallbackNotificationMessages(user);
    }
    await ensureDemoNotificationMessages();
    const visibleProjectIds = Array.from(new Set([
      ...user.managedProjectIds,
      ...user.participatingProjectIds
    ]));
    const messages = await prisma.notificationMessage.findMany({
      where: userHasRole(user, "admin")
        ? undefined
        : {
            OR: [
              { recipientUserId: user.id },
              { recipientPersonId: user.personId },
              { projectId: { in: visibleProjectIds } }
            ]
          },
      include: {
        project: true,
        workPackage: true,
        senderPerson: true,
        recipientUser: true,
        decidedBy: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return messages.map((message) => mapNotificationMessage(message, user));
  } catch {
    return fallbackNotificationMessages(user);
  }
}

/**
 * Creates one persisted notification row for every current project member.
 * Decision notifications are actionable only for project managers, team leads,
 * and admins; other recipients receive a view-only audit message.
 */
export async function createWorkPackageActivityNotifications(
  input: WorkPackageActivityNotificationInput
): Promise<NotificationMessage[]> {
  if (!hasNotificationTemplateDelegate() || !hasNotificationMessageDelegate()) {
    return [];
  }

  const template = await resolveTemplate(input.activityType);
  if (!template?.enabled) {
    return [];
  }

  const [project, workPackage, sender, recipients] = await Promise.all([
    prisma.project.findUnique({ where: { id: input.projectId } }),
    prisma.workPackage.findUnique({ where: { id: input.workPackageId } }),
    input.senderPersonId ? prisma.person.findUnique({ where: { id: input.senderPersonId } }) : null,
    resolveProjectRecipients(input.projectId, input.activityType)
  ]);
  if (!project || !workPackage || recipients.length === 0) {
    return [];
  }

  const values = {
    projectName: project.name,
    actorName: sender?.name ?? "项目成员",
    workPackageSubject: workPackage.subject,
    activityLabel: ACTIVITY_LABELS[input.activityType],
    content: input.content
  };
  const title = renderTemplate(template.titleTemplate, values);
  const body = renderTemplate(template.bodyTemplate, values);
  const activityType = toStoredActivityType(input.activityType);
  const messages = await prisma.$transaction(
    recipients.map((recipient) => {
      const actionRequired = input.activityType === "decision" && canStoredRoleHandleDecision(recipient.user.role);
      return prisma.notificationMessage.create({
        data: {
          projectId: input.projectId,
          workPackageId: input.workPackageId,
          commentId: input.commentId,
          approvalId: input.approvalId,
          senderPersonId: input.senderPersonId,
          recipientPersonId: recipient.user.personId,
          recipientUserId: recipient.user.id,
          activityType,
          title,
          body,
          actionRequired,
          decisionStatus: input.activityType === "decision" ? "PENDING" : "NONE",
          payloadJson: JSON.stringify(buildFeishuAuditPayload(
            title,
            body,
            input.activityType,
            recipient.user.person?.externalId ?? undefined
          ))
        }
      });
    })
  );

  if (input.activityType === "decision") {
    await sendFeishuDecisionWebhook(title, body);
  }

  return messages.map((message) => mapNotificationMessage(message, undefined));
}

/**
 * Lists project notification history for a work package detail page.
 */
export async function listWorkPackageNotificationHistory(
  projectId: string,
  workPackageId: number,
  user: User
): Promise<NotificationMessage[]> {
  if (!hasNotificationMessageDelegate()) {
    return [];
  }
  assertProjectVisible(user, projectId);
  const messages = await prisma.notificationMessage.findMany({
    where: { projectId, workPackageId },
    include: {
      project: true,
      workPackage: true,
      senderPerson: true,
      recipientUser: true,
      decidedBy: true
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return messages.map((message) => mapNotificationMessage(message, user));
}

/**
 * Marks a decision notification group as resolved after one authorized reviewer
 * has approved or rejected the underlying work item.
 */
export async function resolveDecisionNotifications(input: ResolveDecisionInput): Promise<void> {
  if (!hasNotificationMessageDelegate()) {
    return;
  }

  const message = await prisma.notificationMessage.findUnique({
    where: { id: input.messageId }
  });
  if (!message) {
    throw new ServiceError("通知不存在。", 404);
  }
  assertProjectVisible(input.decidedByUser, message.projectId);
  if (!canUserHandleDecision(input.decidedByUser.role)) {
    throw new ServiceError("只有团队负责人或项目经理可以处理待决策通知。", 403);
  }
  if (message.activityType !== "DECISION") {
    throw new ServiceError("该通知不是待决策类型。", 400);
  }
  if (message.decisionStatus !== "PENDING") {
    throw new ServiceError("该决策已处理，无需重复操作。", 409);
  }

  const now = new Date();
  const decisionStatus = input.decision === "approved" ? "APPROVED" : "REJECTED";
  await prisma.notificationMessage.updateMany({
    where: message.commentId
      ? { commentId: message.commentId, activityType: "DECISION" }
      : { id: message.id },
    data: {
      decisionStatus,
      approvalId: input.approvalId,
      decidedByUserId: input.decidedByUser.id,
      decidedAt: now,
      readAt: now
    }
  });
}

/**
 * Marks one notification as read for the current recipient.
 */
export async function markNotificationRead(messageId: string, user: User): Promise<void> {
  if (!hasNotificationMessageDelegate()) {
    return;
  }

  const message = await prisma.notificationMessage.findUnique({ where: { id: messageId } });
  if (!message) {
    throw new ServiceError("通知不存在。", 404);
  }
  if (!userHasRole(user, "admin") && message.recipientUserId !== user.id && message.recipientPersonId !== user.personId) {
    throw new ServiceError("只能标记本人通知。", 403);
  }
  await prisma.notificationMessage.update({
    where: { id: messageId },
    data: { readAt: new Date() }
  });
}

async function ensureDefaultNotificationTemplates() {
  if (!hasNotificationTemplateDelegate()) {
    return;
  }

  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { activityType: toStoredActivityType(template.activityType) },
      create: {
        activityType: toStoredActivityType(template.activityType),
        name: template.name,
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        cardTemplateJson: "{}"
      },
      update: {}
    });
  }
}

async function resolveTemplate(activityType: NotificationActivityType) {
  await ensureDefaultNotificationTemplates();
  return prisma.notificationTemplate.findUnique({
    where: { activityType: toStoredActivityType(activityType) }
  });
}

async function resolveProjectRecipients(
  projectId: string,
  activityType: WorkPackageActivityNotificationInput["activityType"]
) {
  const memberships = await prisma.projectMembership.findMany({
    where: { projectId },
    include: { user: { include: { person: true } } }
  });
  if (activityType !== "decision") {
    return memberships;
  }
  return memberships.filter((membership) => canStoredRoleHandleDecision(membership.user.role));
}

async function ensureDemoNotificationMessages() {
  try {
    const existing = await prisma.notificationMessage.count({
      where: {
        id: { in: DEMO_NOTIFICATION_MESSAGES.map((message) => message.id) }
      }
    });
    if (existing >= DEMO_NOTIFICATION_MESSAGES.length) {
      return;
    }

    for (const message of DEMO_NOTIFICATION_MESSAGES) {
      await prisma.notificationMessage.upsert({
        where: { id: message.id },
        create: {
          id: message.id,
          projectId: message.projectId,
          workPackageId: message.workPackageId,
          senderPersonId: message.senderPersonId,
          recipientPersonId: message.recipientPersonId,
          recipientUserId: message.recipientUserId,
          activityType: toStoredActivityType(message.activityType),
          title: message.title,
          body: message.body,
          actionRequired: message.actionRequired,
          decisionStatus: message.decisionStatus === "pending" ? "PENDING" : "NONE",
          payloadJson: JSON.stringify(message.payload),
          createdAt: new Date(message.createdAt)
        },
        update: {
          title: message.title,
          body: message.body,
          actionRequired: message.actionRequired,
          decisionStatus: message.decisionStatus === "pending" ? "PENDING" : "NONE",
          payloadJson: JSON.stringify(message.payload)
        }
      });
    }
  } catch {
    // Demo rows are a convenience only; normal notification reads still continue.
  }
}

function fallbackNotificationMessages(user: User): NotificationMessage[] {
  const visibleProjectIds = new Set([
    ...user.managedProjectIds,
    ...user.participatingProjectIds
  ]);
  return DEMO_NOTIFICATION_MESSAGES
    .filter((message) =>
      userHasRole(user, "admin") ||
      message.recipientUserId === user.id ||
      message.recipientPersonId === user.personId ||
      visibleProjectIds.has(message.projectId)
    )
    .map((message) => ({
      ...message,
      canTakeDecision:
        message.activityType === "decision" &&
        message.decisionStatus === "pending" &&
        canUserHandleDecision(user.role)
    }));
}

function mapNotificationTemplate(row: {
  id: string;
  activityType: string;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  cardTemplateJson: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NotificationTemplate {
  return {
    id: row.id,
    activityType: mapActivityType(row.activityType),
    name: row.name,
    titleTemplate: row.titleTemplate,
    bodyTemplate: row.bodyTemplate,
    cardTemplate: parseJson(row.cardTemplateJson, {}),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapNotificationMessage(row: {
  id: string;
  projectId: string;
  workPackageId: number | null;
  commentId: string | null;
  approvalId: string | null;
  senderPersonId: string | null;
  recipientPersonId: string;
  recipientUserId: string | null;
  activityType: string;
  title: string;
  body: string;
  actionRequired: boolean;
  decisionStatus: string;
  readAt: Date | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  payloadJson: string;
  createdAt: Date;
  project?: { name: string; identifier: string } | null;
  workPackage?: { subject: string } | null;
  senderPerson?: { name: string } | null;
  decidedBy?: { name: string } | null;
}, viewer?: User): NotificationMessage {
  const decisionStatus = mapDecisionStatus(row.decisionStatus);
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project?.name ?? row.projectId,
    projectIdentifier: row.project?.identifier ?? row.projectId,
    workPackageId: row.workPackageId ?? undefined,
    workPackageSubject: row.workPackage?.subject ?? undefined,
    commentId: row.commentId ?? undefined,
    approvalId: row.approvalId ?? undefined,
    senderPersonId: row.senderPersonId ?? undefined,
    senderName: row.senderPerson?.name ?? undefined,
    recipientPersonId: row.recipientPersonId,
    recipientUserId: row.recipientUserId ?? undefined,
    activityType: mapActivityType(row.activityType),
    title: row.title,
    body: row.body,
    actionRequired: row.actionRequired,
    decisionStatus,
    canTakeDecision: Boolean(
      viewer &&
        row.activityType === "DECISION" &&
        decisionStatus === "pending" &&
        canUserHandleDecision(viewer.role)
    ),
    readAt: row.readAt?.toISOString(),
    decidedByUserId: row.decidedByUserId ?? undefined,
    decidedByName: row.decidedBy?.name ?? undefined,
    decidedAt: row.decidedAt?.toISOString(),
    payload: parseJson(row.payloadJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, value),
    template
  );
}

function buildFeishuAuditPayload(
  title: string,
  body: string,
  activityType: NotificationActivityType,
  recipientExternalId?: string
) {
  const notification = {
    id: `activity-${Date.now()}`,
    title,
    body,
    level: activityType === "blocker" ? "Medium" as const : "Low" as const,
    eventType: "progress" as const,
    highlights: [`活动类型：${ACTIVITY_LABELS[activityType]}`]
  };
  return {
    channelType: "feishu",
    recipientExternalId,
    roleLabels,
    payload: buildPayloadForChannel("feishu", notification)
  };
}

async function sendFeishuDecisionWebhook(title: string, body: string): Promise<void> {
  const webhookUrl = process.env.FEISHU_DECISION_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "interactive",
        card: {
          header: {
            title: { tag: "plain_text", content: title },
            template: "orange"
          },
          elements: [
            {
              tag: "div",
              text: { tag: "lark_md", content: body }
            }
          ]
        }
      })
    });
  } catch {
    // NotificationMessage is the durable audit source; webhook delivery is best-effort.
  }
}

function canUserHandleDecision(role: User["role"]): boolean {
  return role === "admin" || role === "projectManager" || role === "teamLead";
}

function canStoredRoleHandleDecision(role: string): boolean {
  return ["ADMIN", "PROJECT_MANAGER", "TEAM_LEAD", "admin", "projectManager", "teamLead"].includes(role);
}

function toStoredActivityType(type: NotificationActivityType): "COMMENT" | "DECISION" | "BLOCKER" | "EVIDENCE" | "APPROVAL" | "PROGRESS" {
  return type.toUpperCase() as "COMMENT" | "DECISION" | "BLOCKER" | "EVIDENCE" | "APPROVAL" | "PROGRESS";
}

function mapActivityType(type: string): NotificationActivityType {
  const lookup: Record<string, NotificationActivityType> = {
    COMMENT: "comment",
    DECISION: "decision",
    BLOCKER: "blocker",
    EVIDENCE: "evidence",
    APPROVAL: "approval",
    PROGRESS: "progress"
  };
  return lookup[type] ?? "comment";
}

function mapDecisionStatus(status: string): NotificationDecisionStatus {
  const lookup: Record<string, NotificationDecisionStatus> = {
    NONE: "none",
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected"
  };
  return lookup[status] ?? "none";
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function hasNotificationTemplateDelegate(): boolean {
  const delegate = (prisma as unknown as { notificationTemplate?: Record<string, unknown> }).notificationTemplate;
  return typeof delegate?.upsert === "function" && typeof delegate.findMany === "function";
}

function hasNotificationMessageDelegate(): boolean {
  const delegate = (prisma as unknown as { notificationMessage?: Record<string, unknown> }).notificationMessage;
  return typeof delegate?.findMany === "function" && typeof delegate.create === "function";
}
