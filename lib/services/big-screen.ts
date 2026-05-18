import { calculateCriticalPathIds } from "@/lib/intelligence/critical-path";
import { canAccessProject, resolveUserFromSnapshot } from "@/lib/services/auth-context";
import type { Person, Project, User, WorkPackage, WorkspaceSnapshot } from "@/lib/types";

export interface BigScreenViewModel {
  meta: {
    projectId: string;
    projectName: string;
    code: string;
    subtitle: string;
    startDate: string;
    endDate: string;
    statusBadge: string;
    year: number;
    keyMilestones: Array<{ label: string; date: string }>;
  };
  timeline: {
    quarters: Array<{ label: string; months: Array<{ label: string; index: number }> }>;
    today: string;
  };
  phases: BigScreenPhase[];
  criticalPathIds: string[];
}

export interface BigScreenPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  accentColor: string;
  questions: string[];
  tasks: BigScreenTask[];
  milestones: BigScreenMilestone[];
}

export interface BigScreenTask {
  id: string;
  title: string;
  ownerLabel: string;
  status: "done" | "in_progress" | "todo";
  startDate: string;
  endDate: string;
  progress: number;
  isOnCriticalPath: boolean;
}

export interface BigScreenMilestone {
  id: string;
  label: string;
  topLabel: string;
  date: string;
}

const PHASE_COLORS = ["phase-blue", "phase-green", "phase-amber", "phase-purple"];

/**
 * Builds one big-screen view model for a visible project.
 */
export function buildBigScreenViewModel(
  snapshot: WorkspaceSnapshot,
  projectId: string,
  user?: User,
  now = new Date()
): BigScreenViewModel {
  const scopedUser = user ? resolveUserFromSnapshot(snapshot, user) : undefined;
  const project = resolveVisibleProject(snapshot.projects, projectId, scopedUser);
  const people = new Map(snapshot.people.map((person) => [person.id, person]));
  const items = snapshot.workPackages.filter((wp) => wp.projectId === project.id);
  const criticalPathIds = calculateCriticalPathIds(items);
  const datedItems = items.filter((wp) => wp.startDate || wp.dueDate);
  const projectStart = project.startDate ?? minDate(datedItems) ?? now.toISOString();
  const projectEnd = project.endDate ?? maxDate(datedItems) ?? projectStart;
  const milestones = items.filter((wp) => wp.type === "milestone" && wp.dueDate);
  const phaseItems = items.filter((wp) => wp.type === "phase");
  const fallbackPhase: WorkPackage = phaseItems[0] ?? {
    id: 0,
    projectId: project.id,
    type: "phase",
    subject: "总体计划",
    description: project.description ?? "",
    status: "active",
    priority: "P1",
    origin: "manager",
    createdByUserId: "",
    percentComplete: project.progress,
    lastProgressNote: "",
    dependencies: [],
    startDate: projectStart,
    dueDate: projectEnd
  };
  const phases = (phaseItems.length ? phaseItems : [fallbackPhase]).map((phase, index) =>
    buildPhase(phase, items, milestones, people, criticalPathIds, index, projectStart, projectEnd)
  );

  return {
    meta: {
      projectId: project.id,
      projectName: project.name,
      code: project.identifier.toUpperCase(),
      subtitle: project.description ?? "项目计划总览",
      startDate: projectStart,
      endDate: projectEnd,
      statusBadge: statusBadge(project.status),
      year: new Date(projectStart).getFullYear(),
      keyMilestones: milestones.slice(0, 4).map((milestone) => ({
        label: milestone.subject,
        date: milestone.dueDate as string
      }))
    },
    timeline: {
      quarters: buildQuarters(projectStart, projectEnd),
      today: now.toISOString()
    },
    phases,
    criticalPathIds: Array.from(criticalPathIds).map(String)
  };
}

