import { describe, expect, it } from "vitest";
import {
  mapNotificationRule,
  mapPerson,
  mapProject,
  mapUser,
  mapWorkPackage,
  mapWorkPackageApproval,
  mapWorkPackageComment,
  toStoredWorkPackageApprovalStatus,
  toStoredWorkPackageCommentSource,
  toStoredWorkPackageOrigin,
  toStoredWorkPackageType
} from "@/lib/repositories/workspace-mappers";

describe("workspace repository mappers", () => {
  it("maps membership rows into platform user scopes", () => {
    const user = mapUser({
      id: "u-pm",
      name: "项目经理",
      role: "PROJECT_MANAGER",
      roles: '["PROJECT_MANAGER"]',
      personId: "p1",
      memberships: [
        { projectId: "proj-a", isLead: true },
        { projectId: "proj-b", isLead: false }
      ]
    });

    expect(user.role).toBe("projectManager");
    expect(user.managedProjectIds).toEqual(["proj-a"]);
    expect(user.participatingProjectIds).toEqual(["proj-a", "proj-b"]);
  });

  it("maps project rows including hierarchy and enabled modules", () => {
    const project = mapProject({
      id: "proj-ai-pm",
      identifier: "ai-pm",
      name: "AI 项目管理平台",
      description: "demo",
      parentId: "proj-platform",
      status: "ACTIVE",
      health: "MEDIUM",
      progress: 42,
      startDate: null,
      endDate: null,
      enabledModules: JSON.stringify(["overview", "work_packages", "boards", "unknown_module"])
    });

    expect(project.identifier).toBe("ai-pm");
    expect(project.parentId).toBe("proj-platform");
    expect(project.status).toBe("active");
    expect(project.health).toBe("Medium");
    expect(project.enabledModules).toEqual(["overview", "work_packages", "boards"]);
  });

  it("maps work-package enums and JSON fields into the workspace contract", () => {
    const wp = mapWorkPackage({
      id: 2,
      projectId: "proj-ai-pm",
      type: "TASK",
      subject: "实现对话式任务拆解",
      description: "生成草稿",
      status: "inProgress",
      priority: "P0",
      origin: "MANAGER",
      createdByUserId: "u-pm",
      assigneeId: "p3",
      parentId: null,
      startDate: null,
      dueDate: new Date("2026-05-05T00:00:00.000Z"),
      estimateHours: 14,
      percentComplete: 65,
      lastProgressNote: "等待确认",
      dependencies: JSON.stringify([1]),
      requiredSkills: JSON.stringify(["接口设计"]),
      isOnCriticalPath: false,
      riskLevel: null,
      riskImpact: null,
      riskMitigation: null,
      updatedAt: new Date("2026-04-29T00:00:00.000Z")
    });

    expect(wp.type).toBe("task");
    expect(wp.priority).toBe("P0");
    expect(wp.origin).toBe("manager");
    expect(wp.createdByUserId).toBe("u-pm");
    expect(wp.dependencies).toEqual([1]);
    expect(wp.requiredSkills).toEqual(["接口设计"]);
    expect(wp.lastUpdatedAt).toBe("2026-04-29T00:00:00.000Z");
  });

  it("maps risk WorkPackages with risk metadata", () => {
    const wp = mapWorkPackage({
      id: 5,
      projectId: "proj-ai-pm",
      type: "RISK",
      subject: "部署凭据未配置",
      description: "无法完成真实部署",
      status: "open",
      priority: "P1",
      origin: "MANAGER",
      createdByUserId: "u-pm",
      assigneeId: "p4",
      parentId: null,
      startDate: null,
      dueDate: null,
      estimateHours: null,
      percentComplete: 0,
      lastProgressNote: "等待 SSH",
      dependencies: JSON.stringify([]),
      requiredSkills: JSON.stringify([]),
      isOnCriticalPath: false,
      riskLevel: "MEDIUM",
      riskImpact: "无法完成真实部署",
      riskMitigation: "GitHub Secrets",
      updatedAt: new Date("2026-04-29T00:00:00.000Z")
    });

    expect(wp.type).toBe("risk");
    expect(wp.riskLevel).toBe("Medium");
    expect(wp.riskImpact).toContain("部署");
  });

  it("maps collaboration and notification records into auditable DTOs", () => {
    const person = mapPerson({
      id: "p2",
      name: "前端开发",
      role: "Frontend",
      capacity: 36,
      skills: JSON.stringify(["看板设计"])
    });
    const comment = mapWorkPackageComment({
      id: "wpc-im-1",
      workPackageId: 3,
      authorPersonId: "p2",
      body: "补充证据",
      type: "EVIDENCE",
      mentionsPersonIds: JSON.stringify(["p1"]),
      source: "FEISHU",
      sourceChannelId: "ch-feishu-core",
      externalMessageId: "om-1",
      externalThreadId: "thread-1",
      authorDisplayName: "前端开发",
      createdAt: new Date("2026-04-29T00:00:00.000Z")
    });
    const approval = mapWorkPackageApproval({
      id: "wpa-1",
      workPackageId: 3,
      reviewerPersonId: "p1",
      status: "CHANGES_REQUESTED",
      comment: "请补证据",
      createdAt: new Date("2026-04-29T00:00:00.000Z")
    });
    const rule = mapNotificationRule({
      id: "rule-risk",
      name: "风险预警",
      eventTypes: JSON.stringify(["risk"]),
      minLevel: "MEDIUM",
      audienceRoles: JSON.stringify(["admin", "projectManager"]),
      channels: [{ channelId: "ch-feishu-core" }]
    });

    expect(person.skills).toEqual(["看板设计"]);
    expect(comment.source).toBe("feishu");
    expect(comment.mentionsPersonIds).toEqual(["p1"]);
    expect(approval.status).toBe("changesRequested");
    expect(rule.channelIds).toEqual(["ch-feishu-core"]);
    expect(rule.minLevel).toBe("Medium");
  });

  it("maps workspace DTO enums back to database enum names", () => {
    expect(toStoredWorkPackageType("milestone")).toBe("MILESTONE");
    expect(toStoredWorkPackageOrigin("aiSelf")).toBe("AI_SELF");
    expect(toStoredWorkPackageApprovalStatus("changesRequested")).toBe("CHANGES_REQUESTED");
    expect(toStoredWorkPackageCommentSource("wecomBot")).toBe("WECOM_BOT");
  });
});