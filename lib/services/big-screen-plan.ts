import { calculateCriticalPathIds } from "@/lib/intelligence/critical-path";
import { prisma } from "@/lib/prisma";
import type { Person, Project, User, WorkPackage, WorkspaceSnapshot } from "@/lib/types";
import { canAccessProject, resolveUserFromSnapshot, ServiceError } from "./auth-context";
import { loadWorkspaceSnapshot } from "./workspace";

export type PlanNodeShape = "milestone" | "task";
export type PlanDifficulty = "low" | "medium" | "high" | "critical";
export type PlanRiskLevel = "low" | "medium" | "high";
export type PlanScenarioStatus = "draft" | "proposed" | "applied" | "discarded";
export type PlanChangeType =
  | "node.move"
  | "node.add"
  | "node.delete"
  | "node.update"
  | "node.difficulty"
  | "phase.add"
  | "phase.delete"
  | "phase.update"
  | "dependency.add"
  | "dependency.delete"
  | "task.upsert"
  | "task.delete"
  | "ai.merge";

export interface PlanTask {
  id: string;
  title: string;
  ownerLabel: string;
  ownerPersonId?: string;
  startDate?: string;
  endDate?: string;
  estimateHours?: number;
  difficulty?: PlanDifficulty;
  riskLevel?: PlanRiskLevel;
  isBlocked?: boolean;
  blockedReason?: string;
  blockedStartedAt?: string;
  blockedResolvedAt?: string;
  delayReason?: string;
  delayDays?: number;
  delayStartedAt?: string;
  delayResolvedAt?: string;
  completedAt?: string;
  progress: number;
  status: "todo" | "in_progress" | "done";
  workPackageId?: number;
}

export interface PlanNode {
  id: string;
  phaseId: string;
  shape: PlanNodeShape;
  label: string;
  title: string;
  date: string;
  startDate?: string;
  endDate?: string;
  estimateHours?: number;
  difficulty: PlanDifficulty;
  difficultyScore?: number;
  riskLevel?: PlanRiskLevel;
  isBlocked?: boolean;
  blockedReason?: string;
  blockedStartedAt?: string;
  blockedResolvedAt?: string;
  delayReason?: string;
  directDelayDays?: number;
  propagatedDelayDays?: number;
  delayDays?: number;
  delayStartedAt?: string;
  delayResolvedAt?: string;
  blockedTaskCount?: number;
  delayTaskCount?: number;
  impactSourceNodeIds?: string[];
  impactedNodeIds?: string[];
  /**
   * True when the node received upstream delay but still meets its own original
   * deadline. These nodes break the propagation chain.
   */
  absorbedUpstreamDelay?: boolean;
  completedAt?: string;
  progress: number;
  ownerLabel?: string;
  ownerPersonId?: string;
  tasks: PlanTask[];
  workPackageId?: number;
  isOnCriticalPath: boolean;
}

export interface PlanPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  difficulty: PlanDifficulty;
  difficultyScore?: number;
  effortHours?: number;
  criticalPathRatio?: number;
  riskRatio?: number;
  blockedRatio?: number;
  blockedNodeCount?: number;
  delayNodeCount?: number;
  propagatedDelayDays?: number;
  maxDelayDays?: number;
  summary: string;
  ownerLabel?: string;
  ownerPersonId?: string;
  workPackageId?: number;
  riskCount: number;
  taskCount: number;
}

export interface PlanDependency {
  fromNodeId: string;
  toNodeId: string;
  isCritical: boolean;
}

export interface PlanModel {
  projectId: string;
  projectName: string;
  projectCode: string;
  subtitle: string;
  statusBadge: string;
  progress: number;
  projectDifficulty: PlanDifficulty;
  projectDifficultyScore?: number;
  currentBlockedCount?: number;
  currentDelayCount?: number;
  resolvedBlockedCount?: number;
  maxDelayDays?: number;
  initialDifficulty?: PlanDifficulty;
  difficultyOverride?: PlanDifficulty;
  startDate: string;
  endDate: string;
  today: string;
  phases: PlanPhase[];
  nodes: PlanNode[];
  dependencies: PlanDependency[];
}

