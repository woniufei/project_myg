import { calculateDashboardStats } from "../analytics";
import type { ProjectHealthScore, RiskLevel, WorkspaceSnapshot } from "../types";

/**
 * Calculates a health score (0-100) for every project in the workspace.
 *
 * The score starts from the average task progress and is adjusted by blockers,
 * risks (WP type=risk), workload pressure, and overdue work packages. The
 * contributors list keeps the calculation transparent for the dashboard.
 */
export function calculateProjectHealthScores(snapshot: WorkspaceSnapshot): ProjectHealthScore[] {
  const stats = calculateDashboardStats(snapshot);
  const overloadCount = stats.workloadByPerson.filter((item) => item.loadRatio >= 80).length;

  return snapshot.projects.map((project) => {
    const projectWorkPackages = snapshot.workPackages.filter((wp) => wp.projectId === project.id);
    const taskLike = projectWorkPackages.filter((wp) => wp.type !== "risk");
    const risks = projectWorkPackages.filter((wp) => wp.type === "risk");

    const progressBase = taskLike.length
      ? Math.round(
          taskLike.reduce((total, wp) => total + wp.percentComplete, 0) / taskLike.length
        )
      : project.progress;

    const blocked = taskLike.filter((wp) => wp.status === "blocked").length;
    const highRisk = risks.filter((wp) => wp.riskLevel === "High").length;
    const mediumRisk = risks.filter((wp) => wp.riskLevel === "Medium").length;
    const overdue = taskLike.filter((wp) => isOverdue(wp.dueDate, wp.status)).length;

    const contributors: ProjectHealthScore["contributors"] = [
      { label: `工作项平均完成率 ${progressBase}%`, impact: progressBase },
      { label: `阻塞工作项 ${blocked} 个`, impact: -blocked * 8 },
      { label: `高风险 ${highRisk} 个`, impact: -highRisk * 12 },
      { label: `中风险 ${mediumRisk} 个`, impact: -mediumRisk * 5 },
      { label: `逾期工作项 ${overdue} 个`, impact: -overdue * 6 },
      { label: `负载过高人员 ${overloadCount} 个`, impact: -overloadCount * 4 }
    ];

    if (progressBase >= 70 && blocked === 0) {
      contributors.push({ label: "无阻塞且完成率领先", impact: 5 });
    }

    const rawScore = contributors.reduce((total, item) => total + item.impact, 0);
    const score = clamp(Math.round(rawScore), 0, 100);
    const level = inferLevelFromScore(score);

    return {
      projectId: project.id,
      projectName: project.name,
      score,
      level,
      contributors,
      highlight: buildHighlight(score, level, blocked, highRisk, overloadCount)
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function inferLevelFromScore(score: number): RiskLevel {
  if (score < 50) {
    return "High";
  }

  if (score < 75) {
    return "Medium";
  }

  return "Low";
}

function buildHighlight(
  score: number,
  level: RiskLevel,
  blocked: number,
  highRisk: number,
  overloadCount: number
): string {
  if (level === "High") {
    return `健康度 ${score} 分 · 阻塞 ${blocked} 个 / 高风险 ${highRisk} 个，建议立即介入`;
  }

  if (level === "Medium") {
    return `健康度 ${score} 分 · 关注阻塞与负载（过载 ${overloadCount} 人）`;
  }

  return `健康度 ${score} 分 · 项目可控，保持节奏`;
}

function isOverdue(dueDate: string | undefined, status: string): boolean {
  if (!dueDate || status === "done") {
    return false;
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  return due.getTime() < Date.now();
}
