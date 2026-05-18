import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { updateTeam, deleteTeam } from "@/lib/services/team-workflow";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/teams/[id]
 * 更新团队（admin 用）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    const body = await request.json();
    const team = await updateTeam(
      id,
      {
        name: body.name,
        description: body.description,
        leadId: body.leadId,
        manualOverride: body.manualOverride
      },
      currentUser
    );

    return NextResponse.json(team);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "服务器错误。" },
      { status: err.status ?? 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]
 * 删除团队（admin 用）
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    await deleteTeam(id, currentUser);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "服务器错误。" },
      { status: err.status ?? 500 }
    );
  }
}