export interface PlanScenarioSummary {
  id: string;
  name: string;
  status: PlanScenarioStatus;
  baselineId: string | null;
  agentSummary?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanBaselineSummary {
  id: string;
  version: number;
  appliedByUserId: string | null;
  appliedAt: string;
}

export interface ScreenPlanResponse {
  baseline: { plan: PlanModel; summary: PlanBaselineSummary } | null;
  scenarios: PlanScenarioSummary[];
  activeScenario: { plan: PlanModel; summary: PlanScenarioSummary } | null;
  /** Whichever plan is currently driving the canvas: scenario draft if active, otherwise baseline. */
  plan: PlanModel;
  source: "scenario" | "baseline";
}

export interface PlanChangeInput {
  type: PlanChangeType;
  targetRef: string;
  payload: Record<string, unknown>;
}

const PLAN_SCHEMA_VERSION = 1;

/**
 * Loads or initialises a baseline + active scenario for the requested project.
 */
export async function loadScreenPlan(options: {
  projectId: string;
  scenarioId?: string;
  user?: User;
  anonymousFallback?: boolean;
}): Promise<ScreenPlanResponse> {
  const { snapshot } = await loadWorkspaceSnapshot(
    options.user ? { userId: options.user.id } : {}
  );
  const scopedUser = options.user ? resolveUserFromSnapshot(snapshot, options.user) : undefined;
  const project = resolveVisibleProject(
    snapshot.projects,
    options.projectId,
    scopedUser,
    options.anonymousFallback
  );

  const baselinePlan = derivePlanMetrics(buildPlanFromWorkspace(project, snapshot));
  const baselineRow = await ensureBaseline(project.id, baselinePlan);
  const baselineSummary: PlanBaselineSummary = {
    id: baselineRow.id,
    version: baselineRow.version,
    appliedByUserId: baselineRow.appliedByUserId,
    appliedAt: baselineRow.appliedAt.toISOString()
  };

  const scenarios = await prisma.scheduleScenario.findMany({
    where: { projectId: project.id, status: { in: ["DRAFT", "PROPOSED"] } },
    orderBy: { updatedAt: "desc" }
  });

  const activeScenarioRow = options.scenarioId
    ? scenarios.find((scenario) => scenario.id === options.scenarioId) ?? null
    : null;

  const activeScenario = activeScenarioRow
    ? {
        plan: derivePlanMetrics(parsePlanJson(activeScenarioRow.draftJson, baselinePlan)),
        summary: scenarioToSummary(activeScenarioRow)
      }
    : null;

  return {
    baseline: { plan: baselinePlan, summary: baselineSummary },
    scenarios: scenarios.map(scenarioToSummary),
    activeScenario,
    plan: activeScenario?.plan ?? baselinePlan,
    source: activeScenario ? "scenario" : "baseline"
  };
}

/**
 * Creates a new draft scenario forked from the current baseline.
 */
export async function createScenario(options: {
  projectId: string;
  user: User;
  name?: string;
}) {
  const { snapshot } = await loadWorkspaceSnapshot({ userId: options.user.id });
  const scopedUser = resolveUserFromSnapshot(snapshot, options.user);
  const project = resolveVisibleProject(snapshot.projects, options.projectId, scopedUser);
  const baselinePlan = derivePlanMetrics(buildPlanFromWorkspace(project, snapshot));
  const baseline = await ensureBaseline(project.id, baselinePlan);

  return prisma.scheduleScenario.create({
    data: {
      projectId: project.id,
      baselineId: baseline.id,
      name: options.name ?? `计划草稿 ${new Date().toLocaleString("zh-CN")}`,
      status: "DRAFT",
      createdByUserId: options.user.id,
      draftJson: serializePlan(baselinePlan)
    }
  });
}

/**
 * Applies a batch of changes to the scenario draft and records each change.
 */
export async function patchScenario(options: {
  scenarioId: string;
  user: User;
  changes: PlanChangeInput[];
  nextDraft: PlanModel;
}) {
  const scenario = await prisma.scheduleScenario.findUnique({ where: { id: options.scenarioId } });
  if (!scenario) {
    throw new ServiceError("场景不存在。", 404);
  }
  if (scenario.status !== "DRAFT" && scenario.status !== "PROPOSED") {
    throw new ServiceError("已应用或已废弃的场景不能再编辑。", 409);
  }

  const nextDraft = derivePlanMetrics(options.nextDraft);

  await prisma.$transaction(async (tx) => {
    await tx.scheduleScenario.update({
      where: { id: scenario.id },
      data: { draftJson: serializePlan(nextDraft) }
    });

    for (const change of options.changes) {
      await tx.scheduleChange.create({
        data: {
          scenarioId: scenario.id,
          changeType: change.type,
          targetRef: change.targetRef,
          payloadJson: JSON.stringify(change.payload ?? {})
        }
      });
    }
  });

  await recordQualitySnapshot({
    plan: nextDraft,
    source: "DRAFT",
    triggerType: snapshotTriggerFromChanges(options.changes, nextDraft),
    scenarioId: scenario.id,
    createdByUserId: options.user.id
  });

  return nextDraft;
}

/**
 * Materialises the scenario draft back to WorkPackage rows and bumps a new baseline.
 */
export async function applyScenario(options: { scenarioId: string; user: User }) {
  const scenario = await prisma.scheduleScenario.findUnique({ where: { id: options.scenarioId } });
  if (!scenario) {
    throw new ServiceError("场景不存在。", 404);
  }
  if (scenario.status === "APPLIED" || scenario.status === "DISCARDED") {
    throw new ServiceError("场景已经处于终态。", 409);
  }

  const parsedDraft = parsePlanJson(scenario.draftJson, null);
  if (!parsedDraft) {
    throw new ServiceError("场景的草稿数据无效。", 422);
  }
  const draft = derivePlanMetrics(parsedDraft);

  const baselineVersion = await nextBaselineVersion(scenario.projectId);

  const baseline = await prisma.$transaction(async (tx) => {
    for (const phase of draft.phases) {
      if (typeof phase.workPackageId === "number") {
        await tx.workPackage.update({
          where: { id: phase.workPackageId },
          data: {
            subject: phase.name,
            startDate: new Date(phase.startDate),
            dueDate: new Date(phase.endDate),
            percentComplete: phase.progress,
            difficulty: toStoredDifficulty(phase.difficulty)
          }
        });
      }
    }

    for (const node of draft.nodes) {
      if (typeof node.workPackageId === "number") {
        await tx.workPackage.update({
          where: { id: node.workPackageId },
          data: {
            subject: node.title,
            startDate: node.startDate ? new Date(node.startDate) : null,
            dueDate: new Date(node.endDate ?? node.date),
            estimateHours: node.estimateHours,
            percentComplete: node.progress,
            difficulty: toStoredDifficulty(node.difficulty),
            riskLevel: node.riskLevel ? toStoredRiskLevel(node.riskLevel) : null,
            status: node.isBlocked ? "blocked" : statusFromProgress(node.progress, node.shape),
            isOnCriticalPath: node.isOnCriticalPath
          }
        });
      }
    }

    await tx.project.update({
      where: { id: draft.projectId },
      data: {
        progress: draft.progress,
        startDate: new Date(draft.startDate),
        endDate: new Date(draft.endDate)
      }
    });

    const nextBaseline = await tx.scheduleBaseline.create({
      data: {
        projectId: scenario.projectId,
        version: baselineVersion,
        snapshotJson: serializePlan(draft),
        appliedByUserId: options.user.id
      }
    });

    await tx.scheduleScenario.update({
      where: { id: scenario.id },
      data: { status: "APPLIED", appliedAt: new Date() }
    });

    return nextBaseline;
  });

  await recordQualitySnapshot({
    plan: draft,
    source: "APPLIED",
    triggerType: draft.progress >= 100 ? "PROJECT_COMPLETED" : snapshotTriggerFromChanges([], draft),
    scenarioId: scenario.id,
    baselineId: baseline.id,
    createdByUserId: options.user.id
  });
}

/**
 * Discards a scenario without writing back to WorkPackage.
 */
export async function discardScenario(options: { scenarioId: string }) {
  const scenario = await prisma.scheduleScenario.findUnique({ where: { id: options.scenarioId } });
  if (!scenario) {
    throw new ServiceError("场景不存在。", 404);
  }
  await prisma.scheduleScenario.update({
    where: { id: scenario.id },
    data: { status: "DISCARDED" }
  });
}

/**
 * Lists all change events recorded against a scenario.
 */
export async function listScenarioChanges(scenarioId: string) {
  return prisma.scheduleChange.findMany({
    where: { scenarioId },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function recordProjectStateSnapshot(options: {
  projectId: string;
  user?: User;
  triggerType:
    | "TASK_PROGRESS_UPDATED"
    | "NODE_COMPLETED"
    | "MILESTONE_COMPLETED"
    | "BLOCKED_CHANGED"
    | "BLOCKED_RESOLVED"
    | "DELAY_CHANGED"
    | "DELAY_RESOLVED"
    | "IMPACT_PROPAGATED"
    | "PROJECT_COMPLETED";
}) {
  const { snapshot } = await loadWorkspaceSnapshot(options.user ? { userId: options.user.id } : {});
  const scopedUser = options.user ? resolveUserFromSnapshot(snapshot, options.user) : undefined;
  const project = resolveVisibleProject(
    snapshot.projects,
    options.projectId,
    scopedUser,
    options.user === undefined
  );
  const plan = derivePlanMetrics(buildPlanFromWorkspace(project, snapshot));
  await recordQualitySnapshot({
    plan,
    source: "BASELINE",
    triggerType: options.triggerType,
    createdByUserId: options.user?.id
  });
  await recordImpactEvents(plan);
}

/* ----------------------- Plan model construction ----------------------- */

function resolveVisibleProject(
  projects: Project[],
  projectId: string,
  user?: User,
  anonymousFallback?: boolean
): Project {
  const project = projects.find((item) => item.id === projectId || item.identifier === projectId);
  if (!project) {
    throw new ServiceError("项目不存在或当前用户不可见。", 404);
  }
  if (anonymousFallback) {
    return project;
  }
  if (user && !canAccessProject(user, project.id)) {
    throw new ServiceError("当前用户无权查看该项目大屏。", 403);
  }
  return project;
}

function buildPlanFromWorkspace(project: Project, snapshot: WorkspaceSnapshot): PlanModel {
  const items = snapshot.workPackages.filter((wp) => wp.projectId === project.id);
  const peopleMap = new Map(snapshot.people.map((person) => [person.id, person]));
  const criticalPathIds = calculateCriticalPathIds(items);

  const datedItems = items.filter((wp) => wp.startDate || wp.dueDate);
  const projectStart = project.startDate ?? minDate(datedItems) ?? new Date().toISOString();
  const projectEnd = project.endDate ?? maxDate(datedItems) ?? projectStart;

  const phaseItems = items.filter((wp) => wp.type === "phase");
  const fallbackPhase: WorkPackage | null =
    phaseItems.length === 0
      ? {
          id: 0,
          projectId: project.id,
          type: "phase",
          subject: "总体计划",
          description: project.description ?? "",
          status: "inProgress",
          priority: "P1",
          origin: "manager",
          createdByUserId: "",
          percentComplete: project.progress,
          lastProgressNote: "",
          dependencies: [],
          startDate: projectStart,
          dueDate: projectEnd
        }
      : null;
  const phaseSources = fallbackPhase ? [fallbackPhase] : phaseItems;

  const phases: PlanPhase[] = phaseSources.map((phase) => buildPhase(phase, items, peopleMap));
  const nodes: PlanNode[] = [];
  for (const phase of phaseSources) {
    const phaseId = String(phase.id);
    const childItems = items.filter((wp) => wp.parentId === phase.id);
    const milestones = childItems.length
      ? childItems.filter((wp) => wp.type === "milestone")
      : items.filter((wp) => wp.type === "milestone");
    const tasks = childItems.length
      ? childItems.filter((wp) => wp.type !== "milestone" && wp.type !== "phase")
      : items.filter((wp) => wp.type === "task" || wp.type === "risk");

    for (const milestone of milestones) {
      const owner = milestone.assigneeId ? peopleMap.get(milestone.assigneeId) : undefined;
      nodes.push({
        id: `wp-${milestone.id}`,
        phaseId,
        shape: "milestone",
        label: milestoneLabel(milestone.subject, nodes.length),
        title: milestone.subject,
        date: (milestone.dueDate ?? milestone.startDate ?? phase.dueDate ?? projectEnd) as string,
        difficulty: difficultyFromWorkPackage(milestone),
        estimateHours: milestone.estimateHours,
        riskLevel: riskLevelFromWorkPackage(milestone),
        isBlocked: isBlockedWorkPackage(milestone),
        blockedReason: milestone.blockedReason,
        blockedStartedAt: milestone.blockedStartedAt,
        blockedResolvedAt: milestone.blockedResolvedAt,
        delayReason: milestone.delayReason,
        delayDays: milestone.delayDays,
        delayStartedAt: milestone.delayStartedAt,
        delayResolvedAt: milestone.delayResolvedAt,
        completedAt: milestone.completedAt,
        progress: milestone.percentComplete,
        ownerLabel: owner?.name,
        ownerPersonId: owner?.id,
        tasks: [],
        workPackageId: milestone.id,
        isOnCriticalPath: milestone.isOnCriticalPath ?? criticalPathIds.has(milestone.id)
      });
    }

    for (const task of tasks) {
      const owner = task.assigneeId ? peopleMap.get(task.assigneeId) : undefined;
      const start = (task.startDate ?? task.dueDate ?? phase.startDate ?? projectStart) as string;
      const end = (task.dueDate ?? task.startDate ?? phase.dueDate ?? projectEnd) as string;
      nodes.push({
        id: `wp-${task.id}`,
        phaseId,
        shape: "task",
        label: shortLabel(task.subject),
        title: task.subject,
        date: end,
        startDate: start,
        endDate: end,
        difficulty: difficultyFromWorkPackage(task),
        estimateHours: task.estimateHours,
        riskLevel: riskLevelFromWorkPackage(task),
        isBlocked: isBlockedWorkPackage(task),
        blockedReason: task.blockedReason,
        blockedStartedAt: task.blockedStartedAt,
        blockedResolvedAt: task.blockedResolvedAt,
        delayReason: task.delayReason,
        delayDays: task.delayDays,
        delayStartedAt: task.delayStartedAt,
        delayResolvedAt: task.delayResolvedAt,
        completedAt: task.completedAt,
        progress: task.percentComplete,
        ownerLabel: owner?.name,
        ownerPersonId: owner?.id,
        tasks: [
          {
            id: `wp-task-${task.id}`,
            title: task.subject,
            ownerLabel: owner?.name ?? "未分配",
            ownerPersonId: owner?.id,
            startDate: start,
            endDate: end,
            estimateHours: task.estimateHours,
            difficulty: difficultyFromWorkPackage(task),
            riskLevel: riskLevelFromWorkPackage(task),
            isBlocked: isBlockedWorkPackage(task),
            blockedReason: task.blockedReason,
            blockedStartedAt: task.blockedStartedAt,
            blockedResolvedAt: task.blockedResolvedAt,
            delayReason: task.delayReason,
            delayDays: task.delayDays,
            delayStartedAt: task.delayStartedAt,
            delayResolvedAt: task.delayResolvedAt,
            completedAt: task.completedAt,
            progress: task.percentComplete,
            status: normalizeTaskStatus(task.status),
            workPackageId: task.id
          }
        ],
        workPackageId: task.id,
        isOnCriticalPath: task.isOnCriticalPath ?? criticalPathIds.has(task.id)
      });
    }
  }

  const dependencies: PlanDependency[] = [];
  const idToNode = new Map(nodes.map((node) => [node.workPackageId ?? -1, node] as const));
  for (const item of items) {
    const target = idToNode.get(item.id);
    if (!target) continue;
    for (const dep of item.dependencies ?? []) {
      const source = idToNode.get(dep);
      if (!source) continue;
      dependencies.push({
        fromNodeId: source.id,
        toNodeId: target.id,
        isCritical: source.isOnCriticalPath && target.isOnCriticalPath
      });
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.identifier.toUpperCase(),
    subtitle: project.description ?? "项目计划总览",
    statusBadge: statusBadge(project.status),
    progress: project.progress,
    projectDifficulty: difficultyFromProject(project),
    initialDifficulty: project.initialDifficulty,
    difficultyOverride: project.difficultyOverride,
    startDate: projectStart,
    endDate: projectEnd,
    today: new Date().toISOString(),
    phases,
    nodes,
    dependencies
  };
}

function buildPhase(
  phase: WorkPackage,
  items: WorkPackage[],
  peopleMap: Map<string, Person>
): PlanPhase {
  const owner = phase.assigneeId ? peopleMap.get(phase.assigneeId) : undefined;
  const phaseChildren = items.filter((wp) => wp.parentId === phase.id);
  const taskCount = phaseChildren.filter((wp) => wp.type === "task" || wp.type === "milestone").length;
  const riskCount = phaseChildren.filter((wp) => wp.type === "risk" || wp.riskLevel === "High").length;
  const summary = phase.lastProgressNote || phase.description || "按计划推进";

  return {
    id: String(phase.id),
    name: phase.subject,
    startDate: phase.startDate ?? new Date().toISOString(),
    endDate: phase.dueDate ?? new Date().toISOString(),
    progress: phase.percentComplete,
    difficulty: difficultyFromWorkPackage(phase),
    summary: summary.split(/[；;\n]/)[0]?.slice(0, 60) ?? "按计划推进",
    ownerLabel: owner?.name,
    ownerPersonId: owner?.id,
    workPackageId: phase.id,
    riskCount,
    taskCount
  };
}

export function derivePlanMetrics(plan: PlanModel): PlanModel {
  const today = new Date(plan.today);
  const nodes = plan.nodes.map((node) => {
    const hasDependencyEdge = hasDependency(plan.dependencies, node.id);
    const tasks = node.tasks.map((task) => {
      const taskProgress = clampProgress(task.progress);
      const systemBlocked = hasDependencyEdge && taskProgress < 100 && isPastDueDate(task.endDate, today);
      return {
        ...task,
        progress: taskProgress,
        difficulty: task.difficulty ?? node.difficulty,
        status: inferTaskStatus(taskProgress),
        isBlocked: Boolean(task.isBlocked || systemBlocked),
        delayDays: calculateTaskDelayDays({ ...task, progress: taskProgress }, today)
      };
    });
    const taskProgressValues = tasks.map((task) => task.progress);
    const taskStart = minIso(...tasks.map((task) => task.startDate).filter(isString));
    const taskEnd = maxIso(...tasks.map((task) => task.endDate ?? task.startDate).filter(isString));
    const startDate = node.shape === "task"
      ? taskStart ?? node.startDate ?? node.date
      : node.date;
    const endDate = node.shape === "task"
      ? taskEnd ?? node.endDate ?? node.date
      : node.date;
    const nextDate = node.shape === "milestone" ? node.date : endDate;
    const progress = taskProgressValues.length
      ? averageProgress(taskProgressValues)
      : clampProgress(node.progress);
    const riskLevel = node.riskLevel ?? highestRiskLevel(tasks.map((task) => task.riskLevel));
    const systemBlocked = hasDependencyEdge && progress < 100 && isPastDueDate(endDate, today);
    const isBlocked = Boolean(node.isBlocked || tasks.some((task) => task.isBlocked) || systemBlocked);
    const estimateHours = node.estimateHours ?? sumEstimateHours(tasks);
    const blockedTasks = tasks.filter((task) => task.isBlocked);
    const delayedTasks = tasks.filter((task) => (task.delayDays ?? 0) > 0);
    const nodeDirectDelayDays = Math.max(
      calculateNodeScheduleDelayDays({ endDate, date: node.date, progress }, today),
      ...tasks.map((task) => task.delayDays ?? 0)
    );
    const blockedReason = node.blockedReason ?? blockedTasks[0]?.blockedReason;
    const delayReason = node.delayReason ?? delayedTasks[0]?.delayReason;

    return {
      ...node,
      tasks,
      estimateHours,
      riskLevel,
      isBlocked,
      blockedReason: blockedReason ?? (systemBlocked ? "存在依赖/关键路径且到期未完成" : undefined),
      directDelayDays: nodeDirectDelayDays,
      propagatedDelayDays: node.propagatedDelayDays ?? 0,
      delayDays: nodeDirectDelayDays,
      delayReason,
      blockedTaskCount: blockedTasks.length,
      delayTaskCount: delayedTasks.length,
      startDate,
      endDate,
      date: nextDate,
      progress,
      difficultyScore: DIFFICULTY_BASE_SCORE[node.difficulty],
      difficulty: node.difficulty
    };
  });
  const nodesWithImpact = applyPropagatedDelay(nodes, plan.dependencies, today);

  const phases = plan.phases.map((phase) => {
    const phaseNodes = nodesWithImpact.filter((node) => node.phaseId === phase.id);
    const progress = phaseNodes.length
      ? averageProgress(phaseNodes.map((node) => node.progress))
      : clampProgress(phase.progress);
    const startDate = minIso(...phaseNodes.map((node) => node.startDate ?? node.date).filter(isString)) ?? phase.startDate;
    const endDate = maxIso(...phaseNodes.map((node) => node.endDate ?? node.date).filter(isString)) ?? phase.endDate;
    const score = calculateCompositeDifficulty(
      phaseNodes.map((node) => ({
        difficulty: node.difficulty,
        effortHours: nodeEffortHours(node),
        isCritical: node.isOnCriticalPath,
        riskSeverity: riskSeverity(node.riskLevel),
        isBlocked: node.isBlocked
      })),
      phase.difficulty
    );
    return {
      ...phase,
      startDate,
      endDate,
      progress,
      difficulty: score.difficulty,
      difficultyScore: score.score,
      effortHours: score.effortHours,
      criticalPathRatio: score.criticalPathRatio,
      riskRatio: score.riskRatio,
      blockedRatio: score.blockedRatio,
      blockedNodeCount: phaseNodes.filter((node) => node.isBlocked).length,
      delayNodeCount: phaseNodes.filter((node) => (node.delayDays ?? 0) > 0).length,
      propagatedDelayDays: Math.max(0, ...phaseNodes.map((node) => node.propagatedDelayDays ?? 0)),
      maxDelayDays: Math.max(0, ...phaseNodes.map((node) => node.delayDays ?? 0)),
      taskCount: phaseNodes.length
    };
  });

  const progress = phases.length
    ? averageProgress(phases.map((phase) => phase.progress))
    : clampProgress(plan.progress ?? 0);
  const startDate = minIso(...phases.map((phase) => phase.startDate).filter(isString)) ?? plan.startDate;
  const endDate = maxIso(...phases.map((phase) => phase.endDate).filter(isString)) ?? plan.endDate;
  const projectScore = calculateCompositeDifficulty(
    phases.map((phase) => ({
      difficulty: phase.difficulty,
      effortHours: phase.effortHours ?? 1,
      isCritical: (phase.criticalPathRatio ?? 0) > 0,
      riskSeverity: phase.riskRatio,
      isBlocked: (phase.blockedRatio ?? 0) > 0
    })),
    plan.projectDifficulty
  );

  return {
    ...plan,
    progress,
    projectDifficulty: projectScore.difficulty,
    projectDifficultyScore: projectScore.score,
    currentBlockedCount: nodesWithImpact.filter((node) => node.isBlocked).length,
    currentDelayCount: nodesWithImpact.filter((node) => (node.delayDays ?? 0) > 0).length,
    resolvedBlockedCount: nodesWithImpact.filter((node) => !node.isBlocked && node.blockedResolvedAt).length,
    maxDelayDays: Math.max(0, ...nodesWithImpact.map((node) => node.delayDays ?? 0)),
    startDate,
    endDate,
    phases,
    nodes: nodesWithImpact
  };
}

function difficultyFromWorkPackage(item: WorkPackage): PlanDifficulty {
  if (item.difficulty) return item.difficulty;
  if (item.riskLevel === "High" && item.priority === "P0") return "critical";
  if (item.riskLevel === "High") return "high";
  if (item.riskLevel === "Medium" && item.priority === "P0") return "high";
  if (item.priority === "P0") return "medium";
  if (item.priority === "P1") return "medium";
  return "low";
}

function difficultyFromProject(project: Project): PlanDifficulty {
  return project.difficultyOverride ?? project.initialDifficulty ?? riskLevelToDifficulty(project.health);
}

function riskLevelToDifficulty(level: Project["health"]): PlanDifficulty {
  if (level === "High") return "high";
  if (level === "Medium") return "medium";
  return "low";
}

function riskLevelFromWorkPackage(item: WorkPackage): PlanRiskLevel | undefined {
  if (item.riskLevel === "High") return "high";
  if (item.riskLevel === "Medium") return "medium";
  if (item.riskLevel === "Low") return "low";
  return undefined;
}

function isBlockedWorkPackage(item: WorkPackage): boolean {
  return item.status === "blocked" || Boolean(item.blockedStartedAt && !item.blockedResolvedAt);
}

function calculateTaskDelayDays(task: PlanTask, today: Date, propagatedDelayDays = 0): number {
  const due = task.endDate ? new Date(task.endDate) : undefined;
  const adjustedDue = due ? addNaturalDays(due, propagatedDelayDays) : undefined;
  const overdue = adjustedDue && task.progress < 100 && today > adjustedDue
    ? naturalDayDelay(adjustedDue, today)
    : 0;
  return Math.max(0, overdue);
}

function calculateNodeScheduleDelayDays(
  node: Pick<PlanNode, "endDate" | "date" | "progress">,
  today: Date,
  propagatedDelayDays = 0
): number {
  const end = new Date(node.endDate ?? node.date);
  if (Number.isNaN(end.getTime()) || node.progress >= 100 || naturalDayDelay(end, today) <= 0) return 0;
  return naturalDayDelay(addNaturalDays(end, propagatedDelayDays), today);
}

/**
 * Treats upstream delay propagation as deadline grace for downstream nodes.
 */
function applyPropagatedDelay(nodes: PlanNode[], dependencies: PlanDependency[], today: Date): PlanNode[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const propagated = new Map<string, { days: number; sources: Set<string> }>();
  const absorbCapacityById = new Map(
    nodes.map((node) => [node.id, calculateAbsorbCapacityDays(node, today)])
  );

  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    const actualDelayById = new Map(
      nodes.map((node) => [
        node.id,
        calculateActualNodeDelayDays(node, today, propagated.get(node.id)?.days ?? 0)
      ])
    );

    for (const dependency of dependencies) {
      const source = nodeById.get(dependency.fromNodeId);
      const target = nodeById.get(dependency.toNodeId);
      if (!source || !target) continue;
      const sourcePropagated = propagated.get(source.id)?.days ?? 0;
      const sourceCapacity = absorbCapacityById.get(source.id) ?? 0;
      // Reduce upstream propagation by however many days this source can
      // genuinely absorb (only completed nodes contribute capacity).
      const reducedUpstream = Math.max(0, sourcePropagated - sourceCapacity);
      const sourceDays = Math.max(actualDelayById.get(source.id) ?? 0, reducedUpstream);
      if (sourceDays <= 0) continue;
      const current = propagated.get(target.id) ?? { days: 0, sources: new Set<string>() };
      if (sourceDays > current.days) {
        current.days = sourceDays;
        changed = true;
      }
      current.sources.add(source.id);
      const upstream = propagated.get(source.id)?.sources;
      if (upstream) {
        for (const id of upstream) current.sources.add(id);
      }
      propagated.set(target.id, current);
    }
    if (!changed) break;
  }

  return nodes.map((node) => {
    const impact = propagated.get(node.id);
    const propagatedDelayDays = impact?.days ?? 0;
    const tasks = node.tasks.map((task) => ({
      ...task,
      delayDays: calculateTaskDelayDays(task, today, propagatedDelayDays)
    }));
    const delayedTasks = tasks.filter((task) => (task.delayDays ?? 0) > 0);
    const delayDays = calculateActualNodeDelayDays({ ...node, tasks }, today, propagatedDelayDays);
    const absorbCapacity = absorbCapacityById.get(node.id) ?? 0;
    // Fully absorbed: this node took some upstream delay AND its absorb capacity
    // covers the full incoming amount, so downstream sees zero propagation.
    const absorbedUpstreamDelay =
      propagatedDelayDays > 0 && delayDays === 0 && propagatedDelayDays <= absorbCapacity;
    return {
      ...node,
      tasks,
      directDelayDays: delayDays,
      propagatedDelayDays,
      delayDays,
      delayReason: delayedTasks[0]?.delayReason ?? node.delayReason,
      delayTaskCount: delayedTasks.length,
      impactSourceNodeIds: impact ? Array.from(impact.sources) : [],
      absorbedUpstreamDelay
    };
  });
}

function calculateActualNodeDelayDays(node: PlanNode, today: Date, propagatedDelayDays: number): number {
  return Math.max(
    calculateNodeScheduleDelayDays(node, today, propagatedDelayDays),
    ...node.tasks.map((task) => calculateTaskDelayDays(task, today, propagatedDelayDays))
  );
}

/**
 * How many days of upstream Delay this node can genuinely absorb. Only nodes
 * that have already finished within their own original deadline contribute
 * capacity; in-flight nodes return 0 because we cannot prove they will land
 * on time yet.
 */
function calculateAbsorbCapacityDays(node: PlanNode, today: Date): number {
  if ((node.progress ?? 0) < 100) return 0;
  const due = new Date(node.endDate ?? node.date);
  if (Number.isNaN(due.getTime())) return 0;
  const reference = node.completedAt ? new Date(node.completedAt) : today;
  if (Number.isNaN(reference.getTime())) return 0;
  return naturalDayDelay(reference, due);
}

function shortLabel(subject: string): string {
  const matched = subject.match(/\b[A-Z]\d+\b/);
  if (matched) return matched[0];
  return subject.slice(0, 4);
}

function milestoneLabel(subject: string, index: number): string {
  const matched = subject.match(/\bM\d+\b/i);
  return matched?.[0].toUpperCase() ?? `M${index + 1}`;
}

function normalizeTaskStatus(status: string): PlanTask["status"] {
  if (["done", "completed", "achieved", "closed"].includes(status)) return "done";
  if (["inProgress", "review", "active", "mitigating"].includes(status)) return "in_progress";
  return "todo";
}

function statusBadge(status: Project["status"]) {
  if (status === "active") return "执行中";
  if (status === "onHold") return "暂停";
  return "已归档";
}

function naturalDayDelay(due: Date, today: Date): number {
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (todayDay <= dueDay) return 0;
  return Math.round((todayDay - dueDay) / 86_400_000);
}

function addNaturalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + Math.max(0, days));
  return next;
}

function isPastDueDate(value: string | undefined, today: Date): boolean {
  if (!value) return false;
  return naturalDayDelay(new Date(value), today) > 0;
}

function hasDependency(dependencies: PlanDependency[], nodeId: string): boolean {
  return dependencies.some((dependency) => dependency.fromNodeId === nodeId || dependency.toNodeId === nodeId);
}

function minDate(items: WorkPackage[]): string | undefined {
  return pickDate(items, Math.min, "start");
}

function maxDate(items: WorkPackage[]): string | undefined {
  return pickDate(items, Math.max, "end");
}

function pickDate(items: WorkPackage[], picker: (...values: number[]) => number, mode: "start" | "end") {
  const dates = items
    .map((wp) => (mode === "start" ? wp.startDate ?? wp.dueDate : wp.dueDate ?? wp.startDate))
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return dates.length ? new Date(picker(...dates)).toISOString() : undefined;
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value || 0)));
}

