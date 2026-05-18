import { prisma } from "@/lib/prisma";
import { mapWorkPackage, toStoredVerificationStatus, type StoredWorkPackage } from "@/lib/repositories/workspace-mappers";
import { ServiceError } from "./auth-context";
import { assertCapability } from "./permission-workflow";
import type { User, WorkPackage, Person, Team } from "@/lib/types";

/**
 * 获取团队负责人工作台所需数据
 */
export async function getTeamLeadDashboard(
  user: User
): Promise<{
  team: Team | null;
  pendingVerification: WorkPackage[];
  rejectedWorkPackages: WorkPackage[];
  teamMemberWorkPackages: { person: Person; count: number }[];
}> {
  let team: Team | null = null;
  let teamMemberPersonIds: string[] = [];

  const storedTeam = await prisma.team.findFirst({
    where: { leadId: user.personId },
    include: {
      memberships: {
        include: { person: true }
      }
    }
  });
  if (storedTeam) {
    team = {
      id: storedTeam.id,
      name: storedTeam.name,
      description: storedTeam.description ?? undefined,
      leadId: storedTeam.leadId ?? undefined,
      manualOverride: storedTeam.manualOverride ?? undefined,
      externalId: storedTeam.externalId ?? undefined,
      syncedAt: storedTeam.syncedAt?.toISOString() ?? undefined,
      createdAt: storedTeam.createdAt.toISOString(),
      updatedAt: storedTeam.updatedAt.toISOString()
    };
    teamMemberPersonIds = Array.from(new Set([
      storedTeam.leadId,
      ...storedTeam.memberships.map(m => m.personId)
    ].filter((id): id is string => Boolean(id))));
  }

  // 没有团队则返回空数据
  if (!team || teamMemberPersonIds.length === 0) {
    return {
      team: null,
      pendingVerification: [],
      rejectedWorkPackages: [],
      teamMemberWorkPackages: []
    };
  }

  // 查询待核对的工作项（团队成员的 SELF_REPORTED_DONE）
  const pendingWps = await prisma.workPackage.findMany({
    where: {
      verificationStatus: "SELF_REPORTED_DONE",
      OR: [
        { assigneeId: { in: teamMemberPersonIds } },
        { assignments: { some: { personId: { in: teamMemberPersonIds } } } }
      ]
    },
    include: { assignments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  // 查询已被驳回的工作项（团队成员的 REJECTED）
  const rejectedWps = await prisma.workPackage.findMany({
    where: {
      verificationStatus: "REJECTED",
      OR: [
        { assigneeId: { in: teamMemberPersonIds } },
        { assignments: { some: { personId: { in: teamMemberPersonIds } } } }
      ]
    },
    include: { assignments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  // 查询团队成员的工作项负载
  const peopleResult = await prisma.person.findMany({
    where: { id: { in: teamMemberPersonIds } }
  });

  const personMap = new Map(peopleResult.map(p => [p.id, p]));

  const teamMemberWorkPackages: { person: Person; count: number }[] = [];

  for (const personId of teamMemberPersonIds) {
    const count = await prisma.workPackage.count({
      where: {
        OR: [
          { assigneeId: personId },
          { assignments: { some: { personId } } }
        ],
        status: { notIn: ["done"] }
      }
    });
    const personRecord = personMap.get(personId);
    if (personRecord) {
      teamMemberWorkPackages.push({
        person: {
          id: personRecord.id,
          name: personRecord.name,
          role: personRecord.role,
          capacity: personRecord.capacity
        },
        count
      });
    }
  }

  return {
    team,
    pendingVerification: pendingWps.map(wp => mapWorkPackage(wp as StoredWorkPackage)),
    rejectedWorkPackages: rejectedWps.map(wp => mapWorkPackage(wp as StoredWorkPackage)),
    teamMemberWorkPackages
  };
}

/**
 * 获取所有团队列表（admin 用）
 */
export async function listTeams(): Promise<Team[]> {
  const storedTeams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: { include: { person: true } }
    }
  });

  return storedTeams.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description ?? undefined,
    leadId: t.leadId ?? undefined,
    memberIds: t.memberships.map((membership) => membership.personId),
    manualOverride: t.manualOverride ?? undefined,
    externalId: t.externalId ?? undefined,
    syncedAt: t.syncedAt?.toISOString() ?? undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  }));
}

/**
 * 创建团队（admin 用）
 */
export async function createTeam(
  input: { name: string; description?: string; leadId?: string },
  user: User
): Promise<Team> {
  await assertCapability(user, "manageTeams");

  if (!input.name.trim()) {
    throw new ServiceError("团队名称不能为空。", 400);
  }

  const stored = await prisma.team.create({
    data: {
      name: input.name.trim(),
      description: input.description ?? null,
      leadId: input.leadId ?? null
    }
  });

  return {
    id: stored.id,
    name: stored.name,
    description: stored.description ?? undefined,
    leadId: stored.leadId ?? undefined,
    memberIds: [],
    manualOverride: stored.manualOverride ?? undefined,
    externalId: stored.externalId ?? undefined,
    syncedAt: stored.syncedAt?.toISOString() ?? undefined,
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString()
  };
}

/**
 * 更新团队（admin 用）
 */
export async function updateTeam(
  teamId: string,
  input: { name?: string; description?: string; leadId?: string; manualOverride?: boolean },
  user: User
): Promise<Team> {
  await assertCapability(user, "manageTeams");

  const existing = await prisma.team.findUnique({ where: { id: teamId } });
  if (!existing) {
    throw new ServiceError("团队不存在。", 404);
  }

  const stored = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
      ...(input.manualOverride !== undefined ? { manualOverride: input.manualOverride } : {})
    }
  });

  return {
    id: stored.id,
    name: stored.name,
    description: stored.description ?? undefined,
    leadId: stored.leadId ?? undefined,
    memberIds: undefined,
    manualOverride: stored.manualOverride ?? undefined,
    externalId: stored.externalId ?? undefined,
    syncedAt: stored.syncedAt?.toISOString() ?? undefined,
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString()
  };
}

/**
 * 删除团队（admin 用）
 */
export async function deleteTeam(teamId: string, user: User): Promise<void> {
  await assertCapability(user, "manageTeams");

  const existing = await prisma.team.findUnique({ where: { id: teamId } });
  if (!existing) {
    throw new ServiceError("团队不存在。", 404);
  }

  await prisma.teamMembership.deleteMany({ where: { teamId } });
  await prisma.team.delete({ where: { id: teamId } });
}

/**
 * 添加团队成员
 */
export async function addTeamMember(
  teamId: string,
  personId: string,
  user: User
): Promise<void> {
  await assertCapability(user, "manageTeams");

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new ServiceError("团队不存在。", 404);
  }

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) {
    throw new ServiceError("人员不存在。", 404);
  }

  const existing = await prisma.teamMembership.findUnique({
    where: { teamId_personId: { teamId, personId } }
  });
  if (existing) {
    throw new ServiceError("该成员已在团队中。", 409);
  }

  await prisma.teamMembership.create({ data: { teamId, personId } });
}

/**
 * 移除团队成员
 */
export async function removeTeamMember(
  teamId: string,
  personId: string,
  user: User
): Promise<void> {
  await assertCapability(user, "manageTeams");

  const membership = await prisma.teamMembership.findUnique({
    where: { teamId_personId: { teamId, personId } }
  });
  if (!membership) {
    throw new ServiceError("该成员不在团队中。", 404);
  }

  await prisma.teamMembership.delete({
    where: { teamId_personId: { teamId, personId } }
  });
}