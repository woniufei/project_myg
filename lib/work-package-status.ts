import type { BadgeTone } from "@/components/primer/Badge";
import type { Project, WorkPackage } from "@/lib/types";

export interface WorkPackageStatusTag {
  key: string;
  label: string;
  tone: BadgeTone;
  title?: string;
}

export type WorkPackageAttentionKind =
  | "reviewOverdue"
  | "executionOverdueRisk"
  | "selfBlocked"
  | "dependencyBlocked"
  | "dependencyOverdue"
  | "manualBlocked"
  | "wasDelayed"
  | "wasBlocked";

export interface WorkPackageStatusInsight extends WorkPackageStatusTag {
  kind: WorkPackageAttentionKind;
  description: string;
  sourceWorkPackageId?: number;
  sourceProjectId?: string;
}

/**
 * 判断工作项是否已经超过截止日期且尚未完成。
 */
export function isWorkPackageOverdue(workPackage: Pick<WorkPackage, "dueDate" | "percentComplete">, now = new Date()) {
  if (!workPackage.dueDate || workPackage.percentComplete >= 100) {
    return false;
  }

  const dueAt = new Date(workPackage.dueDate);
  if (Number.isNaN(dueAt.getTime())) {
    return false;
  }

  return dueAt.getTime() <= now.getTime();
}

/**
 * 在读取列表时应用不依赖人工操作的状态规则，保持 UI 与自动化流程一致。
 */
export function applyAutomatedWorkPackageState(workPackage: WorkPackage, now = new Date()): WorkPackage {
  if (
    workPackage.status !== "inProgress" ||
    !isWorkPackageOverdue(workPackage, now) ||
    Boolean(workPackage.delayResolvedAt) ||
    isFinalStatus(workPackage.status)
  ) {
    return workPackage;
  }

  return {
    ...workPackage,
    status: "blocked",
    blockedReason: workPackage.blockedReason ?? "已超过截止日期且进度未完成，系统自动标记为阻塞。",
    blockedStartedAt: workPackage.blockedStartedAt ?? now.toISOString()
  };
}

/**
 * 生成工作项状态列额外标签，兼容既有调用方。
 */
export function getDerivedWorkPackageStatusTags(
  workPackage: WorkPackage,
  allWorkPackages: WorkPackage[],
  projects: Project[],
  now = new Date()
): WorkPackageStatusTag[] {
  return getWorkPackageStatusInsights(workPackage, allWorkPackages, projects, now);
}

/**
 * 输出当前关注标签和历史风险标签，供列表与详情页统一展示。
 */
export function getWorkPackageStatusInsights(
  workPackage: WorkPackage,
  allWorkPackages: WorkPackage[],
  projects: Project[],
  now = new Date()
): WorkPackageStatusInsight[] {
  return [
    ...getCurrentAttentionTags(workPackage, allWorkPackages, projects, now),
    ...getHistoryTags(workPackage)
  ];
}

/**
 * 生成未完成工作项的当前关注标签，避免把评审超时、执行超期风险直接叫阻塞。
 */
export function getCurrentAttentionTags(
  workPackage: WorkPackage,
  allWorkPackages: WorkPackage[],
  projects: Project[],
  now = new Date()
): WorkPackageStatusInsight[] {
  if (workPackage.status === "done") {
    return [];
  }

  const dependencyImpact = getDependencyImpact(workPackage, allWorkPackages, projects, now);
  if (workPackage.status === "blocked") {
    if (dependencyImpact?.kind === "dependencyBlocked" || dependencyImpact?.kind === "dependencyOverdue") {
      return [dependencyImpact];
    }

    if (!workPackage.delayResolvedAt && isWorkPackageOverdue(workPackage, now)) {
      return [createSelfOverdueInsight(workPackage, now, "selfBlocked")];
    }

    return [{
      key: "manual-blocked",
      kind: "manualBlocked",
      label: "人工阻塞",
      tone: "danger",
      title: workPackage.blockedReason ?? "该工作项已被人工标记为阻塞。",
      description: workPackage.blockedReason ?? "该工作项已被人工标记为阻塞。"
    }];
  }

  if (workPackage.status === "review" && !workPackage.delayResolvedAt && isWorkPackageOverdue(workPackage, now)) {
    return [{
      key: "review-overdue",
      kind: "reviewOverdue",
      label: "delay",
      tone: "default",
      title: "工作项仍在项目经理评审环节，已超过截止日期。",
      description: "工作项仍在项目经理评审环节，已超过截止日期。"
    }];
  }

  if (workPackage.status === "inProgress") {
    if (dependencyImpact) {
      return [{
        ...dependencyImpact,
        key: "dependency-attention",
        label: "受依赖影响",
        tone: "attention",
        description: dependencyImpact.description
      }];
    }

    if (!workPackage.delayResolvedAt && isWorkPackageOverdue(workPackage, now)) {
      return [createSelfOverdueInsight(workPackage, now, "executionOverdueRisk")];
    }
  }

  return [];
}