function averageProgress(values: number[]): number {
  if (!values.length) return 0;
  return clampProgress(values.reduce((sum, value) => sum + value, 0) / values.length);
}

interface CompositeDifficultyInput {
  difficulty: PlanDifficulty;
  effortHours?: number;
  isCritical?: boolean;
  riskSeverity?: number;
  isBlocked?: boolean;
}

interface CompositeDifficultyScore {
  difficulty: PlanDifficulty;
  score: number;
  effortHours: number;
  criticalPathRatio: number;
  riskRatio: number;
  blockedRatio: number;
}

/**
 * Scores delivery complexity using weighted base difficulty plus amplifiers
 * for critical-path, risk exposure, and blocked work. Ratios are effort-based
 * so one large hard node outweighs many tiny easy nodes.
 */
function calculateCompositeDifficulty(
  items: CompositeDifficultyInput[],
  fallback: PlanDifficulty = "medium"
): CompositeDifficultyScore {
  if (!items.length) {
    return {
      difficulty: fallback,
      score: DIFFICULTY_BASE_SCORE[fallback],
      effortHours: 0,
      criticalPathRatio: 0,
      riskRatio: 0,
      blockedRatio: 0
    };
  }

  const normalized = items.map((item) => ({ ...item, effortHours: Math.max(1, item.effortHours ?? 1) }));
  const totalEffort = normalized.reduce((sum, item) => sum + item.effortHours, 0);
  const baseScore = normalized.reduce(
    (sum, item) => sum + DIFFICULTY_BASE_SCORE[item.difficulty] * (item.effortHours / totalEffort),
    0
  );
  const criticalPathRatio = normalized.reduce(
    (sum, item) => sum + (item.isCritical ? item.effortHours : 0),
    0
  ) / totalEffort;
  const riskRatio = normalized.reduce(
    (sum, item) => sum + Math.max(0, Math.min(1, item.riskSeverity ?? 0)) * item.effortHours,
    0
  ) / totalEffort;
  const blockedRatio = normalized.reduce(
    (sum, item) => sum + (item.isBlocked ? item.effortHours : 0),
    0
  ) / totalEffort;
  const score = clampScore(baseScore + criticalPathRatio * 10 + riskRatio * 10 + blockedRatio * 10);

  return {
    difficulty: difficultyFromScore(score),
    score,
    effortHours: totalEffort,
    criticalPathRatio,
    riskRatio,
    blockedRatio
  };
}

