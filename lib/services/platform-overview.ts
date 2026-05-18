import { buildStewardReport } from "@/lib/steward";
import type { Project, User, WorkPackage, WorkspaceSnapshot } from "@/lib/types";

export interface GlobalOverviewKpi {
  projectCount: number;
  activeProjectCount: number;
  workPackageCount: number;
  doneWorkPackageCount: number;
  highRiskProjectCount: number;
  overdueWorkPackageCount: number;
  blockedWorkPackageCount: number;
  upcomingMilestoneCount: number;
}

export interface ProjectOverviewMetric {
  projectId: string;
  projectIdentifier: string;
  projectName: string;
  health: Project["health"];
  progress: number;
  taskTotal: number;
  taskDone: number;
  memberCount: number;
  activeAssigneeCount: number;
  highRiskCount: number;
  overdueCount: number;
  blockedCount: number;
  upcomingMilestoneCount: number;
  upcomingMilestones: Array<{ id: number; subject: string; dueDate: string; daysUntilDue: number }>;
  aiSummary: string;
}

export interface PlatformOverviewSnapshot {
  global: GlobalOverviewKpi;
  projects: ProjectOverviewMetric[];
  highRiskWorkPackages: WorkPackage[];
  overdueWorkPackages: WorkPackage[];
}

const DONE_STATUSES = new Set(["done"]);

/**
 * Builds platform overview metrics from the same workspace snapshot used by UI.
 */
export function buildPlatformOverviewSnapshot(
  snapshot: WorkspaceSnapshot,
  user: User | undefined,
  now = new Date()
): PlatformOverviewSnapshot {
  const visibleProjects = resolveVisibleProjects(snapshot.projects, user);
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const projectWorkPackages = snapshot.workPackages.filter(
    (wp) => wp.projectId && visibleProjectIds.has(wp.projectId)
  );
  const metrics = visibleProjects
    .map((project) => buildProjectMetric(project, snapshot, projectWorkPackages, now))
    .sort((left, right) => riskWeight(right.health) - riskWeight(left.health) || left.projectName.localeCompare(right.projectName));

  return {
    global: {
      projectCount: visibleProjects.length,
      activeProjectCount: visibleProjects.filter((project) => project.status === "active").length,
      workPackageCount: projectWorkPackages.length,
      doneWorkPackageCount: projectWorkPackages.filter((wp) => DONE_STATUSES.has(wp.status)).length,
      highRiskProjectCount: visibleProjects.filter((project) => project.health === "High").length,
      overdueWorkPackageCount: projectWorkPackages.filter((wp) => isOverdue(wp, now)).length,
      blockedWorkPackageCount: countBlockedWorkPackages(projectWorkPackages, snapshot),
      upcomingMilestoneCount: projectWorkPackages.filter((wp) => isUpcomingMilestone(wp, now)).length
    },
    projects: metrics,
    highRiskWorkPackages: projectWorkPackages
      .filter((wp) => wp.riskLevel === "High")
      .sort((left, right) => priorityWeight(left.priority) - priorityWeight(right.priority))
      .slice(0, 10),
    overdueWorkPackages: projectWorkPackages
      .filter((wp) => isOverdue(wp, now))
      .sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)))
      .slice(0, 10)
  };
}

function buildProjectMetric(
  project: Project,
  snapshot: WorkspaceSnapshot,
  visibleWorkPackages: WorkPackage[],
  now: Date
): ProjectOverviewMetric {
  const workPackages = visibleWorkPackages.filter((wp) => wp.projectId === project.id);
  const activeAssigneeIds = new Set(
    workPackages
      .filter((wp) => !DONE_STATUSES.has(wp.status) && wp.assigneeId)
      .map((wp) => wp.assigneeId as string)
  );
  const blockedIds = blockedWorkPackageIds(workPackages, snapshot);
  const upcomingMilestones = workPackages
    .filter((wp) => isUpcomingMilestone(wp, now))
    .map((wp) => ({
      id: wp.id,
      subject: wp.subject,
      dueDate: wp.dueDate as string,
      daysUntilDue: daysBetween(now, new Date(wp.dueDate as string))
    }))
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue)
    .slice(0, 2);
  const projectSnapshot = {
    ...snapshot,
    projects: [project],
    workPackages,
    workPackageComments: snapshot.workPackageComments.filter((comment) =>
      workPackages.some((wp) => wp.id === comment.workPackageId)
    )
  };

  return {
    projectId: project.id,
    projectIdentifier: project.identifier,
    projectName: project.name,
    health: project.health,
    progress: project.progress,
    taskTotal: workPackages.length,
    taskDone: workPackages.filter((wp) => DONE_STATUSES.has(wp.status)).length,
    memberCount: snapshot.users.filter((candidate) =>
      candidate.participatingProjectIds.includes(project.id)
    ).length,
    activeAssigneeCount: activeAssigneeIds.size,
    highRiskCount: workPackages.filter((wp) => wp.riskLevel === "High").length,
    overdueCount: workPackages.filter((wp) => isOverdue(wp, now)).length,
    blockedCount: blockedIds.size,
    upcomingMilestoneCount: upcomingMilestones.length,
    upcomingMilestones,
    aiSummary: buildStewardReport(projectSnapshot).summary
  };
}

function resolveVisibleProjects(projects: Project[], user: User | undefined): Project[] {
  if (!user || user.role === "admin") {
    return projects;
  }

  const visibleIds = new Set(
    user.role === "projectManager" ? user.managedProjectIds : user.participatingProjectIds
  );
  return projects.filter((project) => visibleIds.has(project.id));
}

function isOverdue(workPackage: WorkPackage, now: Date): boolean {
  return Boolean(workPackage.dueDate && new Date(workPackage.dueDate) < now && !DONE_STATUSES.has(workPackage.status));
}

function isUpcomingMilestone(workPackage: WorkPackage, now: Date): boolean {
  if (workPackage.type !== "milestone" || !workPackage.dueDate) {
    return false;
  }

  const days = daysBetween(now, new Date(workPackage.dueDate));
  return days >= 0 && days <= 14;
}

function daysBetween(left: Date, right: Date): number {
  return Math.ceil((right.getTime() - left.getTime()) / (1000 * 60 * 60 * 24));
}

function blockedWorkPackageIds(
  workPackages: WorkPackage[],
  snapshot: WorkspaceSnapshot
): Set<number> {
  const ids = new Set(workPackages.filter((wp) => wp.status === "blocked").map((wp) => wp.id));
  const workPackageIds = new Set(workPackages.map((wp) => wp.id));
  for (const comment of snapshot.workPackageComments) {
    if (comment.type === "blocker" && workPackageIds.has(comment.workPackageId)) {
      ids.add(comment.workPackageId);
    }
  }

  return ids;
}

function countBlockedWorkPackages(workPackages: WorkPackage[], snapshot: WorkspaceSnapshot): number {
  return blockedWorkPackageIds(workPackages, snapshot).size;
}

function riskWeight(health: Project["health"]): number {
  if (health === "High") return 3;
  if (health === "Medium") return 2;
  return 1;
}

function priorityWeight(priority: WorkPackage["priority"]): number {
  if (priority === "P0") return 0;
  if (priority === "P1") return 1;
  return 2;
}
