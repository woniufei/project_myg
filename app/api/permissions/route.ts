import { NextResponse } from "next/server";
import {
  listPermissionOverrides,
  upsertPermissionOverride
} from "@/lib/services/permission-workflow";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { PermissionEffect, PermissionScopeType, PermissionSubjectType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Lists operation-level permission overrides visible to the current actor.
 */
export async function GET() {
  try {
    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    const overrides = await listPermissionOverrides(currentUser);
    return NextResponse.json({ overrides });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "服务器错误。" },
      { status: error.status ?? 500 }
    );
  }
}

/**
 * Creates or updates one operation-level permission override.
 */
export async function POST(request: Request) {
  try {
    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      subjectType?: PermissionSubjectType;
      subjectId?: string;
      permissionKey?: string;
      effect?: PermissionEffect;
      scopeType?: PermissionScopeType;
      scopeId?: string | null;
    };

    if (!body.subjectType || !body.subjectId || !body.permissionKey || !body.effect) {
      return NextResponse.json(
        { error: "缺少必填字段：subjectType、subjectId、permissionKey、effect。" },
        { status: 400 }
      );
    }

    const override = await upsertPermissionOverride(
      {
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        permissionKey: body.permissionKey,
        effect: body.effect,
        scopeType: body.scopeType,
        scopeId: body.scopeId
      },
      currentUser
    );
    return NextResponse.json({ override }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "服务器错误。" },
      { status: error.status ?? 500 }
    );
  }
}
