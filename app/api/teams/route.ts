import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { listTeams, createTeam } from "@/lib/services/team-workflow";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams
 * 获取所有团队列表
 */
export async function GET() {
  try {
    const teams = await listTeams();
    return NextResponse.json(teams);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "服务器错误。" },
      { status: err.status ?? 500 }
    );
  }
}

/**
 * POST /api/teams
 * 创建新团队（admin 用）
 */
export async function POST(request: Request) {
  try {
    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    const body = await request.json();
    const team = await createTeam(
      {
        name: body.name,
        description: body.description,
        leadId: body.leadId
      },
      currentUser
    );

    return NextResponse.json(team, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "服务器错误。" },
      { status: err.status ?? 500 }
    );
  }
}