/**
 * Shared TypeScript domain types for the OpenProject-style project management
 * platform. The model unifies tasks/risks/milestones into WorkPackage and
 * introduces project hierarchy (parent/sub-project) plus per-project module
 * toggles (mirrors OpenProject's enabled-modules concept).
 */

export type WorkPackageType = "task" | "milestone" | "risk" | "phase";
export type Priority = "P0" | "P1" | "P2";
export type RiskLevel = "Low" | "Medium" | "High";
export type Difficulty = "low" | "medium" | "high" | "critical";
export type ProjectStatus = "active" | "onHold" | "archived";
export type PlatformRole = "admin" | "projectManager" | "teamLead" | "participant";
export type WorkPackageOrigin = "self" | "aiSelf" | "manager" | "imImport";
export type PermissionSubjectType = "user" | "team";
export type PermissionEffect = "allow" | "deny";
export type PermissionScopeType = "global" | "project" | "team";

/**
 * Status string used by every WorkPackage. The workflow is intentionally
 * unified across task, milestone, risk, and phase work packages.
 */
export type WorkPackageStatus =
  | "todo"
  | "inProgress"
  | "review"
  | "reviewFailed"
  | "done"
  | "blocked";

export type ProjectModule =
  | "overview"
  | "work_packages"
  | "boards"
  | "gantt"
  | "members"
  | "ai_diagnosis"
  | "ai_breakdown"
  | "settings";

export type WorkPackageCommentType = "comment" | "decision" | "blocker" | "evidence";

export type WorkPackageCommentSource =
  | "platform"
  | "feishu"
  | "wecomBot"
  | "dingtalk"
  | "slack"
  | "email"
  | "generic";

export type WorkPackageApprovalStatus = "pending" | "approved" | "changesRequested";

export type VerificationStatus =
  | "notRequired"
  | "pending"
  | "selfReportedDone"
  | "verified"
  | "rejected";

