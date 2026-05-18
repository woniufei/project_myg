import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, userHasRole } from "@/lib/rbac";
import { mapUser, type StoredUser } from "@/lib/repositories/workspace-mappers";
import type { PlatformRole, User, WorkspaceSnapshot } from "@/lib/types";

export interface AuthContext {
  user: User;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

/**
 * Builds a lightweight auth context for the MVP from the `x-user-id` header.
 * Replace this with a real session provider when SSO or account auth is added.
 */
export async function getAuthContextFromRequest(request: Request): Promise<AuthContext> {
  const userId = request.headers.get("x-user-id") ?? "u-pm";
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true, person: true }
  })) as StoredUser | null;

  if (!user) {
    throw new ServiceError("未找到当前用户，请提供有效的 x-user-id。", 401);
  }

  return { user: mapUser(user) };
}

export function assertPermission(role: PlatformRole, permissionKey: string) {
  if (!can(role, permissionKey)) {
    throw new ServiceError("当前角色无权执行该操作。", 403);
  }
}

/**
 * Returns whether the user may access the given project via membership.
 */
export function canAccessProject(user: User, projectId: string): boolean {
  if (userHasRole(user, "admin")) {
    return true;
  }

  return [...user.managedProjectIds, ...user.participatingProjectIds].includes(projectId);
}

/**
 * Prefers membership state from a freshly loaded workspace snapshot so callers
 * are not blocked by stale project lists on the request-scoped user DTO.
 */
export function resolveUserFromSnapshot(snapshot: WorkspaceSnapshot, user: User): User {
  return snapshot.users.find((item) => item.id === user.id) ?? user;
}

export function assertProjectVisible(user: User, projectId: string) {
  if (!canAccessProject(user, projectId)) {
    throw new ServiceError("当前用户无权访问该项目。", 403);
  }
}

/**
 * Maps Prisma unique-constraint failures to API-friendly messages.
 */
function prismaErrorMessage(error: Prisma.PrismaClientKnownRequestError): string | null {
  if (error.code !== "P2002") {
    return null;
  }

  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
  if (fields.some((field) => field.includes("identifier"))) {
    return "项目标识符已被占用，请更换后重试。";
  }

  return null;
}

export function toErrorResponse(error: unknown): { body: { error: string }; status: number } {
  if (error instanceof ServiceError) {
    return { body: { error: error.message }, status: error.status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = prismaErrorMessage(error);
    if (message) {
      return { body: { error: message }, status: 409 };
    }
  }

  return {
    body: { error: error instanceof Error ? error.message : "服务端处理失败。" },
    status: 500
  };
}