const DIFFICULTY_BASE_SCORE: Record<PlanDifficulty, number> = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100
};

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function minIso(...values: string[]): string | undefined {
  return pickIso(values, Math.min);
}

function maxIso(...values: string[]): string | undefined {
  return pickIso(values, Math.max);
}

function pickIso(values: string[], picker: (...values: number[]) => number): string | undefined {
  const times = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  return times.length ? new Date(picker(...times)).toISOString() : undefined;
}

function inferTaskStatus(progress: number): PlanTask["status"] {
  if (progress >= 100) return "done";
  if (progress > 0) return "in_progress";
  return "todo";
}

function difficultyFromScore(score: number): PlanDifficulty {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function riskSeverity(level?: PlanRiskLevel): number {
  if (level === "high") return 1;
  if (level === "medium") return 0.6;
  if (level === "low") return 0.2;
  return 0;
}

function highestRiskLevel(values: Array<PlanRiskLevel | undefined>): PlanRiskLevel | undefined {
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  if (values.includes("low")) return "low";
  return undefined;
}

function sumEstimateHours(tasks: PlanTask[]): number | undefined {
  const total = tasks.reduce((sum, task) => sum + (task.estimateHours ?? 0), 0);
  return total > 0 ? total : undefined;
}

function nodeEffortHours(node: PlanNode): number {
  return Math.max(1, node.estimateHours ?? sumEstimateHours(node.tasks) ?? node.tasks.length ?? 1);
}

function toStoredDifficulty(value: PlanDifficulty): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  return value.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

function toStoredRiskLevel(value: PlanRiskLevel): "LOW" | "MEDIUM" | "HIGH" {
  return value.toUpperCase() as "LOW" | "MEDIUM" | "HIGH";
}

function statusFromProgress(progress: number, _shape: PlanNodeShape): string {
  if (progress >= 100) return "done";
  if (progress > 0) return "inProgress";
  return "todo";
}

async function recordQualitySnapshot(options: {
  plan: PlanModel;
  source: "BASELINE" | "DRAFT" | "APPLIED";
  triggerType?: "MANUAL" | "TASK_PROGRESS_UPDATED" | "NODE_COMPLETED" | "MILESTONE_COMPLETED" | "BLOCKED_CHANGED" | "BLOCKED_RESOLVED" | "DELAY_CHANGED" | "DELAY_RESOLVED" | "IMPACT_PROPAGATED" | "PROJECT_COMPLETED";
  scenarioId?: string;
  baselineId?: string;
  createdByUserId?: string;
}) {
  const plan = derivePlanMetrics(options.plan);
  const taskItemCount = plan.nodes.reduce((sum, node) => sum + node.tasks.length, 0);
  const metricJson = {
    progress: plan.progress,
    difficulty: plan.projectDifficulty,
    difficultyScore: plan.projectDifficultyScore,
    blocked: plan.currentBlockedCount ?? 0,
    delayed: plan.currentDelayCount ?? 0,
    resolvedBlocked: plan.resolvedBlockedCount ?? 0,
    maxDelayDays: plan.maxDelayDays ?? 0,
    phases: plan.phases.length,
    nodes: plan.nodes.length,
    taskItems: taskItemCount
  };
  const aiContextJson = {
    project: {
      id: plan.projectId,
      name: plan.projectName,
      code: plan.projectCode,
      progress: plan.progress,
      difficulty: plan.projectDifficulty,
      difficultyScore: plan.projectDifficultyScore,
      currentBlockedCount: plan.currentBlockedCount,
      currentDelayCount: plan.currentDelayCount,
      resolvedBlockedCount: plan.resolvedBlockedCount,
      maxDelayDays: plan.maxDelayDays,
      startDate: plan.startDate,
      endDate: plan.endDate
    },
    phases: plan.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      progress: phase.progress,
      difficulty: phase.difficulty,
      difficultyScore: phase.difficultyScore,
      blockedNodeCount: phase.blockedNodeCount,
      delayNodeCount: phase.delayNodeCount,
      maxDelayDays: phase.maxDelayDays,
      criticalPathRatio: phase.criticalPathRatio,
      riskRatio: phase.riskRatio,
      blockedRatio: phase.blockedRatio,
      startDate: phase.startDate,
      endDate: phase.endDate,
      nodeCount: plan.nodes.filter((node) => node.phaseId === phase.id).length
    })),
    nodes: plan.nodes.map((node) => ({
      id: node.id,
      phaseId: node.phaseId,
      title: node.title,
      shape: node.shape,
      progress: node.progress,
      difficulty: node.difficulty,
      difficultyScore: node.difficultyScore,
      isBlocked: node.isBlocked,
      blockedReason: node.blockedReason,
      directDelayDays: node.directDelayDays,
      propagatedDelayDays: node.propagatedDelayDays,
      delayDays: node.delayDays,
      delayReason: node.delayReason,
      impactSourceNodeIds: node.impactSourceNodeIds,
      estimateHours: node.estimateHours,
      riskLevel: node.riskLevel,
      startDate: node.startDate,
      endDate: node.endDate,
      ownerPersonId: node.ownerPersonId,
      taskItemCount: node.tasks.length
    }))
  };

  const snapshot = await prisma.projectQualitySnapshot.create({
    data: {
      projectId: plan.projectId,
      source: options.source,
      triggerType: options.triggerType ?? "MANUAL",
      scenarioId: options.scenarioId,
      baselineId: options.baselineId,
      projectProgress: plan.progress,
      projectDifficulty: toStoredDifficulty(plan.projectDifficulty),
      startDate: new Date(plan.startDate),
      endDate: new Date(plan.endDate),
      phaseCount: plan.phases.length,
      nodeCount: plan.nodes.length,
      taskItemCount,
      metricJson: JSON.stringify(metricJson),
      aiContextJson: JSON.stringify(aiContextJson),
      createdByUserId: options.createdByUserId
    }
  });

  const metrics = buildQualityMetrics(snapshot.id, plan);
  if (metrics.length) {
    await prisma.projectQualityMetric.createMany({ data: metrics });
  }
}