export interface User {
  id: string;
  name: string;
  role: PlatformRole;
  /** 兼容历史 JSON 数组存储，当前业务只使用单角色。 */
  roles?: PlatformRole[];
  personId: string;
  managedProjectIds: string[];
  participatingProjectIds: string[];
  /** teamLead 关联的团队ID */
  teamId?: string;
  /** 外部系统用户ID（飞书等） */
  externalId?: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  capacity: number;
  employeeNo?: string;
  jobTitle?: string;
  departmentCode?: string;
  departmentName?: string;
  externalId?: string;
  /** Optional skill tags used by scheduling intelligence. */
  skills?: string[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  leadId?: string;
  memberIds?: string[];
  manualOverride?: boolean;
  externalId?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionOverride {
  id: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  permissionKey: string;
  effect: PermissionEffect;
  scopeType: PermissionScopeType;
  scopeId?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  /** URL-friendly slug used in routing, unique across the instance. */
  identifier: string;
  name: string;
  description?: string;
  /** User who created the project; deletion is restricted to this user. */
  createdByUserId?: string;
  /** Parent project id when this project is a sub-project. */
  parentId?: string;
  status: ProjectStatus;
  health: RiskLevel;
  initialDifficulty: Difficulty;
  difficultyOverride?: Difficulty;
  progress: number;
  startDate?: string;
  endDate?: string;
  /** Modules enabled in this project. Filters the project sidebar. */
  enabledModules: ProjectModule[];
}

export interface WorkPackageRequirement {
  id: string;
  workPackageId: number;
  content: string;
  sortOrder: number;
  createdAt?: string;
}

export interface WorkPackageAssignment {
  id: string;
  workPackageId: number;
  personId: string;
  role: string;
  responsibility: string;
  sortOrder: number;
  createdAt?: string;
}

/**
 * Small attachment payload persisted with a work package for preview evidence.
 */
export interface WorkPackageAttachment {
  id: string;
  workPackageId: number;
  fileName: string;
  contentType: string;
  size: number;
  dataUrl: string;
  createdAt?: string;
}

export interface WorkPackage {
  /** Auto-incremented integer id, mirrors OpenProject's global WP id. */
  id: number;
  projectId?: string;
  type: WorkPackageType;
  /** OpenProject term for the work package title. */
  subject: string;
  description: string;
  status: WorkPackageStatus;
  priority: Priority;
  difficulty?: Difficulty;
  origin: WorkPackageOrigin;
  createdByUserId: string;
  assigneeId?: string;
  /** Parent work package id when this WP is a sub-task or sub-milestone. */
  parentId?: number;
  startDate?: string;
  dueDate?: string;
  estimateHours?: number;
  percentComplete: number;
  lastProgressNote: string;
  blockedReason?: string;
  blockedStartedAt?: string;
  blockedResolvedAt?: string;
  delayReason?: string;
  delayDays?: number;
  delayStartedAt?: string;
  delayResolvedAt?: string;
  progressUpdatedByUserId?: string;
  completedAt?: string;
  dependencies: number[];
  requiredSkills?: string[];
  isOnCriticalPath?: boolean;
  /** Risk metadata, only populated when type === "risk". */
  riskLevel?: RiskLevel;
  riskImpact?: string;
  riskMitigation?: string;
  lastUpdatedAt?: string;
  /** 核对状态 */
  verificationStatus?: VerificationStatus;
  /** 是否需要核对 */
  requiresVerification?: boolean;
  /** 核对人 User ID */
  verifiedByUserId?: string;
  /** 核对时间 */
  verifiedAt?: string;
  /** 驳回原因 */
  rejectedReason?: string;
  /** 需求项列表（子任务/里程碑创建时必填） */
  requirements?: WorkPackageRequirement[];
  /** 成员分工明细，支持一个工作项分配多个执行成员。 */
  assignments?: WorkPackageAssignment[];
  /** 附件预览数据，当前以 data URL 持久化用于本地演示环境。 */
  attachments?: WorkPackageAttachment[];
}

export interface WorkPackageComment {
  id: string;
  workPackageId: number;
  authorPersonId: string;
  body: string;
  type: WorkPackageCommentType;
  createdAt: string;
  mentionsPersonIds: string[];
  source?: WorkPackageCommentSource;
  sourceChannelId?: string;
  externalMessageId?: string;
  externalThreadId?: string;
  authorDisplayName?: string;
}

export interface WorkPackageApproval {
  id: string;
  workPackageId: number;
  reviewerPersonId: string;
  status: WorkPackageApprovalStatus;
  comment: string;
  createdAt: string;
}

export interface StewardMessage {
  id: string;
  type: "progress" | "risk" | "deployment" | "planning";
  title: string;
  body: string;
  level: RiskLevel;
  createdAt: string;
}

export interface WorkspaceSnapshot {
  users: User[];
  people: Person[];
  projects: Project[];
  workPackages: WorkPackage[];
  workPackageComments: WorkPackageComment[];
  workPackageApprovals: WorkPackageApproval[];
  stewardMessages: StewardMessage[];
  notificationChannels: NotificationChannel[];
  notificationRules: NotificationRule[];
  permissionOverrides?: PermissionOverride[];
}

export type NotificationLevel = RiskLevel;
export type NotificationEventType = StewardMessage["type"];
export type NotificationChannelType =
  | "feishu"
  | "wecomBot"
  | "dingtalk"
  | "slack"
  | "email"
  | "generic";
export type NotificationDeliveryStatus = "preview" | "sent" | "skipped" | "failed";
export type NotificationActivityType =
  | WorkPackageCommentType
  | "approval"
  | "progress";
export type NotificationDecisionStatus = "none" | "pending" | "approved" | "rejected";

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  target: string;
  enabled: boolean;
  audienceRoles: PlatformRole[];
  audiencePersonIds: string[];
  secret?: string;
  note?: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  eventTypes: NotificationEventType[];
  minLevel: NotificationLevel;
  channelIds: string[];
  audienceRoles: PlatformRole[];
}

export interface UnifiedNotification {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  eventType: NotificationEventType;
  highlights: string[];
  link?: string;
}

export interface NotificationDelivery {
  id: string;
  channelId: string;
  channelName: string;
  channelType: NotificationChannelType;
  ruleId: string;
  ruleName: string;
  status: NotificationDeliveryStatus;
  preview: string;
  payload: Record<string, unknown>;
  audienceRoles: PlatformRole[];
  notification: UnifiedNotification;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  activityType: NotificationActivityType;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  cardTemplate: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationMessage {
  id: string;
  projectId: string;
  projectName: string;
  projectIdentifier: string;
  workPackageId?: number;
  workPackageSubject?: string;
  commentId?: string;
  approvalId?: string;
  senderPersonId?: string;
  senderName?: string;
  recipientPersonId: string;
  recipientUserId?: string;
  activityType: NotificationActivityType;
  title: string;
  body: string;
  actionRequired: boolean;
  decisionStatus: NotificationDecisionStatus;
  canTakeDecision: boolean;
  readAt?: string;
  decidedByUserId?: string;
  decidedByName?: string;
  decidedAt?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectHealthScore {
  projectId: string;
  projectName: string;
  score: number;
  level: RiskLevel;
  contributors: Array<{ label: string; impact: number }>;
  highlight: string;
}

export interface SchedulingSuggestion {
  workPackageId: number;
  workPackageSubject: string;
  currentAssigneeId?: string;
  suggestedPersonId: string;
  reason: string;
  urgency: number;
  score: number;
}

export interface ReminderItem {
  workPackageId: number;
  workPackageSubject: string;
  ownerId?: string;
  ownerName: string;
  level: RiskLevel;
  urgency: number;
  message: string;
  preferredChannelIds: string[];
  daysIdle: number;
  daysUntilDue?: number;
}

export type ProjectDiagnosisRoute = "reminder" | "scheduling" | "overview";

export interface ProjectDiagnosisAction {
  id: string;
  title: string;
  detail: string;
  level: RiskLevel;
  route: ProjectDiagnosisRoute;
  /** Optional WorkPackage id when the action targets a specific WP. */
  workPackageId?: number;
}

export interface ProjectDiagnosis {
  overallLevel: RiskLevel;
  overallScore: number;
  summary: string;
  actions: ProjectDiagnosisAction[];
  contributors: string[];
}

export interface DashboardStats {
  projectCount: number;
  workPackageCount: number;
  doneCount: number;
  blockedCount: number;
  highRiskCount: number;
  averageProgress: number;
  workloadByPerson: Array<{
    person: Person;
    assignedHours: number;
    loadRatio: number;
  }>;
  bottlenecks: WorkPackage[];
}

export interface RolePermission {
  key: string;
  label: string;
  admin: boolean;
  projectManager: boolean;
  teamLead: boolean;
  participant: boolean;
}

export interface AgentTaskDraft {
  title: string;
  description: string;
  priority: Priority;
  assigneeRole: string;
  milestone: string;
  type: WorkPackageType;
}

export interface AgentRiskDraft {
  title: string;
  level: RiskLevel;
  impact: string;
  mitigation: string;
}

export interface AgentAnalysis {
  productDefinition: string;
  tasks: AgentTaskDraft[];
  risks: AgentRiskDraft[];
  progressReport: string;
  nextActions: string[];
}
