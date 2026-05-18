import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationEventType,
  NotificationRule,
  PermissionEffect,
  PermissionOverride,
  PermissionScopeType,
  PermissionSubjectType,
  Person,
  PlatformRole,
  Priority,
  Project,
  ProjectModule,
  ProjectStatus,
  Difficulty,
  RiskLevel,
  StewardMessage,
  Team,
  User,
  WorkPackage,
  WorkPackageApproval,
  WorkPackageApprovalStatus,
  WorkPackageComment,
  WorkPackageCommentSource,
  WorkPackageCommentType,
  WorkPackageOrigin,
  WorkPackageRequirement,
  WorkPackageStatus,
  VerificationStatus,
  WorkPackageAssignment,
  WorkPackageAttachment,
  WorkPackageType
} from "@/lib/types";
import { isPersonalProjectId } from "@/lib/project-constants";

export interface StoredMembership {
  projectId: string;
  isLead: boolean;
}

export interface StoredUser {
  id: string;
  name: string;
  role: string;
  /** JSON 字符串，兼容历史角色数组存储；当前业务只使用单角色。 */
  roles: string;
  personId: string;
  memberships: StoredMembership[];
  /** teamLead 关联的团队信息（可选） */
  team?: StoredTeam | null;
  person?: { externalId?: string | null } | null;
}

export interface StoredPerson {
  id: string;
  name: string;
  role: string;
  capacity: number;
  skills: string;
  employeeNo?: string | null;
  jobTitle?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  externalId?: string | null;
}

export interface StoredProject {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  createdByUserId?: string | null;
  parentId: string | null;
  status: string;
  health: string;
  initialDifficulty?: string;
  difficultyOverride?: string | null;
  progress: number;
  startDate: Date | null;
  endDate: Date | null;
  enabledModules: string;
}

export interface StoredWorkPackage {
  id: number;
  projectId: string | null;
  type: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  difficulty?: string;
  origin: string;
  createdByUserId: string;
  assigneeId: string | null;
  parentId: number | null;
  startDate: Date | null;
  dueDate: Date | null;
  estimateHours: number | null;
  percentComplete: number;
  lastProgressNote: string;
  blockedReason?: string | null;
  blockedStartedAt?: Date | null;
  blockedResolvedAt?: Date | null;
  delayReason?: string | null;
  delayDays?: number;
  delayStartedAt?: Date | null;
  delayResolvedAt?: Date | null;
  progressUpdatedByUserId?: string | null;
  completedAt?: Date | null;
  dependencies: string;
  requiredSkills: string;
  isOnCriticalPath: boolean;
  riskLevel: string | null;
  riskImpact: string | null;
  riskMitigation: string | null;
  updatedAt: Date;
  requirements?: StoredWorkPackageRequirement[];
  assignments?: StoredWorkPackageAssignment[];
  attachments?: StoredWorkPackageAttachment[];
  /** 核对状态 */
  verificationStatus?: string | null;
  /** 是否需要核对 */
  requiresVerification?: boolean;
  /** 核对人 User ID */
  verifiedByUserId?: string | null;
  /** 核对时间 */
  verifiedAt?: Date | null;
  /** 驳回原因 */
  rejectedReason?: string | null;
}

export interface StoredWorkPackageRequirement {
  id: string;
  workPackageId: number;
  content: string;
  sortOrder: number;
  createdAt: Date;
}

export interface StoredWorkPackageAssignment {
  id: string;
  workPackageId: number;
  personId: string;
  role: string;
  responsibility: string;
  sortOrder: number;
  createdAt: Date;
}

export interface StoredWorkPackageAttachment {
  id: string;
  workPackageId: number;
  fileName: string;
  contentType: string;
  size: number;
  dataUrl: string;
  createdAt: Date;
}