function buildQualityMetrics(snapshotId: string, plan: PlanModel) {
  const rows: Array<{
    snapshotId: string;
    projectId: string;
    entityType: string;
    entityRef: string;
    metricKey: string;
    numericValue?: number;
    textValue?: string;
    difficultyValue?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    startDate?: Date;
    endDate?: Date;
    personId?: string;
    teamRef?: string;
    evidenceJson: string;
  }> = [];

  const push = (row: Omit<(typeof rows)[number], "snapshotId" | "projectId" | "evidenceJson"> & { evidence?: unknown }) => {
    const { evidence, ...metric } = row;
    rows.push({
      snapshotId,
      projectId: plan.projectId,
      ...metric,
      evidenceJson: JSON.stringify(evidence ?? {})
    });
  };

  push({
    entityType: "project",
    entityRef: plan.projectId,
    metricKey: "progress",
    numericValue: plan.progress,
    difficultyValue: toStoredDifficulty(plan.projectDifficulty),
    startDate: new Date(plan.startDate),
    endDate: new Date(plan.endDate),
    evidence: { phaseCount: plan.phases.length, nodeCount: plan.nodes.length, score: plan.projectDifficultyScore }
  });

  for (const phase of plan.phases) {
    push({
      entityType: "phase",
      entityRef: phase.id,
      metricKey: "progress",
      numericValue: phase.progress,
      textValue: phase.name,
      difficultyValue: toStoredDifficulty(phase.difficulty),
      startDate: new Date(phase.startDate),
      endDate: new Date(phase.endDate),
      personId: phase.ownerPersonId,
      evidence: {
        riskCount: phase.riskCount,
        taskCount: phase.taskCount,
        score: phase.difficultyScore,
        criticalPathRatio: phase.criticalPathRatio,
        riskRatio: phase.riskRatio,
        blockedRatio: phase.blockedRatio
      }
    });
  }

  for (const node of plan.nodes) {
    push({
      entityType: "node",
      entityRef: node.id,
      metricKey: "progress",
      numericValue: node.progress,
      textValue: node.title,
      difficultyValue: toStoredDifficulty(node.difficulty),
      startDate: new Date(node.startDate ?? node.date),
      endDate: new Date(node.endDate ?? node.date),
      personId: node.ownerPersonId,
      evidence: {
        phaseId: node.phaseId,
        shape: node.shape,
        score: node.difficultyScore,
        estimateHours: node.estimateHours,
        riskLevel: node.riskLevel,
        isBlocked: node.isBlocked,
        isOnCriticalPath: node.isOnCriticalPath
      }
    });
    for (const task of node.tasks) {
      push({
        entityType: "task",
        entityRef: task.id,
        metricKey: "progress",
        numericValue: task.progress,
        textValue: task.title,
        difficultyValue: toStoredDifficulty(task.difficulty ?? node.difficulty),
        startDate: task.startDate ? new Date(task.startDate) : undefined,
        endDate: task.endDate ? new Date(task.endDate) : undefined,
        personId: task.ownerPersonId,
        teamRef: task.ownerLabel,
        evidence: { nodeId: node.id, phaseId: node.phaseId, status: task.status }
      });
    }
  }

  return rows;
}

