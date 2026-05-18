import { NextResponse } from "next/server";
import { deletePermissionOverride } from "@/lib/services/permission-workflow";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Deletes one operation-level permission override.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentUser } = await getShellRequestContext();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录。" }, { status: 401 });
    }

    await deletePermissionOverride(id, currentUser);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "服务器错误。" },
      { status: error.status ?? 500 }
    );
  }
}
