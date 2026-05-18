import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { rejectVerification } from "@/lib/services/verification-workflow";

/**
 * POST /api/work-packages/[id]/reject
 *
 * 团队负责人驳回工作项完成自报，并附上驳回原因。
 * 请求体：{ rejectedReason: string }
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

    const body = (await request.json().catch(() => ({}))) as { rejectedReason?: string };
    if (!body.rejectedReason?.trim()) {
      return NextResponse.json({ error: "驳回原因不能为空。" }, { status: 400 });
    }

    const workPackage = await rejectVerification(workPackageId, user, body.rejectedReason.trim());

    return NextResponse.json({ workPackage });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}