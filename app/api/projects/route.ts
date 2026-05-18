import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  createProject,
  type ProjectCreateInput
} from "@/lib/services/project-workflow";
import { recordProjectStateSnapshot } from "@/lib/services/big-screen-plan";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";

/**
 * GET returns the visible projects for the current user.
 * POST creates a new project.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const { snapshot } = await loadWorkspaceSnapshot({ userId });
    return NextResponse.json({ projects: snapshot.projects });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as Partial<ProjectCreateInput>;

    if (!body.identifier || !body.name || !Array.isArray(body.enabledModules) || !Array.isArray(body.phases)) {
      return NextResponse.json(
        { error: "缺少必填字段：identifier、name、enabledModules、phases。" },
        { status: 400 }
      );
    }

    const project = await createProject(
      {
        identifier: body.identifier,
        name: body.name,
        description: body.description,
        parentId: body.parentId || undefined,
        status: body.status,
        health: body.health,
        initialDifficulty: body.initialDifficulty,
        enabledModules: body.enabledModules,
        phases: body.phases
      },
      user
    );

    await recordProjectStateSnapshot({
      projectId: project.id,
      user,
      triggerType: "TASK_PROGRESS_UPDATED"
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
