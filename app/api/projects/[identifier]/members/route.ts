import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { addProjectMember } from "@/lib/services/project-workflow";

interface RouteContext {
  params: Promise<{ identifier: string }>;
}

/**
 * Adds a user to the project membership list.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { identifier } = await context.params;
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      isLead?: boolean;
    };

    if (!body.userId) {
      return NextResponse.json({ error: "缺少必填字段：userId。" }, { status: 400 });
    }

    await addProjectMember(identifier, body.userId, { isLead: body.isLead }, user);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
