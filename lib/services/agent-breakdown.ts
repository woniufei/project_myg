import { analyzeWithProvider } from "@/lib/agent/provider";
import { prisma } from "@/lib/prisma";
import { PERSONAL_PROJECT_ID } from "@/lib/project-constants";
import {
  mapWorkPackage,
  toStoredRiskLevel,
  toStoredWorkPackageType,
  type StoredWorkPackage
} from "@/lib/repositories/workspace-mappers";
import type { AgentAnalysis, AgentTaskDraft, User, WorkPackage } from "@/lib/types";
import { assertPermission, assertProjectVisible, ServiceError } from "./auth-context";

export interface AgentBreakdownDraftResult {
  draftId: string;
  analysis: AgentAnalysis;
}

export interface ConfirmAgentBreakdownResult {
  draftId: string;
  workPackages: WorkPackage[];
}

/**
 * Runs AI analysis as a draft and stores it for explicit PM confirmation.
 */
export async function createAgentBreakdownDraft(
  prompt: string,
  projectId: string | null,
  user: User
): Promise<AgentBreakdownDraftResult> {
  if (projectId) {
    assertPermission(user.role, "useAgentBreakdown");
    assertProjectVisible(user, projectId);
  } else {
    assertPermission(user.role, "usePersonalAgentBreakdown");
  }

  const analysis = await analyzeWithProvider(prompt);
  const draft = await prisma.agentBreakdownDraft.create({
    data: {
      projectId,
      createdByUserId: user.id,
      prompt,
      analysisJson: JSON.stringify(analysis),
      status: "PENDING"
    }
  });

  return { draftId: draft.id, analysis };
}

/**
 * Confirms an AI draft and turns suggestions into auditable WorkPackage rows.
 * Tasks land as `type=TASK`, risks as `type=RISK` with risk metadata copied.
 */
export async function confirmAgentBreakdownDraft(
  draftId: string,
  user: User,
  analysisOverride?: AgentAnalysis
): Promise<ConfirmAgentBreakdownResult> {
  const draft = await prisma.agentBreakdownDraft.findUnique({
    where: { id: draftId },
    include: { project: true }
  });
  if (!draft) {
    throw new ServiceError("AI 拆解草稿不存在。", 404);
  }
  if (draft.status !== "PENDING") {
    throw new ServiceError("AI 拆解草稿已处理，不能重复确认。", 409);
  }

  if (draft.projectId) {
    assertPermission(user.role, "useAgentBreakdown");
    assertProjectVisible(user, draft.projectId);
  } else {
    assertPermission(user.role, "usePersonalAgentBreakdown");
    if (draft.createdByUserId !== user.id && user.role !== "admin") {
      throw new ServiceError("只能确认本人创建的个人 AI 草稿。", 403);
    }
  }

  const analysis = analysisOverride ? validateAnalysis(analysisOverride) : parseAnalysis(draft.analysisJson);
  const people = await prisma.person.findMany({ orderBy: { id: "asc" } });
  const origin = draft.projectId ? "MANAGER" : "AI_SELF";

  const created: StoredWorkPackage[] = [];
  await prisma.$transaction(async (tx) => {
    for (const taskDraft of analysis.tasks) {
      const assigneeId = draft.projectId ? resolveAssigneeId(taskDraft, people) : user.personId;
      const wp = await tx.workPackage.create({
        data: {
          projectId: draft.projectId ?? PERSONAL_PROJECT_ID,
          origin,
          createdByUserId: user.id,
          assigneeId,
          subject: taskDraft.title,
          description: taskDraft.description,
          status: "todo",
          priority: taskDraft.priority,
          type: toStoredWorkPackageType(taskDraft.type),
          estimateHours: 8,
          percentComplete: 0,
          lastProgressNote: `由 AI 草稿 ${draft.id} 确认生成，等待负责人补充进展。`,
          dependencies: JSON.stringify([]),
          requiredSkills: JSON.stringify([taskDraft.assigneeRole])
        }
      });
      created.push(wp as StoredWorkPackage);
    }

    for (const riskDraft of analysis.risks) {
      const wp = await tx.workPackage.create({
        data: {
          projectId: draft.projectId ?? PERSONAL_PROJECT_ID,
          origin,
          createdByUserId: user.id,
          assigneeId: draft.projectId ? undefined : user.personId,
          subject: riskDraft.title,
          description: riskDraft.impact,
          status: "todo",
          priority: "P1",
          type: "RISK",
          percentComplete: 0,
          lastProgressNote: `由 AI 草稿 ${draft.id} 确认生成。`,
          dependencies: JSON.stringify([]),
          requiredSkills: JSON.stringify([]),
          riskLevel: toStoredRiskLevel(riskDraft.level),
          riskImpact: riskDraft.impact,
          riskMitigation: riskDraft.mitigation
        }
      });
      created.push(wp as StoredWorkPackage);
    }

    await tx.agentBreakdownDraft.update({
      where: { id: draft.id },
      data: {
        analysisJson: JSON.stringify(analysis),
        status: "CONFIRMED"
      }
    });
  });

  return {
    draftId,
    workPackages: created.map(mapWorkPackage)
  };
}

function parseAnalysis(value: string): AgentAnalysis {
  const parsed = JSON.parse(value) as AgentAnalysis;
  return validateAnalysis(parsed);
}

function validateAnalysis(parsed: AgentAnalysis): AgentAnalysis {
  if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.risks)) {
    throw new ServiceError("AI 拆解草稿结构无效。", 422);
  }

  return parsed;
}

function resolveAssigneeId(taskDraft: AgentTaskDraft, people: Array<{ id: string; role: string }>): string {
  const role = taskDraft.assigneeRole.toLowerCase();
  const assigneeId =
    people.find((person) => person.role.toLowerCase().includes(role))?.id ??
    people.find((person) => role.includes(person.role.toLowerCase()))?.id ??
    people[0]?.id;

  if (!assigneeId) {
    throw new ServiceError("缺少可分配工作项的项目成员。", 422);
  }

  return assigneeId;
}