function snapshotTriggerFromChanges(
  changes: PlanChangeInput[],
  plan: PlanModel
): "MANUAL" | "TASK_PROGRESS_UPDATED" | "NODE_COMPLETED" | "MILESTONE_COMPLETED" | "BLOCKED_CHANGED" | "BLOCKED_RESOLVED" | "DELAY_CHANGED" | "DELAY_RESOLVED" | "IMPACT_PROPAGATED" | "PROJECT_COMPLETED" {
  if (plan.progress >= 100) return "PROJECT_COMPLETED";
  for (const change of changes) {
    const payload = change.payload ?? {};
    if (payload.delayResolvedAt) return "DELAY_RESOLVED";
    if (payload.delayDays || payload.delayReason || payload.delayStartedAt) return "DELAY_CHANGED";
    if (payload.blockedResolvedAt) return "BLOCKED_RESOLVED";
    if (payload.isBlocked || payload.blockedReason || payload.blockedStartedAt) return "BLOCKED_CHANGED";
    if (change.type === "dependency.add") return "IMPACT_PROPAGATED";
    if (change.type === "node.update") {
      const node = plan.nodes.find((entry) => entry.id === change.targetRef);
      if (node?.progress === 100) return node.shape === "milestone" ? "MILESTONE_COMPLETED" : "NODE_COMPLETED";
      return "TASK_PROGRESS_UPDATED";
    }
    if (change.type === "task.upsert") return "TASK_PROGRESS_UPDATED";
  }
  return "MANUAL";
}

