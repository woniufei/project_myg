import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { updateUserRoles } from "@/lib/services/user-roles";
import type { PlatformRole } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/users/[id]/roles
 * 更新用户角色。当前平台按单用户单角色运行。
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();
    const newRoles = body.roles as PlatformRole[];

    if (!Array.isArray(newRoles) || newRoles.length !== 1) {
      return NextResponse.json(
        { error: "roles 必须包含且只能包含一个角色。" },
        { status: 400 }
      );
    }

    const validRoles: PlatformRole[] = ["admin", "projectManager", "teamLead", "participant"];
    for (const r of newRoles) {
      if (!validRoles.includes(r)) {
        return NextResponse.json(
          { error: `无效角色: ${r}` },
          { status: 400 }
        );
      }
    }

    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json(
        { error: "未登录。" },
        { status: 401 }
      );
    }

    await updateUserRoles(id, newRoles, currentUser);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json(
      { error: err.message ?? "服务器错误。" },
      { status }
    );
  }
}