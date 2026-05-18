import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredWorkPackage } from "@/lib/repositories/workspace-mappers";
import type { AgentAnalysis, User } from "@/lib/types";

const mocks = vi.hoisted(() => {
  const tx = {
    workPackage: { create: vi.fn() },
    agentBreakdownDraft: { update: vi.fn() }
  };

  return {
    prisma: {
      workPackage: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      workPackageProgressEvent: {
        create: vi.fn()
      },
      workPackageApproval: {
        create: vi.fn()
      },
      agentBreakdownDraft: {
        create: vi.fn(),
        findUnique: vi.fn()
      },
      person: { findMany: vi.fn() },
      $transaction: vi.fn()
    },
    tx,
    analyzeWithProvider: vi.fn()
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/agent/provider", () => ({ analyzeWithProvider: mocks.analyzeWithProvider }));

const participant: User = {
  id: "u-member",
  name: "项目参与员",
  role: "participant",
  personId: "p2",
  managedProjectIds: [],
  participatingProjectIds: ["proj-ai-pm"]
};

const teamLead: User = {
  id: "u-lead",
  name: "团队负责人",
  role: "teamLead",
  personId: "p-lead",
  managedProjectIds: [],
  participatingProjectIds: ["proj-ai-pm"]
};

const personalAnalysis: AgentAnalysis = {
  productDefinition: "个人事项拆解",
  tasks: [
    {
      title: "整理个人待办",
      description: "把本周事项拆成可执行清单",
      priority: "P1",
      assigneeRole: "Frontend",
      milestone: "个人计划",
      type: "task"
    }
  ],
  risks: [
    {
      title: "时间被会议打断",
      level: "Low",
      impact: "个人事项可能延期",
      mitigation: "预留专注时段"
    }
  ],
  progressReport: "已拆解",
  nextActions: ["确认写入"]
};

type WorkPackageCreateMockArgs = {
  data: Partial<StoredWorkPackage> & {
    status?: string;
    priority?: string;
    riskLevel?: string | null;
    riskImpact?: string | null;
    riskMitigation?: string | null;
  };
};

type DraftCreateMockArgs = {
  data: Record<string, unknown>;
};

describe("personal work package foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof mocks.tx) => unknown) => callback(mocks.tx)
    );
    mocks.prisma.person.findMany.mockResolvedValue([]);
    mocks.analyzeWithProvider.mockResolvedValue(personalAnalysis);
  });

  it("creates personal work packages with creator and SELF origin", async () => {
    const { createWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.create.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        ...data,
        id: 9,
        projectId: "personProject",
        type: "TASK",
        status: "todo",
        priority: "P1",
        percentComplete: 0,
        riskLevel: null,
        riskImpact: null,
        riskMitigation: null
      })
    );

    const workPackage = await createWorkPackage(
      { projectId: null, type: "task", subject: "记录个人事项" },
      participant
    );

    expect(mocks.prisma.workPackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "personProject",
          origin: "SELF",
          createdByUserId: "u-member",
          assigneeId: "p2"
        })
      })
    );
    expect(workPackage.projectId).toBeUndefined();
    expect(workPackage.origin).toBe("self");
  });

  it("allows creators to delete personal work packages", async () => {
    const { deleteWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 8,
        projectId: null,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: "p2"
      })
    );

    await expect(deleteWorkPackage(8, participant)).resolves.toMatchObject({
      id: 8,
      origin: "self",
      createdByUserId: "u-member"
    });
    expect(mocks.prisma.workPackage.delete).toHaveBeenCalledWith({ where: { id: 8 } });
  });

  it("blocks assignees from deleting manager-created work packages", async () => {
    const { deleteWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 3,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2"
      })
    );

    await expect(deleteWorkPackage(3, participant)).rejects.toMatchObject({
      status: 403
    });
    expect(mocks.prisma.workPackage.delete).not.toHaveBeenCalled();
  });

  it("allows participant creators to attach personal work packages to visible projects", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 8,
        projectId: null,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: null
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 8,
        projectId: data.projectId as string,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: null
      })
    );

    await expect(updateWorkPackage(8, { projectId: "proj-ai-pm" }, participant)).resolves.toMatchObject({
      id: 8,
      projectId: "proj-ai-pm"
    });
    expect(mocks.prisma.workPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8 },
        data: expect.objectContaining({
          projectId: "proj-ai-pm"
        })
      })
    );
  });

  it("records a progress event when an assignee updates task progress", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 3,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2",
        status: "inProgress",
        percentComplete: 20
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 3,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2",
        percentComplete: data.percentComplete as number,
        status: data.status
      })
    );

    await updateWorkPackage(3, { percentComplete: 70, lastProgressNote: "推进到联调" }, participant);

    expect(mocks.prisma.workPackageProgressEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workPackageId: 3,
          eventType: "PROGRESS_UPDATED",
          userId: "u-member",
          reason: "推进到联调"
        })
      })
    );
  });

  it("allows participant creators to update in-progress work packages from My Work", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 12,
        projectId: null,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: null,
        status: "inProgress",
        percentComplete: 30
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 12,
        projectId: null,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: null,
        percentComplete: data.percentComplete as number,
        status: data.status
      })
    );

    await expect(updateWorkPackage(12, { percentComplete: 60 }, participant)).resolves.toMatchObject({
      id: 12,
      percentComplete: 60
    });
    expect(mocks.prisma.workPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12 },
        data: expect.objectContaining({
          percentComplete: 60
        })
      })
    );
  });

  it("allows participant progress updates on recovered in-progress work packages", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 21,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2",
        status: "inProgress",
        percentComplete: 35,
        dueDate: new Date("2026-05-10T00:00:00.000Z"),
        blockedStartedAt: new Date("2026-05-08T00:00:00.000Z"),
        blockedResolvedAt: new Date("2026-05-15T00:00:00.000Z"),
        delayDays: 3,
        delayStartedAt: new Date("2026-05-10T00:00:00.000Z"),
        delayResolvedAt: new Date("2026-05-15T00:00:00.000Z")
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 21,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2",
        dueDate: new Date("2026-05-10T00:00:00.000Z"),
        percentComplete: data.percentComplete as number,
        status: data.status,
        blockedStartedAt: new Date("2026-05-08T00:00:00.000Z"),
        blockedResolvedAt: new Date("2026-05-15T00:00:00.000Z"),
        delayDays: 3,
        delayStartedAt: new Date("2026-05-10T00:00:00.000Z"),
        delayResolvedAt: new Date("2026-05-15T00:00:00.000Z")
      })
    );

    await expect(updateWorkPackage(21, { percentComplete: 55 }, participant)).resolves.toMatchObject({
      id: 21,
      status: "inProgress",
      percentComplete: 55
    });
    expect(mocks.prisma.workPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 21 },
        data: expect.objectContaining({
          percentComplete: 55,
          status: "inProgress"
        })
      })
    );
  });

  it("allows participant progress-only updates before a work package is in progress", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 4,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2",
        status: "review",
        percentComplete: 5
      })
    );

    await expect(updateWorkPackage(4, { percentComplete: 20 }, participant)).resolves.toMatchObject({
      percentComplete: 20
    });
    expect(mocks.prisma.workPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          percentComplete: 20
        })
      })
    );
  });

  it("raises review and in-progress milestones to their automated progress floors", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 5,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-lead",
        assigneeId: "p-lead",
        status: "todo",
        percentComplete: 0
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 5,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-lead",
        assigneeId: "p-lead",
        status: data.status,
        percentComplete: data.percentComplete as number
      })
    );

    await expect(updateWorkPackage(5, { status: "review" }, teamLead)).resolves.toMatchObject({
      status: "review",
      percentComplete: 5
    });

    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 5,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-lead",
        assigneeId: "p-lead",
        status: "review",
        percentComplete: 5
      })
    );

    await expect(updateWorkPackage(5, { status: "inProgress" }, teamLead)).resolves.toMatchObject({
      status: "inProgress",
      percentComplete: 10
    });
  });

  it("does not auto-block overdue review work packages", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 7,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-lead",
        assigneeId: "p-lead",
        status: "review",
        percentComplete: 5,
        dueDate: new Date("2026-05-01T00:00:00.000Z")
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 7,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-lead",
        assigneeId: "p-lead",
        status: data.status,
        percentComplete: data.percentComplete as number,
        dueDate: new Date("2026-05-01T00:00:00.000Z")
      })
    );

    await expect(updateWorkPackage(7, { status: "review" }, teamLead)).resolves.toMatchObject({
      status: "review",
      percentComplete: 5
    });
  });

  it("moves approved and requested-change reviews into automated workflow states", async () => {
    const { addWorkPackageApproval } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 6,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-lead",
        assigneeId: "p-lead",
        status: "review",
        percentComplete: 5
      })
    );
    mocks.prisma.workPackageApproval.create.mockResolvedValue({
      id: "approval-1",
      workPackageId: 6,
      reviewerPersonId: "p-lead",
      status: "CHANGES_REQUESTED",
      comment: "补充需求项",
      createdAt: new Date("2026-05-01T00:00:00.000Z")
    });

    await addWorkPackageApproval(6, { status: "changesRequested", comment: "补充需求项" }, {
      ...teamLead,
      role: "projectManager",
      managedProjectIds: ["proj-ai-pm"]
    });

    expect(mocks.prisma.workPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 6 },
        data: { status: "review", percentComplete: 5 }
      })
    );
  });

  it("stores personal AI drafts with nullable project id", async () => {
    const { createAgentBreakdownDraft } = await import("@/lib/services/agent-breakdown");
    mocks.prisma.agentBreakdownDraft.create.mockImplementation(async ({ data }: DraftCreateMockArgs) => ({
      id: "draft-personal",
      ...data
    }));

    const result = await createAgentBreakdownDraft("帮我拆解个人待办", null, participant);

    expect(result.draftId).toBe("draft-personal");
    expect(mocks.prisma.agentBreakdownDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: null,
          createdByUserId: "u-member"
        })
      })
    );
  });

  it("confirms personal AI drafts into AI_SELF work packages", async () => {
    const { confirmAgentBreakdownDraft } = await import("@/lib/services/agent-breakdown");
    let nextId = 20;
    mocks.prisma.agentBreakdownDraft.findUnique.mockResolvedValue({
      id: "draft-personal",
      projectId: null,
      createdByUserId: "u-member",
      prompt: "帮我拆解个人待办",
      analysisJson: JSON.stringify(personalAnalysis),
      status: "PENDING"
    });
    mocks.tx.workPackage.create.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        ...data,
        id: nextId++,
        projectId: "personProject",
        status: data.status,
        priority: data.priority,
        riskLevel: data.riskLevel ?? null,
        riskImpact: data.riskImpact ?? null,
        riskMitigation: data.riskMitigation ?? null
      })
    );

    const result = await confirmAgentBreakdownDraft("draft-personal", participant);

    expect(result.workPackages).toHaveLength(2);
    expect(mocks.tx.workPackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "personProject",
          origin: "AI_SELF",
          createdByUserId: "u-member",
          assigneeId: "p2"
        })
      })
    );
    expect(result.workPackages.every((wp) => wp.origin === "aiSelf")).toBe(true);
  });
});

function storedWorkPackage(overrides: Partial<StoredWorkPackage>): StoredWorkPackage {
  return {
    id: 1,
    projectId: "proj-ai-pm",
    type: "TASK",
    subject: "工作项",
    description: "",
    status: "todo",
    priority: "P1",
    origin: "MANAGER",
    createdByUserId: "u-pm",
    assigneeId: null,
    parentId: null,
    startDate: null,
    dueDate: null,
    estimateHours: null,
    percentComplete: 0,
    lastProgressNote: "",
    dependencies: "[]",
    requiredSkills: "[]",
    riskLevel: null,
    riskImpact: null,
    isOnCriticalPath: false,
    riskMitigation: null,
    updatedAt: new Date("2026-04-29T00:00:00.000Z"),
    ...overrides
  };
}
