import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  deleteProject,
  findProjectByIdentifier,
  updateProject,
  type ProjectUpdateInput
} from "@/lib/services/project-workflow";

interface RouteContext {
  params: Promise<{ identifier: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { identifier } = await context.params;
  const project = await findProjectByIdentifier(identifier);
  if (!project) {
    return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { identifier } = await context.params;
    const projectRow = await prisma.project.findUnique({ where: { identifier } });
    if (!projectRow) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }

    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as ProjectUpdateInput;
    const project = await updateProject(projectRow.id, body, user);

    return NextResponse.json({ project });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { identifier } = await context.params;
    const projectRow = await prisma.project.findUnique({ where: { identifier } });
    if (!projectRow) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }

    const { user } = await getAuthContextFromRequest(request);
    const project = await deleteProject(projectRow.id, user);

    return NextResponse.json({ project });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
