import { describe, expect, it } from "vitest";
import {
  applyAutomatedWorkPackageState,
  getCurrentAttentionTags,
  getHistoryTags,
  isBlockingDependency
} from "@/lib/work-package-status";
import type { Project, WorkPackage } from "@/lib/types";

const now = new Date("2026-05-15T00:00:00.000Z");
const projects: Project[] = [
  {
    id: "project-a",
    identifier: "project-a",
    name: "项目A",
    status: "active",
    health: "Medium",
    initialDifficulty: "medium",
    progress: 50,
    enabledModules: []
  },
  {
    id: "project-b",
    identifier: "project-b",
    name: "项目B",
    status: "active",
    health: "Medium",
    initialDifficulty: "medium",
    progress: 20,
    enabledModules: []
  }
];

describe("work package status insights", () => {
  it("shows review overdue instead of overdue blocked while a work package is under review", () => {
    const workPackage = workPackageFixture({
      status: "review",
      dueDate: "2026-05-12T00:00:00.000Z",
      percentComplete: 5
    });

    const tags = getCurrentAttentionTags(workPackage, [workPackage], projects, now);

    expect(tags).toMatchObject([
      {
        kind: "reviewOverdue",
        label: "delay"
      }
    ]);
  });

  it("shows execution overdue risk before a running work package is blocked", () => {
    const workPackage = workPackageFixture({
      status: "inProgress",
      dueDate: "2026-05-14T00:00:00.000Z",
      percentComplete: 60
    });

    const tags = getCurrentAttentionTags(workPackage, [workPackage], projects, now);

    expect(tags).toMatchObject([
      {
        kind: "executionOverdueRisk",
        label: "delay"
      }
    ]);
  });

  it("shows dependency blocker source before self-overdue reason", () => {
    const source = workPackageFixture({
      id: 23,
      projectId: "project-a",
      subject: "产线数据联调",
      status: "blocked"
    });
    const impacted = workPackageFixture({
      id: 24,
      projectId: "project-b",
      status: "blocked",
      dependencies: [23],
      dueDate: "2026-05-10T00:00:00.000Z"
    });

    const tags = getCurrentAttentionTags(impacted, [source, impacted], projects, now);

    expect(tags).toMatchObject([
      {
        kind: "dependencyBlocked",
        label: "因项目A阻塞",
        sourceWorkPackageId: 23
      }
    ]);
    expect(tags[0].title).toContain("#23 产线数据联调");
  });

  it("keeps historical delay tags after completion", () => {
    const workPackage = workPackageFixture({
      status: "done",
      percentComplete: 100,
      delayDays: 2,
      delayReason: "依赖硬件样件晚到",
      blockedStartedAt: "2026-05-10T00:00:00.000Z",
      blockedReason: "等待样件"
    });

    const tags = getHistoryTags(workPackage);

    expect(tags.map((tag) => tag.kind)).toEqual(["wasDelayed", "wasBlocked"]);
    expect(tags[0].label).toBe("逾期");
  });

  it("keeps recovered delay as grey history without blocking downstream work", () => {
    const workPackage = workPackageFixture({
      status: "inProgress",
      dueDate: "2026-05-10T00:00:00.000Z",
      percentComplete: 40,
      delayDays: 3,
      delayStartedAt: "2026-05-10T00:00:00.000Z",
      delayResolvedAt: "2026-05-15T00:00:00.000Z",
      blockedStartedAt: "2026-05-11T00:00:00.000Z",
      blockedResolvedAt: "2026-05-15T00:00:00.000Z"
    });

    expect(getCurrentAttentionTags(workPackage, [workPackage], projects, now)).toEqual([]);
    expect(getHistoryTags(workPackage).map((tag) => tag.label)).toEqual(["逾期", "阻塞"]);
    expect(isBlockingDependency(workPackage)).toBe(false);
    expect(applyAutomatedWorkPackageState(workPackage, now).status).toBe("inProgress");
  });

  it("only auto-blocks in-progress overdue work packages", () => {
    const review = workPackageFixture({
      status: "review",
      dueDate: "2026-05-10T00:00:00.000Z",
      percentComplete: 5
    });
    const running = workPackageFixture({
      status: "inProgress",
      dueDate: "2026-05-10T00:00:00.000Z",
      percentComplete: 80
    });

    expect(applyAutomatedWorkPackageState(review, now).status).toBe("review");
    expect(applyAutomatedWorkPackageState(running, now).status).toBe("blocked");
  });
});

function workPackageFixture(overrides: Partial<WorkPackage>): WorkPackage {
  return {
    id: 1,
    projectId: "project-a",
    type: "task",
    subject: "工作项",
    description: "",
    status: "todo",
    priority: "P1",
    origin: "manager",
    createdByUserId: "user-1",
    percentComplete: 0,
    lastProgressNote: "",
    dependencies: [],
    delayDays: 0,
    ...overrides
  };
}
