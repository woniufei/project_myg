import { NextResponse } from "next/server";
import { recordProjectStateSnapshot } from "@/lib/services/big-screen-plan";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { updateWorkPackage, type WorkPackageProgressInput } from "@/lib/services/work-package-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Member-focused progress endpoint. It writes a progress event, updates the
 * task item, then records a project state snapshot for later AI analysis.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "工作项 id 必须为数字。" }, { status: 400 });
    }

    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as WorkPackageProgressInput;
    const workPackage = await updateWorkPackage(numericId, body, user);
    if (workPackage.projectId) {
      await recordProjectStateSnapshot({
        projectId: workPackage.projectId,
        user,
        triggerType: progressTriggerFromBody(body, workPackage.percentComplete)
      });
    }

    return NextResponse.json({ workPackage });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

function progressTriggerFromBody(body: WorkPackageProgressInput, progress: number) {
  if (body.blockedResolvedAt) return "BLOCKED_RESOLVED";
  if (body.blockedStartedAt || body.blockedReason) return "BLOCKED_CHANGED";
  if (body.delayResolvedAt) return "DELAY_RESOLVED";
  if (body.delayStartedAt || body.delayReason) return "DELAY_CHANGED";
  if (progress >= 100) return "NODE_COMPLETED";
  return "TASK_PROGRESS_UPDATED";
}
