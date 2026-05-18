import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  listNotificationTemplates,
  saveNotificationTemplates,
  type NotificationTemplateInput
} from "@/lib/services/notification-center";

/**
 * Returns editable notification templates for the notification center.
 */
export async function GET() {
  try {
    const templates = await listNotificationTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

/**
 * Saves template copy and enablement flags. Template management is restricted
 * to roles with the manageNotifications capability.
 */
export async function PATCH(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as {
      templates?: NotificationTemplateInput[];
    };
    const templates = await saveNotificationTemplates(body.templates ?? [], user);
    return NextResponse.json({ templates });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