export interface StoredTeam {
  id: string;
  name: string;
  description: string | null;
  leadId: string | null;
  memberships?: Array<{ personId: string }>;
  manualOverride?: boolean;
  externalId?: string | null;
  syncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredPermissionOverride {
  id: string;
  subjectType: string;
  subjectId: string;
  permissionKey: string;
  effect: string;
  scopeType: string;
  scopeId: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredStewardMessage {
  id: string;
  type: string;
  title: string;
  body: string;
  level: string;
  createdAt: Date;
}

export interface StoredWorkPackageComment {
  id: string;
  workPackageId: number;
  authorPersonId: string;
  body: string;
  type: string;
  mentionsPersonIds: string;
  source: string;
  sourceChannelId: string | null;
  externalMessageId: string | null;
  externalThreadId: string | null;
  authorDisplayName: string | null;
  createdAt: Date;
}

export interface StoredWorkPackageApproval {
  id: string;
  workPackageId: number;
  reviewerPersonId: string;
  status: string;
  comment: string;
  createdAt: Date;
}

export interface StoredNotificationChannel {
  id: string;
  name: string;
  type: string;
  target: string;
  enabled: boolean;
  audienceRoles: string;
  audiencePersonIds: string;
  secret: string | null;
  note: string | null;
}

export interface StoredNotificationRule {
  id: string;
  name: string;
  eventTypes: string;
  minLevel: string;
  audienceRoles: string;
  channels: Array<{ channelId: string }>;
}

export type StoredWorkPackageTypeName = "TASK" | "MILESTONE" | "RISK" | "PHASE";
export type StoredWorkPackageOriginName = "SELF" | "AI_SELF" | "MANAGER" | "IM_IMPORT";
export type StoredRiskLevelName = "LOW" | "MEDIUM" | "HIGH";
export type StoredDifficultyName = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type StoredProjectStatusName = "ACTIVE" | "ON_HOLD" | "ARCHIVED";
export type StoredWorkPackageCommentTypeName =
  | "COMMENT"
  | "DECISION"
  | "BLOCKER"
  | "EVIDENCE";
export type StoredWorkPackageApprovalStatusName =
  | "PENDING"
  | "APPROVED"
  | "CHANGES_REQUESTED";
export type StoredWorkPackageCommentSourceName =
  | "PLATFORM"
  | "FEISHU"
  | "WECOM_BOT"
  | "DINGTALK"
  | "SLACK"
  | "EMAIL"
  | "GENERIC";

const KNOWN_MODULES: ProjectModule[] = [
  "overview",
  "work_packages",
  "boards",
  "gantt",
  "members",
  "ai_diagnosis",
  "ai_breakdown",
  "settings"
];

/**
 * Maps a database user row into the workspace DTO used by UI and policy logic.
 */
export function mapUser(user: StoredUser): User {
  const mappedRole = mapPlatformRole(user.role);
  return {
    id: user.id,
    name: user.name,
    role: mappedRole,
    roles: parsePlatformRoleArray(user.roles).length > 0
      ? parsePlatformRoleArray(user.roles)
      : [mappedRole],
    personId: user.personId,
    managedProjectIds: user.memberships
      .filter((membership) => membership.isLead)
      .map((membership) => membership.projectId),
    participatingProjectIds: user.memberships.map((membership) => membership.projectId),
    teamId: user.team?.id,
    externalId: user.person?.externalId ?? undefined
  };
}

export function mapWorkPackageRequirement(req: StoredWorkPackageRequirement): WorkPackageRequirement {
  return {
    id: req.id,
    workPackageId: req.workPackageId,
    content: req.content,
    sortOrder: req.sortOrder,
    createdAt: req.createdAt?.toISOString()
  };
}

export function mapWorkPackageAssignment(item: StoredWorkPackageAssignment): WorkPackageAssignment {
  return {
    id: item.id,
    workPackageId: item.workPackageId,
    personId: item.personId,
    role: item.role,
    responsibility: item.responsibility,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt?.toISOString()
  };
}

/**
 * Maps persisted attachment payloads into preview-ready work-package DTOs.
 */
export function mapWorkPackageAttachment(item: StoredWorkPackageAttachment): WorkPackageAttachment {
  return {
    id: item.id,
    workPackageId: item.workPackageId,
    fileName: item.fileName,
    contentType: item.contentType,
    size: item.size,
    dataUrl: item.dataUrl,
    createdAt: item.createdAt?.toISOString()
  };
}

export function mapTeam(team: StoredTeam): Team {
  return {
    id: team.id,
    name: team.name,
    description: team.description ?? undefined,
    leadId: team.leadId ?? undefined,
    memberIds: team.memberships?.map((membership) => membership.personId),
    manualOverride: team.manualOverride ?? undefined,
    externalId: team.externalId ?? undefined,
    syncedAt: team.syncedAt?.toISOString(),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString()
  };
}

export function mapPermissionOverride(item: StoredPermissionOverride): PermissionOverride {
  return {
    id: item.id,
    subjectType: mapPermissionSubjectType(item.subjectType),
    subjectId: item.subjectId,
    permissionKey: item.permissionKey,
    effect: mapPermissionEffect(item.effect),
    scopeType: mapPermissionScopeType(item.scopeType),
    scopeId: item.scopeId === "__global__" ? undefined : item.scopeId,
    createdByUserId: item.createdByUserId ?? undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

export function toStoredPermissionSubjectType(value: PermissionSubjectType): string {
  return value.toUpperCase();
}

export function toStoredPermissionEffect(value: PermissionEffect): string {
  return value.toUpperCase();
}

export function toStoredPermissionScopeType(value: PermissionScopeType): string {
  return value.toUpperCase();
}

export function mapPerson(person: StoredPerson): Person {
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    capacity: person.capacity,
    employeeNo: person.employeeNo ?? undefined,
    jobTitle: person.jobTitle ?? undefined,
    departmentCode: person.departmentCode ?? undefined,
    departmentName: person.departmentName ?? undefined,
    externalId: person.externalId ?? undefined,
    skills: parseStringArray(person.skills)
  };
}

export function mapProject(project: StoredProject): Project {
  return {
    id: project.id,
    identifier: project.identifier,
    name: project.name,
    description: project.description ?? undefined,
    createdByUserId: project.createdByUserId ?? undefined,
    parentId: project.parentId ?? undefined,
    status: mapProjectStatus(project.status),
    health: mapRiskLevel(project.health),
    initialDifficulty: mapDifficulty(project.initialDifficulty ?? "MEDIUM"),
    difficultyOverride: project.difficultyOverride ? mapDifficulty(project.difficultyOverride) : undefined,
    progress: project.progress,
    startDate: project.startDate?.toISOString(),
    endDate: project.endDate?.toISOString(),
    enabledModules: parseEnabledModules(project.enabledModules)
  };
}

export function mapWorkPackage(workPackage: StoredWorkPackage): WorkPackage {
  return {
    id: workPackage.id,
    projectId: isPersonalProjectId(workPackage.projectId) ? undefined : workPackage.projectId ?? undefined,
    type: mapWorkPackageType(workPackage.type),
    subject: workPackage.subject,
    description: workPackage.description,
    status: mapWorkPackageStatus(workPackage.status),
    priority: workPackage.priority as Priority,
    difficulty: mapDifficulty(workPackage.difficulty ?? "MEDIUM"),
    origin: mapWorkPackageOrigin(workPackage.origin),
    createdByUserId: workPackage.createdByUserId,
    assigneeId: workPackage.assigneeId ?? undefined,
    parentId: workPackage.parentId ?? undefined,
    startDate: workPackage.startDate?.toISOString(),
    dueDate: workPackage.dueDate?.toISOString(),
    estimateHours: workPackage.estimateHours ?? undefined,
    percentComplete: workPackage.percentComplete,
    lastProgressNote: workPackage.lastProgressNote,
    blockedReason: workPackage.blockedReason ?? undefined,
    blockedStartedAt: workPackage.blockedStartedAt?.toISOString(),
    blockedResolvedAt: workPackage.blockedResolvedAt?.toISOString(),
    delayReason: workPackage.delayReason ?? undefined,
    delayDays: workPackage.delayDays ?? 0,
    delayStartedAt: workPackage.delayStartedAt?.toISOString(),
    delayResolvedAt: workPackage.delayResolvedAt?.toISOString(),
    progressUpdatedByUserId: workPackage.progressUpdatedByUserId ?? undefined,
    completedAt: workPackage.completedAt?.toISOString(),
    dependencies: parseNumberArray(workPackage.dependencies),
    requiredSkills: parseStringArray(workPackage.requiredSkills),
    isOnCriticalPath: workPackage.isOnCriticalPath,
    riskLevel: workPackage.riskLevel ? mapRiskLevel(workPackage.riskLevel) : undefined,
    riskImpact: workPackage.riskImpact ?? undefined,
    riskMitigation: workPackage.riskMitigation ?? undefined,
    lastUpdatedAt: workPackage.updatedAt.toISOString(),
    requirements: workPackage.requirements?.map(mapWorkPackageRequirement),
    assignments: workPackage.assignments?.map(mapWorkPackageAssignment),
    attachments: workPackage.attachments?.map(mapWorkPackageAttachment),
    verificationStatus: workPackage.verificationStatus
      ? mapVerificationStatus(workPackage.verificationStatus)
      : undefined,
    requiresVerification: workPackage.requiresVerification ?? undefined,
    verifiedByUserId: workPackage.verifiedByUserId ?? undefined,
    verifiedAt: workPackage.verifiedAt?.toISOString(),
    rejectedReason: workPackage.rejectedReason ?? undefined
  };
}

export function mapStewardMessage(message: StoredStewardMessage): StewardMessage {
  return {
    id: message.id,
    type: message.type as StewardMessage["type"],
    title: message.title,
    body: message.body,
    level: mapRiskLevel(message.level),
    createdAt: message.createdAt.toISOString()
  };
}

export function mapWorkPackageComment(comment: StoredWorkPackageComment): WorkPackageComment {
  return {
    id: comment.id,
    workPackageId: comment.workPackageId,
    authorPersonId: comment.authorPersonId,
    body: comment.body,
    type: mapWorkPackageCommentType(comment.type),
    createdAt: comment.createdAt.toISOString(),
    mentionsPersonIds: parseStringArray(comment.mentionsPersonIds),
    source: mapWorkPackageCommentSource(comment.source),
    sourceChannelId: comment.sourceChannelId ?? undefined,
    externalMessageId: comment.externalMessageId ?? undefined,
    externalThreadId: comment.externalThreadId ?? undefined,
    authorDisplayName: comment.authorDisplayName ?? undefined
  };
}

export function mapWorkPackageApproval(approval: StoredWorkPackageApproval): WorkPackageApproval {
  return {
    id: approval.id,
    workPackageId: approval.workPackageId,
    reviewerPersonId: approval.reviewerPersonId,
    status: mapWorkPackageApprovalStatus(approval.status),
    comment: approval.comment,
    createdAt: approval.createdAt.toISOString()
  };
}

export function mapNotificationChannel(channel: StoredNotificationChannel): NotificationChannel {
  return {
    id: channel.id,
    name: channel.name,
    type: mapNotificationChannelType(channel.type),
    target: channel.target,
    enabled: channel.enabled,
    audienceRoles: parsePlatformRoleArray(channel.audienceRoles),
    audiencePersonIds: parseStringArray(channel.audiencePersonIds),
    secret: channel.secret ?? undefined,
    note: channel.note ?? undefined
  };
}

export function mapNotificationRule(rule: StoredNotificationRule): NotificationRule {
  return {
    id: rule.id,
    name: rule.name,
    eventTypes: parseStringArray(rule.eventTypes) as NotificationEventType[],
    minLevel: mapRiskLevel(rule.minLevel),
    channelIds: rule.channels.map((channel) => channel.channelId),
    audienceRoles: parsePlatformRoleArray(rule.audienceRoles)
  };
}

export function toStoredWorkPackageType(type: WorkPackageType): StoredWorkPackageTypeName {
  return type.toUpperCase() as StoredWorkPackageTypeName;
}

export function toStoredWorkPackageOrigin(origin: WorkPackageOrigin): StoredWorkPackageOriginName {
  if (origin === "aiSelf") {
    return "AI_SELF";
  }

  if (origin === "imImport") {
    return "IM_IMPORT";
  }

  return origin.toUpperCase() as StoredWorkPackageOriginName;
}

export function toStoredRiskLevel(level: RiskLevel): StoredRiskLevelName {
  return level.toUpperCase() as StoredRiskLevelName;
}

export function toStoredDifficulty(value: Difficulty): StoredDifficultyName {
  return value.toUpperCase() as StoredDifficultyName;
}

export function toStoredProjectStatus(status: ProjectStatus): StoredProjectStatusName {
  if (status === "onHold") {
    return "ON_HOLD";
  }

  return status.toUpperCase() as StoredProjectStatusName;
}

export function toStoredWorkPackageCommentType(
  type: WorkPackageCommentType
): StoredWorkPackageCommentTypeName {
  return type.toUpperCase() as StoredWorkPackageCommentTypeName;
}

export function toStoredWorkPackageApprovalStatus(
  status: WorkPackageApprovalStatus
): StoredWorkPackageApprovalStatusName {
  if (status === "changesRequested") {
    return "CHANGES_REQUESTED";
  }

  return status.toUpperCase() as StoredWorkPackageApprovalStatusName;
}

export function toStoredWorkPackageCommentSource(
  source: WorkPackageCommentSource
): StoredWorkPackageCommentSourceName {
  if (source === "wecomBot") {
    return "WECOM_BOT";
  }

  return source.toUpperCase() as StoredWorkPackageCommentSourceName;
}

export function serializeEnabledModules(modules: ProjectModule[]): string {
  return JSON.stringify(modules);
}

function mapPlatformRole(role: string): PlatformRole {
  const lookup: Record<string, PlatformRole> = {
    ADMIN: "admin",
    PROJECT_MANAGER: "projectManager",
    TEAM_LEAD: "teamLead",
    PARTICIPANT: "participant"
  };

  return lookup[role] ?? "participant";
}

export function toStoredVerificationStatus(status: VerificationStatus): string {
  const lookup: Record<VerificationStatus, string> = {
    notRequired: "NOT_REQUIRED",
    pending: "PENDING",
    selfReportedDone: "SELF_REPORTED_DONE",
    verified: "VERIFIED",
    rejected: "REJECTED"
  };

  return lookup[status] ?? "NOT_REQUIRED";
}

function mapVerificationStatus(status: string): VerificationStatus {
  const lookup: Record<string, VerificationStatus> = {
    NOT_REQUIRED: "notRequired",
    PENDING: "pending",
    SELF_REPORTED_DONE: "selfReportedDone",
    VERIFIED: "verified",
    REJECTED: "rejected"
  };

  return lookup[status] ?? "notRequired";
}

function mapRiskLevel(level: string): RiskLevel {
  const lookup: Record<string, RiskLevel> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High"
  };

  return lookup[level] ?? "Low";
}

function mapDifficulty(value: string): Difficulty {
  const lookup: Record<string, Difficulty> = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical"
  };

  return lookup[value] ?? "medium";
}

function mapProjectStatus(status: string): ProjectStatus {
  const lookup: Record<string, ProjectStatus> = {
    ACTIVE: "active",
    ON_HOLD: "onHold",
    ARCHIVED: "archived"
  };

  return lookup[status] ?? "active";
}

function mapWorkPackageType(type: string): WorkPackageType {
  const lookup: Record<string, WorkPackageType> = {
    TASK: "task",
    MILESTONE: "milestone",
    RISK: "risk",
    PHASE: "phase"
  };

  return lookup[type] ?? "task";
}

function mapWorkPackageStatus(status: string): WorkPackageStatus {
  const lookup: Record<string, WorkPackageStatus> = {
    todo: "todo",
    inProgress: "inProgress",
    review: "review",
    reviewFailed: "reviewFailed",
    done: "done",
    blocked: "blocked",
    planned: "todo",
    open: "todo",
    active: "inProgress",
    mitigating: "inProgress",
    atRisk: "blocked",
    achieved: "done",
    closed: "done",
    completed: "done"
  };

  return lookup[status] ?? "todo";
}

function mapWorkPackageOrigin(origin: string): WorkPackageOrigin {
  const lookup: Record<string, WorkPackageOrigin> = {
    SELF: "self",
    AI_SELF: "aiSelf",
    MANAGER: "manager",
    IM_IMPORT: "imImport"
  };

  return lookup[origin] ?? "manager";
}

function mapWorkPackageCommentType(type: string): WorkPackageCommentType {
  const lookup: Record<string, WorkPackageCommentType> = {
    COMMENT: "comment",
    DECISION: "decision",
    BLOCKER: "blocker",
    EVIDENCE: "evidence"
  };

  return lookup[type] ?? "comment";
}

function mapWorkPackageCommentSource(source: string): WorkPackageCommentSource {
  const lookup: Record<string, WorkPackageCommentSource> = {
    PLATFORM: "platform",
    FEISHU: "feishu",
    WECOM_BOT: "wecomBot",
    DINGTALK: "dingtalk",
    SLACK: "slack",
    EMAIL: "email",
    GENERIC: "generic"
  };

  return lookup[source] ?? "generic";
}

function mapWorkPackageApprovalStatus(status: string): WorkPackageApprovalStatus {
  const lookup: Record<string, WorkPackageApprovalStatus> = {
    PENDING: "pending",
    APPROVED: "approved",
    CHANGES_REQUESTED: "changesRequested"
  };

  return lookup[status] ?? "pending";
}

function mapNotificationChannelType(type: string): NotificationChannelType {
  const lookup: Record<string, NotificationChannelType> = {
    FEISHU: "feishu",
    WECOM_BOT: "wecomBot",
    DINGTALK: "dingtalk",
    SLACK: "slack",
    EMAIL: "email",
    GENERIC: "generic"
  };

  return lookup[type] ?? "generic";
}

function mapPermissionSubjectType(value: string): PermissionSubjectType {
  const lookup: Record<string, PermissionSubjectType> = {
    USER: "user",
    TEAM: "team",
    user: "user",
    team: "team"
  };
  return lookup[value] ?? "user";
}

function mapPermissionEffect(value: string): PermissionEffect {
  const lookup: Record<string, PermissionEffect> = {
    ALLOW: "allow",
    DENY: "deny",
    allow: "allow",
    deny: "deny"
  };
  return lookup[value] ?? "deny";
}

function mapPermissionScopeType(value: string): PermissionScopeType {
  const lookup: Record<string, PermissionScopeType> = {
    GLOBAL: "global",
    PROJECT: "project",
    TEAM: "team",
    global: "global",
    project: "project",
    team: "team"
  };
  return lookup[value] ?? "global";
}

function parseEnabledModules(value: string): ProjectModule[] {
  return parseStringArray(value).filter((item): item is ProjectModule =>
    KNOWN_MODULES.includes(item as ProjectModule)
  );
}

function parsePlatformRoleArray(value: string): PlatformRole[] {
  return parseStringArray(value)
    .map((role) => mapPlatformRole(role));
}

function parseStringArray(value: string): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function parseNumberArray(value: string): number[] {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}