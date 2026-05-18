import { prisma } from "@/lib/prisma";
import { canUser, userHasRole } from "@/lib/rbac";
import {
  mapPermissionOverride,
  toStoredPermissionEffect,
  toStoredPermissionScopeType,
  toStoredPermissionSubjectType,
  type StoredPermissionOverride
} from "@/lib/repositories/workspace-mappers";
import type {
  PermissionEffect,
  PermissionOverride,
  PermissionScopeType,
  PermissionSubjectType,
  User
} from "@/lib/types";
import { ServiceError } from "./auth-context";

const GLOBAL_SCOPE_ID = "__global__";

export interface PermissionScope {
  type: PermissionScopeType;
  id?: string;
}

export interface PermissionOverrideInput {
  subjectType: PermissionSubjectType;
  subjectId: string;
  permissionKey: string;
  effect: PermissionEffect;
  scopeType?: PermissionScopeType;
  scopeId?: string | null;
}

/**
 * Resolves an operation permission from role defaults plus persisted user/team overrides.
 * User-specific overrides win over team overrides; scoped overrides win over global ones.
 */
export async function resolveUserPermission(
  user: User,
  permissionKey: string,
  scope?: PermissionScope
): Promise<boolean> {
  const roleAllowed = canUser(user, permissionKey);
  if (!prisma.permissionOverride?.findMany) {
    return roleAllowed;
  }
  const teamIds = await getTeamIdsForPerson(user.personId);
  const overrides = await prisma.permissionOverride.findMany({
    where: {
      permissionKey,
      OR: [
        { subjectType: "USER", subjectId: user.id },
        ...(teamIds.length > 0
          ? [{ subjectType: "TEAM", subjectId: { in: teamIds } }]
          : [])
      ]
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  const matched = (overrides as StoredPermissionOverride[])
    .map(mapPermissionOverride)
    .filter((item) => matchesScope(item, scope))
    .sort(compareOverrideSpecificity)[0];

  if (!matched) {
    return roleAllowed;
  }

  return matched.effect === "allow";
}

/**
 * Throws when the user cannot execute the requested operation.
 */
export async function assertCapability(
  user: User,
  permissionKey: string,
  scope?: PermissionScope
): Promise<void> {
  if (!(await resolveUserPermission(user, permissionKey, scope))) {
    throw new ServiceError("当前用户无权执行该操作。", 403);
  }
}

/**
 * Lists all permission overrides visible to a configuration actor.
 */
export async function listPermissionOverrides(actor: User): Promise<PermissionOverride[]> {
  if (userHasRole(actor, "admin")) {
    const items = await prisma.permissionOverride.findMany({ orderBy: { updatedAt: "desc" } });
    return (items as StoredPermissionOverride[]).map(mapPermissionOverride);
  }

  return [];
}

/**
 * Upserts one operation-level permission override after checking the actor's management scope.
 */
export async function upsertPermissionOverride(
  input: PermissionOverrideInput,
  actor: User
): Promise<PermissionOverride> {
  const scopeType = input.scopeType ?? "global";
  const scopeId = scopeType === "global" ? GLOBAL_SCOPE_ID : input.scopeId ?? "";

  await assertCanManageOverride(actor, {
    ...input,
    scopeType,
    scopeId
  });

  const stored = await prisma.permissionOverride.upsert({
    where: {
      subjectType_subjectId_permissionKey_scopeType_scopeId: {
        subjectType: toStoredPermissionSubjectType(input.subjectType),
        subjectId: input.subjectId,
        permissionKey: input.permissionKey,
        scopeType: toStoredPermissionScopeType(scopeType),
        scopeId
      }
    },
    create: {
      subjectType: toStoredPermissionSubjectType(input.subjectType),
      subjectId: input.subjectId,
      permissionKey: input.permissionKey,
      effect: toStoredPermissionEffect(input.effect),
      scopeType: toStoredPermissionScopeType(scopeType),
      scopeId,
      createdByUserId: actor.id
    },
    update: {
      effect: toStoredPermissionEffect(input.effect),
      createdByUserId: actor.id
    }
  });

  return mapPermissionOverride(stored as StoredPermissionOverride);
}

/**
 * Removes an override after checking the actor's management scope.
 */
export async function deletePermissionOverride(id: string, actor: User): Promise<void> {
  const existing = await prisma.permissionOverride.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("权限覆盖不存在。", 404);
  }

  const mapped = mapPermissionOverride(existing as StoredPermissionOverride);
  await assertCanManageOverride(actor, mapped);
  await prisma.permissionOverride.delete({ where: { id } });
}

async function assertCanManageOverride(
  actor: User,
  _override: PermissionOverrideInput
): Promise<void> {
  if (!userHasRole(actor, "admin") || !canUser(actor, "managePermissions")) {
    throw new ServiceError("当前用户无权配置权限。", 403);
  }

  return;
}

async function getTeamIdsForPerson(personId: string): Promise<string[]> {
  if (!prisma.teamMembership?.findMany) {
    return [];
  }
  const memberships = await prisma.teamMembership.findMany({
    where: { personId },
    select: { teamId: true }
  });
  return memberships.map((item) => item.teamId);
}

function matchesScope(item: PermissionOverride, scope?: PermissionScope): boolean {
  if (item.scopeType === "global") {
    return true;
  }
  return Boolean(scope && item.scopeType === scope.type && item.scopeId === scope.id);
}

function compareOverrideSpecificity(left: PermissionOverride, right: PermissionOverride): number {
  const leftScore = specificityScore(left);
  const rightScore = specificityScore(right);
  return rightScore - leftScore;
}

function specificityScore(item: PermissionOverride): number {
  const subjectScore = item.subjectType === "user" ? 10 : 0;
  const scopeScore = item.scopeType === "global" ? 0 : 5;
  return subjectScore + scopeScore;
}