async function recordImpactEvents(plan: PlanModel) {
  const rows = plan.nodes.flatMap((node) => {
    if (!node.workPackageId || !node.impactSourceNodeIds?.length || !(node.propagatedDelayDays && node.propagatedDelayDays > 0)) {
      return [];
    }
    return node.impactSourceNodeIds.flatMap((sourceNodeId) => {
      const source = plan.nodes.find((entry) => entry.id === sourceNodeId);
      if (!source?.workPackageId) return [];
      return [{
        projectId: plan.projectId,
        sourceWorkPackageId: source.workPackageId,
        impactedWorkPackageId: node.workPackageId as number,
        dependencyPathJson: JSON.stringify([source.id, node.id]),
        delayDays: node.propagatedDelayDays ?? 0,
        reason: "上游依赖节点延期导致传播 delay"
      }];
    });
  });

  if (rows.length) {
    await prisma.workPackageImpactEvent.createMany({ data: rows });
  }
}

/* --------------------------- Persistence helpers --------------------------- */

async function ensureBaseline(projectId: string, plan: PlanModel) {
  const existing = await prisma.scheduleBaseline.findFirst({
    where: { projectId },
    orderBy: { version: "desc" }
  });
  if (existing) {
    return existing;
  }
  return prisma.scheduleBaseline.create({
    data: {
      projectId,
      version: 1,
      snapshotJson: serializePlan(plan)
    }
  });
}

async function nextBaselineVersion(projectId: string) {
  const latest = await prisma.scheduleBaseline.findFirst({
    where: { projectId },
    orderBy: { version: "desc" }
  });
  return (latest?.version ?? 0) + 1;
}

function scenarioToSummary(row: {
  id: string;
  name: string;
  status: string;
  baselineId: string | null;
  agentSummary: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): PlanScenarioSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status.toLowerCase() as PlanScenarioStatus,
    baselineId: row.baselineId,
    agentSummary: row.agentSummary ?? undefined,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializePlan(plan: PlanModel): string {
  return JSON.stringify({ version: PLAN_SCHEMA_VERSION, plan });
}

function parsePlanJson<T extends PlanModel | null>(value: string, fallback: T): PlanModel | T {
  try {
    const parsed = JSON.parse(value) as { version?: number; plan?: PlanModel } | PlanModel;
    if (parsed && typeof parsed === "object" && "plan" in parsed && parsed.plan) {
      return parsed.plan;
    }
    if (parsed && typeof parsed === "object" && "phases" in parsed) {
      return parsed as PlanModel;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}
