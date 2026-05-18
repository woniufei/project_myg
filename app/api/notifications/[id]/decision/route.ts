import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { addWorkPackageApproval } from "@/lib/services/work-package-workflow";
import { resolveDecisionNotifications } from "@/lib/services/notification-center";
import type { WorkPackageApprovalStatus } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Handles a decision notification. One authorized reviewer decision resolves
 * all notification rows tied to the same decision activity.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as {
      workPackageId?: number;
      decision?: Exclude<WorkPackageApprovalStatus, "pending">;
      comment?: string;
    };

    if (!body.workPackageId || !body.decision) {
      return NextResponse.json({ error: "缺少必填字段：workPackageId、decision。" }, { status: 400 });
    }

    const approval = await addWorkPackageApproval(
      body.workPackageId,
      {
        status: body.decision,
        comment: body.comment?.trim() || (body.decision === "approved" ? "同意推进" : "拒绝推进")
      },
      user
    );
    await resolveDecisionNotifications({
      messageId: id,
      decision: body.decision,
      approvalId: approval.id,
      decidedByUser: user
    });

    return NextResponse.json({ approval });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
