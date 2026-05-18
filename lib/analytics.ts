import type { DashboardStats, WorkPackage, WorkspaceSnapshot } from "./types";

const ACTIVE_STATUSES = new Set(["todo", "inProgress", "review", "blocked"]);

/**
 * Calculates dashboard metrics from the current workspace snapshot.
 *
 * Risks are encoded as WorkPackage rows with `type === "risk"`, so we read
 * `riskLevel` instead of looking up a separate Risk collection.
 */
export function calculateDashboardStats(snapshot: WorkspaceSnapshot): DashboardStats {
  const { workPackages } = snapshot;
  const taskLike = workPackages.filter((wp) => wp.type !== "risk");
  const risks = workPackages.filter((wp) => wp.type === "risk");

  const doneCount = taskLike.filter((wp) => wp.status === "done").length;
  const blockedCount = taskLike.filter((wp) => wp.status === "blocked").length;
  const highRiskCount = risks.filter((wp) => wp.riskLevel === "High").length;
  const averageProgress = snapshot.projects.length
    ? Math.round(
        snapshot.projects.reduce((total, project) => total + project.progress, 0) /
          snapshot.projects.length
      )
    : 0;

  const workloadByPerson = snapshot.people.map((person) => {
    const assignedHours = taskLike
      .filter(
        (wp) =>
          wp.assigneeId === person.id &&
          wp.status !== "done"
      )
      .reduce((total, wp) => total + (wp.estimateHours ?? 0), 0);

    return {
      person,
      assignedHours,
      loadRatio: person.capacity ? Math.round((assignedHours / person.capacity) * 100) : 0
    };
  });

  return {
    projectCount: snapshot.projects.length,
    workPackageCount: workPackages.length,
    doneCount,
    blockedCount,
    highRiskCount,
    averageProgress,
    workloadByPerson,
    bottlenecks: findBottlenecks(workPackages)
  };
}

/**
 * Finds work packages that are likely blocking delivery.
 */
export function findBottlenecks(workPackages: WorkPackage[]): WorkPackage[] {
  return workPackages
    .filter((wp) => wp.status === "blocked" || wp.priority === "P0")
    .sort((left, right) => {
      const statusWeight = Number(right.status === "blocked") - Number(left.status === "blocked");
      if (statusWeight !== 0) {
        return statusWeight;
      }

      return (right.estimateHours ?? 0) - (left.estimateHours ?? 0);
    })
    .slice(0, 4);
}

/**
 * Groups work packages by status, type, or assignee for kanban-style boards.
 */
export function groupWorkPackages(
  workPackages: WorkPackage[],
  mode: "status" | "type" | "assignee"
): Record<string, WorkPackage[]> {
  return workPackages.reduce<Record<string, WorkPackage[]>>((groups, wp) => {
    const key = mode === "status" ? wp.status : mode === "type" ? wp.type : wp.assigneeId ?? "unassigned";
    groups[key] = groups[key] ?? [];
    groups[key].push(wp);
    return groups;
  }, {});
}

/**
 * Returns true when the work package is still active (not done/completed).
 */
export function isActive(workPackage: WorkPackage): boolean {
  return ACTIVE_STATUSES.has(workPackage.status);
}
