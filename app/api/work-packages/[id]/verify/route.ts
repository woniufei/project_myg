import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { verify } from "@/lib/services/verification-workflow";

/**
 * POST /api/work-packages/[id]/verify
 *
 * 团队负责人核对通过工作项完成情况。
 * 请求体：{}（空对象即可）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const { id } = await params;
    const workPackageId = Number(id);

    if (Number.isNaN(workPackageId)) {
      return NextResponse.json({ error: "无效的工作项 ID。" }, { status: 400 });
    }

    const workPackage = await verify(workPackageId, user);

    return NextResponse.json({ workPackage });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}