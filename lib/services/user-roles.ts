import { prisma } from "@/lib/prisma";
import { mapUser, type StoredUser } from "@/lib/repositories/workspace-mappers";
import { assertCapability } from "./permission-workflow";
import { ServiceError } from "./auth-context";
import type { PlatformRole, User } from "@/lib/types";

/**
 * 将领域角色转换为 Prisma 枚举值（大写）
 */
function toStoredRole(role: PlatformRole): string {
  const lookup: Record<PlatformRole, string> = {
    admin: "ADMIN",
    projectManager: "PROJECT_MANAGER",
    teamLead: "TEAM_LEAD",
    participant: "PARTICIPANT"
  };
  return lookup[role];
}
/**
 * 更新用户角色。当前平台按单用户单角色运行，roles 字段仅保留兼容存储。
 */
export async function updateUserRoles(
  targetUserId: string,
  newRoles: PlatformRole[],
  caller: User
): Promise<void> {
  await assertCapability(caller, "manageUserRoles");

  if (newRoles.length !== 1) {
    throw new ServiceError("当前系统一个用户只能分配一个角色。", 400);
  }
  const newRole = newRoles[0];

  const targetUser = (await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { memberships: true }
  })) as StoredUser | null;

  if (!targetUser) {
    throw new ServiceError("用户不存在。", 404);
  }

  const mappedTarget = mapUser(targetUser);
  await assertCanManageTargetRoles(caller, mappedTarget, newRoles);

  // 禁止 admin 自我降级（避免平台最后一个 admin 误操作）
  if (targetUserId === caller.id && newRole !== "admin") {
    throw new ServiceError("不能移除自己的管理员角色。", 403);
  }

  await (prisma.user.update as any)({
    where: { id: targetUserId },
    data: {
      roles: JSON.stringify([newRole]),
      role: toStoredRole(newRole)
    }
  });
}

async function assertCanManageTargetRoles(
  caller: User,
  target: User,
  newRoles: PlatformRole[]
): Promise<void> {
  if (caller.role === "admin") {
    return;
  }

  if (newRoles[0] === "admin" || target.role === "admin") {
    throw new ServiceError("只有管理员可以授予或调整管理员角色。", 403);
  }

  if (caller.role === "projectManager") {
    const inManagedProject = target.participatingProjectIds.some((projectId) =>
      caller.managedProjectIds.includes(projectId)
    );
    if (inManagedProject) {
      return;
    }
  }

  if (caller.role === "teamLead") {
    const membership = await prisma.teamMembership.findFirst({
      where: {
        personId: target.personId,
        team: { leadId: caller.personId }
      }
    });
    if (membership) {
      return;
    }
  }

  throw new ServiceError("只能配置自己管辖范围内成员的角色。", 403);
}