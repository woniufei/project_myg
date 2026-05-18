import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { markNotificationRead } from "@/lib/services/notification-center";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Marks one notification row as read for the current recipient.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user } = await getAuthContextFromRequest(request);
    await markNotificationRead(id, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
