import { NextResponse } from "next/server";
import { assignLeadershipFromExternalPerson } from "@/lib/services/admin-role-workflow";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { PlatformRole } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Adds a project manager or team lead from Feishu-synced external person data.
 */
export async function POST(request: Request) {
  try {
    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      externalPersonId?: string;
      role?: PlatformRole;
      projectId?: string;
      teamId?: string;
    };

    if (!body.externalPersonId || (body.role !== "projectManager" && body.role !== "teamLead")) {
      return NextResponse.json(
        { error: "缺少必填字段：externalPersonId、role。" },
        { status: 400 }
      );
    }

    const assignment = await assignLeadershipFromExternalPerson(
      {
        externalPersonId: body.externalPersonId,
        role: body.role,
        projectId: body.projectId,
        teamId: body.teamId
      },
      currentUser
    );

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "服务器错误。" },
      { status: error.status ?? 500 }
    );
  }
}
