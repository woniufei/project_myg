import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { addTeamMember, removeTeamMember } from "@/lib/services/team-workflow";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/teams/[id]/members
 * 添加团队成员（admin 用）
 */
export async function POST(
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
    await addTeamMember(id, body.personId, currentUser);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "服务器错误。" },
      { status: err.status ?? 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]/members
 * 移除团队成员（admin 用）
 */
export async function DELETE(
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
    await removeTeamMember(id, body.personId, currentUser);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "服务器错误。" },
      { status: err.status ?? 500 }
    );
  }
}