/**
 * 生成已完成或已解除异常工作项的复盘标签。
 */
export function getHistoryTags(workPackage: WorkPackage): WorkPackageStatusInsight[] {
  const tags: WorkPackageStatusInsight[] = [];
  if (workPackage.delayDays && workPackage.delayDays > 0) {
    tags.push({
      key: "was-delayed",
      kind: "wasDelayed",
      label: "逾期",
      tone: "default",
      title: workPackage.delayReason ?? "项目期间曾发生逾期。",
      description: workPackage.delayReason ?? "项目期间曾发生逾期。"
    });
  } else if (workPackage.delayStartedAt && (workPackage.delayResolvedAt || workPackage.status === "done")) {
    tags.push({
      key: "was-delayed",
      kind: "wasDelayed",
      label: "逾期",
      tone: "default",
      title: workPackage.delayReason ?? "项目期间曾发生逾期。",
      description: workPackage.delayReason ?? "项目期间曾发生逾期。"
    });
  }

  if (workPackage.blockedStartedAt && (workPackage.blockedResolvedAt || workPackage.status === "done")) {
    tags.push({
      key: "was-blocked",
      kind: "wasBlocked",
      label: "阻塞",
      tone: "default",
      title: workPackage.blockedReason ?? "项目期间曾发生阻塞。",
      description: workPackage.blockedReason ?? "项目期间曾发生阻塞。"
    });
  }

  return tags;
}

/**
 * 判断依赖工作项是否会阻塞当前工作项推进。
 */
export function isBlockingDependency(workPackage: WorkPackage) {
  return (
    workPackage.status === "blocked" ||
    ((workPackage.delayDays ?? 0) > 0 && !workPackage.delayResolvedAt) ||
    Boolean(workPackage.delayStartedAt && !workPackage.delayResolvedAt)
  );
}

function getDependencyImpact(
  workPackage: WorkPackage,
  allWorkPackages: WorkPackage[],
  projects: Project[],
  now: Date
): WorkPackageStatusInsight | undefined {
  if (workPackage.dependencies.length === 0) {
    return undefined;
  }

  const workPackageLookup = new Map(allWorkPackages.map((item) => [item.id, item]));
  const projectLookup = new Map(projects.map((project) => [project.id, project]));
  const dependencies = workPackage.dependencies
    .map((dependencyId) => workPackageLookup.get(dependencyId))
    .filter((item): item is WorkPackage => Boolean(item));
  const blocked = dependencies.filter((item) => item.status === "blocked");
  if (blocked.length > 0) {
    return createDependencyInsight(blocked, projectLookup, "dependencyBlocked");
  }

  const overdue = dependencies.filter((item) => isBlockingDependency(item) || isWorkPackageOverdue(item, now));
  if (overdue.length > 0) {
    return createDependencyInsight(overdue, projectLookup, "dependencyOverdue");
  }

  return undefined;
}

function createDependencyInsight(
  blockers: WorkPackage[],
  projectLookup: Map<string, Project>,
  kind: Extract<WorkPackageAttentionKind, "dependencyBlocked" | "dependencyOverdue">
): WorkPackageStatusInsight {
  const first = blockers[0];
  const projectName = first.projectId ? projectLookup.get(first.projectId)?.name : undefined;
  const sourceLabel = projectName ?? `#${first.id}`;
  const suffix = blockers.length > 1 ? `等 ${blockers.length} 项` : "";
  const action = kind === "dependencyBlocked" ? "阻塞" : "逾期";

  return {
    key: kind === "dependencyBlocked" ? "dependency-blocked" : "dependency-overdue",
    kind,
    label: `因${sourceLabel}${suffix}${action}`,
    tone: kind === "dependencyBlocked" ? "danger" : "attention",
    title: blockers.map((item) => formatDependencyTitle(item, projectLookup)).join("\n"),
    description: blockers.map((item) => formatDependencyTitle(item, projectLookup)).join("；"),
    sourceWorkPackageId: first.id,
    sourceProjectId: first.projectId
  };
}

function createSelfOverdueInsight(
  _workPackage: WorkPackage,
  _now: Date,
  kind: Extract<WorkPackageAttentionKind, "selfBlocked" | "executionOverdueRisk">
): WorkPackageStatusInsight {
  return {
    key: kind === "selfBlocked" ? "self-blocked" : "execution-overdue-risk",
    kind,
    label: "delay",
    tone: kind === "selfBlocked" ? "danger" : "attention",
    title: "截止日期已到且进度未达到 100%。",
    description: "截止日期已到且进度未达到 100%。"
  };
}

function formatDependencyTitle(workPackage: WorkPackage, projectLookup: Map<string, Project>) {
  const sourceProject = workPackage.projectId ? projectLookup.get(workPackage.projectId)?.name : undefined;
  return `${sourceProject ? `${sourceProject} · ` : ""}#${workPackage.id} ${workPackage.subject}`;
}

function isFinalStatus(status: WorkPackage["status"]) {
  return status === "done";
}
