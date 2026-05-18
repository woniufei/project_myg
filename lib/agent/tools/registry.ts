import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mapProject, mapWorkPackage, type StoredProject, type StoredWorkPackage } from "@/lib/repositories/workspace-mappers";
import { buildStewardReport } from "@/lib/steward";
import { createAgentBreakdownDraft, confirmAgentBreakdownDraft } from "@/lib/services/agent-breakdown";
import { buildPlatformOverviewSnapshot } from "@/lib/services/platform-overview";
import { createProject, updateProject } from "@/lib/services/project-workflow";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";
import {
  addWorkPackageApproval,
  addWorkPackageComment,
  createWorkPackage,
  deleteWorkPackage,
  updateWorkPackage
} from "@/lib/services/work-package-workflow";
import type { AgentAnalysis, ProjectModule, WorkPackageType } from "@/lib/types";
import { defineTool, type AgentToolDefinition } from "./types";

const projectModules = z.array(
  z.enum(["overview", "work_packages", "boards", "gantt", "members", "ai_diagnosis", "ai_breakdown", "settings"])
);
const workPackageType = z.enum(["task", "milestone", "risk", "phase"]);
const priority = z.enum(["P0", "P1", "P2"]);
const difficulty = z.enum(["low", "medium", "high", "critical"]);
const projectPhaseInput = z.object({
  subject: z.string(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional()
});

const jsonOutput = z.unknown();
const workPackageOutput = z.object({
  workPackageId: z.number(),
  projectId: z.string().nullable().optional(),
  subject: z.string(),
  status: z.string()
});

export const agentTools = [
  defineTool({
    name: "project.list",
    description: "列出当前调用者可见项目。适用：AI 需要了解项目范围。",
    inputSchema: z.object({}),
    outputSchema: jsonOutput,
    requiredPermissions: ["overview"],
    writeLevel: "read",
    handler: async (_input, ctx) => {
      const { snapshot } = await loadWorkspaceSnapshot({ userId: ctx.user.id });
      return { projects: snapshot.projects };
    }
  }),
  defineTool({
    name: "project.get",
    description: "按 id 或 identifier 获取项目详情。",
    inputSchema: z.object({ id: z.string().optional(), identifier: z.string().optional() }),
    outputSchema: jsonOutput,
    requiredPermissions: ["overview"],
    writeLevel: "read",
    handler: async (input, ctx) => {
      const { snapshot } = await loadWorkspaceSnapshot({ userId: ctx.user.id });
      const project = snapshot.projects.find((item) => item.id === input.id || item.identifier === input.identifier);
      return { project: project ?? null };
    }
  }),
  defineTool({
    name: "project.create",
    description: "新建项目，可选父项目与模块开关。",
    inputSchema: z.object({
      identifier: z.string(),
      name: z.string(),
      description: z.string().optional(),
      parentId: z.string().optional(),
      initialDifficulty: difficulty.optional(),
      enabledModules: projectModules.default(["overview", "work_packages", "members", "settings"]),
      phases: z.array(projectPhaseInput).min(1)
    }),
    outputSchema: jsonOutput,
    requiredPermissions: ["manageProjects"],
    writeLevel: "write",
    handler: async (input, ctx) => ({
      project: await createProject(
        { ...input, enabledModules: input.enabledModules as ProjectModule[] },
        ctx.user
      )
    })
  }),
  defineTool({
    name: "project.update",
    description: "更新项目元数据、状态、健康度或模块开关。",
    inputSchema: z.object({
      projectId: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      difficultyOverride: difficulty.nullable().optional(),
      enabledModules: projectModules.optional()
    }),
    outputSchema: jsonOutput,
    requiredPermissions: ["manageProjects"],
    writeLevel: "write",
    handler: async (input, ctx) => ({
      project: await updateProject(input.projectId, { ...input, enabledModules: input.enabledModules as ProjectModule[] | undefined }, ctx.user)
    })
  }),
  defineTool({
    name: "project.archive",
    description: "归档项目。危险操作，需要 confirm=true。",
    inputSchema: z.object({ projectId: z.string() }),
    outputSchema: jsonOutput,
    requiredPermissions: ["manageProjects"],
    writeLevel: "dangerous",
    handler: async (input, ctx) => {
      const project = await updateProject(input.projectId, { status: "archived" }, ctx.user);
      return { project };
    }
  }),
  defineTool({
    name: "workPackage.list",
    description: "列出可见工作项，支持项目、负责人、状态和搜索词过滤。",
    inputSchema: z.object({
      projectId: z.string().optional(),
      assigneeId: z.string().optional(),
      status: z.string().optional(),
      query: z.string().optional()
    }),
    outputSchema: jsonOutput,
    requiredPermissions: ["overview"],
    writeLevel: "read",
    handler: async (input, ctx) => {
      const { snapshot } = await loadWorkspaceSnapshot({ userId: ctx.user.id });
      const workPackages = snapshot.workPackages.filter((wp) => {
        if (input.projectId && wp.projectId !== input.projectId) return false;
        if (input.assigneeId && wp.assigneeId !== input.assigneeId) return false;
        if (input.status && wp.status !== input.status) return false;
        if (input.query && !`${wp.subject} ${wp.description}`.toLowerCase().includes(input.query.toLowerCase())) return false;
        return true;
      });
      return { workPackages };
    }
  }),
  defineTool({
    name: "workPackage.get",
    description: "获取单个工作项详情。",
    inputSchema: z.object({ id: z.number().int() }),
    outputSchema: jsonOutput,
    requiredPermissions: ["overview"],
    writeLevel: "read",
    handler: async (input) => {
      const row = await prisma.workPackage.findUnique({ where: { id: input.id } });
      return { workPackage: row ? mapWorkPackage(row as StoredWorkPackage) : null };
    }
  }),
  defineTool({
    name: "workPackage.create",
    description: "在指定项目下创建工作项。",
    inputSchema: z.object({
      projectId: z.string(),
      type: workPackageType.default("task"),
      subject: z.string(),
      description: z.string().optional(),
      priority: priority.optional(),
      difficulty: difficulty.optional(),
      assigneeId: z.string().optional(),
      dueDate: z.string().optional(),
      parentId: z.number().int().optional()
    }),
    outputSchema: workPackageOutput,
    requiredPermissions: ["assignWorkPackages"],
    writeLevel: "write",
    handler: async (input, ctx) => toWorkPackageOutput(await createWorkPackage(input, ctx.user))
  }),
  defineTool({
    name: "workPackage.update",
    description: "更新工作项进度、状态或字段。",
    inputSchema: z.object({
      id: z.number().int(),
      status: z.string().optional(),
      percentComplete: z.number().optional(),
      lastProgressNote: z.string().optional(),
      subject: z.string().optional(),
      description: z.string().optional(),
      difficulty: difficulty.optional(),
      assigneeId: z.string().optional()
    }),
    outputSchema: workPackageOutput,
    requiredPermissions: ["updateOwnWorkPackages"],
    writeLevel: "write",
    handler: async (input, ctx) => {
      const { id, ...patch } = input;
      return toWorkPackageOutput(
        await updateWorkPackage(id, patch as Parameters<typeof updateWorkPackage>[1], ctx.user)
      );
    }
  }),
  defineTool({
    name: "workPackage.delete",
    description: "按创建者或管理员规则删除工作项。危险操作，需要 confirm=true。",
    inputSchema: z.object({ id: z.number().int() }),
    outputSchema: workPackageOutput,
    requiredPermissions: ["deleteOwnWorkPackage"],
    writeLevel: "dangerous",
    handler: async (input, ctx) => toWorkPackageOutput(await deleteWorkPackage(input.id, ctx.user))
  }),
  defineTool({
    name: "workPackage.addComment",
    description: "给工作项添加评论、决策、阻塞或证据。",
    inputSchema: z.object({
      id: z.number().int(),
      body: z.string(),
      type: z.enum(["comment", "decision", "blocker", "evidence"]).default("comment")
    }),
    outputSchema: jsonOutput,
    requiredPermissions: ["updateOwnWorkPackages"],
    writeLevel: "write",
    handler: async (input, ctx) => ({ comment: await addWorkPackageComment(input.id, input, ctx.user) })
  }),
  defineTool({
    name: "workPackage.approve",
    description: "对工作项执行签核。",
    inputSchema: z.object({
      id: z.number().int(),
      status: z.enum(["approved", "changesRequested"]),
      comment: z.string()
    }),
    outputSchema: jsonOutput,
    requiredPermissions: ["approveWorkPackages"],
    writeLevel: "write",
    handler: async (input, ctx) => ({ approval: await addWorkPackageApproval(input.id, input, ctx.user) })
  }),
  defineTool({
    name: "personalWorkPackage.create",
    description: "创建个人事项，projectId=null。",
    inputSchema: z.object({
      subject: z.string(),
      description: z.string().optional(),
      priority: priority.optional(),
      dueDate: z.string().optional()
    }),
    outputSchema: workPackageOutput,
    requiredPermissions: ["createPersonalWorkPackage"],
    writeLevel: "write",
    handler: async (input, ctx) => toWorkPackageOutput(await createWorkPackage({ ...input, projectId: null, type: "task", origin: "self" }, ctx.user))
  }),
  defineTool({
    name: "agent.breakdown.draft",
    description: "AI 拆解需求为候选工作项草稿。",
    inputSchema: z.object({ prompt: z.string(), projectId: z.string().nullable().optional() }),
    outputSchema: jsonOutput,
    requiredPermissions: ["usePersonalAgentBreakdown"],
    writeLevel: "write",
    handler: async (input, ctx) => createAgentBreakdownDraft(input.prompt, input.projectId ?? null, ctx.user)
  }),
  defineTool({
    name: "agent.breakdown.confirm",
    description: "确认 AI 草稿并批量写入工作项。危险操作，需要 confirm=true。",
    inputSchema: z.object({ draftId: z.string(), analysis: z.custom<AgentAnalysis>().optional() }),
    outputSchema: jsonOutput,
    requiredPermissions: ["usePersonalAgentBreakdown"],
    writeLevel: "dangerous",
    handler: async (input, ctx) => confirmAgentBreakdownDraft(input.draftId, ctx.user, input.analysis)
  }),
  defineTool({
    name: "steward.summary",
    description: "获取 AI 管家摘要。",
    inputSchema: z.object({ projectId: z.string().optional() }),
    outputSchema: jsonOutput,
    requiredPermissions: ["viewIntelligence"],
    writeLevel: "read",
    handler: async (input, ctx) => {
      const { snapshot } = await loadWorkspaceSnapshot({ userId: ctx.user.id, projectId: input.projectId });
      return buildStewardReport(snapshot);
    }
  }),
  defineTool({
    name: "overview.snapshot",
    description: "获取平台总览快照。",
    inputSchema: z.object({}),
    outputSchema: jsonOutput,
    requiredPermissions: ["viewPlatformOverview"],
    writeLevel: "read",
    handler: async (_input, ctx) => {
      const { snapshot } = await loadWorkspaceSnapshot({ userId: ctx.user.id });
      return buildPlatformOverviewSnapshot(snapshot, ctx.user);
    }
  })
] satisfies AgentToolDefinition[];

export function listTools() {
  return agentTools;
}

export function getTool(name: string) {
  return agentTools.find((tool) => tool.name === name);
}

export function serializeTool(tool: AgentToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    requiredPermissions: tool.requiredPermissions,
    writeLevel: tool.writeLevel,
    inputSchema: safeJsonSchema(tool.inputSchema),
    outputSchema: safeJsonSchema(tool.outputSchema)
  };
}

function safeJsonSchema(schema: z.ZodTypeAny) {
  try {
    return z.toJSONSchema(schema);
  } catch {
    return { type: "object", additionalProperties: true };
  }
}

function toWorkPackageOutput(workPackage: Awaited<ReturnType<typeof createWorkPackage>>) {
  return {
    workPackageId: workPackage.id,
    projectId: workPackage.projectId ?? null,
    subject: workPackage.subject,
    status: workPackage.status
  };
}