function resolveVisibleProject(projects: Project[], projectId: string, user?: User): Project {
  const project = projects.find((item) => item.id === projectId || item.identifier === projectId);
  if (!project) {
    throw new Error("项目不存在或当前用户不可见。");
  }

  if (user && !canAccessProject(user, project.id)) {
    throw new Error("当前用户无权查看该项目大屏。");
  }

  return project;
}

function buildPhase(
  phase: WorkPackage,
  items: WorkPackage[],
  milestones: WorkPackage[],
  people: Map<string, Person>,
  criticalPathIds: Set<number>,
  index: number,
  projectStart: string,
  projectEnd: string
): BigScreenPhase {
  const children = items.filter((wp) => wp.parentId === phase.id && wp.type !== "milestone");
  const tasks = (children.length ? children : items.filter((wp) => wp.type === "task" || wp.type === "risk"))
    .slice(0, 8)
    .map((wp) => toTask(wp, people, criticalPathIds, projectStart, projectEnd));
  const phaseMilestones = milestones.filter((milestone) => milestone.parentId === phase.id);

  return {
    id: String(phase.id),
    name: phase.subject,
    startDate: phase.startDate ?? projectStart,
    endDate: phase.dueDate ?? projectEnd,
    progress: phase.percentComplete,
    accentColor: PHASE_COLORS[index % PHASE_COLORS.length],
    questions: extractQuestions(phase.description),
    tasks,
    milestones: (phaseMilestones.length ? phaseMilestones : milestones.slice(0, 3)).map((milestone, milestoneIndex) => ({
      id: String(milestone.id),
      label: milestoneLabel(milestone.subject, milestoneIndex),
      topLabel: milestone.subject,
      date: milestone.dueDate as string
    }))
  };
}

function toTask(
  workPackage: WorkPackage,
  people: Map<string, Person>,
  criticalPathIds: Set<number>,
  projectStart: string,
  projectEnd: string
): BigScreenTask {
  return {
    id: String(workPackage.id),
    title: workPackage.subject,
    ownerLabel: workPackage.assigneeId ? people.get(workPackage.assigneeId)?.name ?? "未分配" : "未分配",
    status: normalizeStatus(workPackage.status),
    startDate: workPackage.startDate ?? workPackage.dueDate ?? projectStart,
    endDate: workPackage.dueDate ?? workPackage.startDate ?? projectEnd,
    progress: workPackage.percentComplete,
    isOnCriticalPath: workPackage.isOnCriticalPath ?? criticalPathIds.has(workPackage.id)
  };
}

function normalizeStatus(status: string): BigScreenTask["status"] {
  if (["done", "completed", "achieved", "closed"].includes(status)) return "done";
  if (["inProgress", "review", "active", "mitigating"].includes(status)) return "in_progress";
  return "todo";
}

function buildQuarters(start: string, end: string) {
  return [0, 1, 2, 3].map((quarter) => ({
    label: `Q${quarter + 1}`,
    months: [1, 2, 3].map((offset) => {
      const month = quarter * 3 + offset;
      return { label: `${month}月`, index: month };
    })
  }));
}

function extractQuestions(description: string): string[] {
  const normalized = description.replace(/^关键问题[:：]/, "");
  return normalized
    .split(/[；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function milestoneLabel(subject: string, index: number): string {
  const matched = subject.match(/\bM\d+\b/i);
  return matched?.[0].toUpperCase() ?? `M${index + 1}`;
}

function minDate(items: WorkPackage[]): string | undefined {
  return pickDate(items, Math.min, "start");
}

function maxDate(items: WorkPackage[]): string | undefined {
  return pickDate(items, Math.max, "end");
}

function pickDate(items: WorkPackage[], picker: (...values: number[]) => number, mode: "start" | "end") {
  const dates = items
    .map((wp) => mode === "start" ? wp.startDate ?? wp.dueDate : wp.dueDate ?? wp.startDate)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return dates.length ? new Date(picker(...dates)).toISOString() : undefined;
}

function statusBadge(status: Project["status"]) {
  if (status === "active") return "执行中";
  if (status === "onHold") return "暂停";
  return "已归档";
}
