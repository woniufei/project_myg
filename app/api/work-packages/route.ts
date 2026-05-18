import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  createWorkPackage,
  type WorkPackageCreateInput
} from "@/lib/services/work-package-workflow";
import { recordProjectStateSnapshot } from "@/lib/services/big-screen-plan";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";
import type { Priority, WorkPackageStatus, WorkPackageType } from "@/lib/types";

/**
 * GET returns all work packages visible to the user. Optional query params
 * `?projectId=` and `?type=` narrow the result.
 *
 * POST creates a project work package or a personal item when `projectId` is null.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const type = url.searchParams.get("type") as WorkPackageType | null;
    const status = url.searchParams.get("status") as WorkPackageStatus | null;

    const { snapshot } = await loadWorkspaceSnapshot({ userId, projectId });
    const workPackages = snapshot.workPackages.filter((wp) => {
      if (type && wp.type !== type) return false;
      if (status && wp.status !== status) return false;
      return true;
    });

    return NextResponse.json({ workPackages });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as Partial<WorkPackageCreateInput> & {
      priority?: Priority;
    };

    if (!body.type || !body.subject) {
      return NextResponse.json(
        { error: "缺少必填字段：type、subject。" },
        { status: 400 }
      );
    }

    const workPackage = await createWorkPackage(
      {
        projectId: body.projectId ?? null,
        type: body.type,
        subject: body.subject,
        description: body.description,
        status: body.status,
        priority: body.priority,
        origin: body.origin,
        assigneeId: body.assigneeId,
        parentId: body.parentId,
        startDate: body.startDate,
        dueDate: body.dueDate,
        estimateHours: body.estimateHours,
        requiredSkills: body.requiredSkills,
        riskLevel: body.riskLevel,
        riskImpact: body.riskImpact,
        riskMitigation: body.riskMitigation,
        dependencies: body.dependencies,
        lastProgressNote: body.lastProgressNote,
        requirements: body.requirements,
        memberAssignments: body.memberAssignments,
        attachments: body.attachments
      },
      user
    );

    if (workPackage.projectId) {
      await recordProjectStateSnapshot({
        projectId: workPackage.projectId,
        user,
        triggerType: "TASK_PROGRESS_UPDATED"
      });
    }

    return NextResponse.json({ workPackage }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
