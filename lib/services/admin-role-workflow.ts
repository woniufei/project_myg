import { prisma } from "@/lib/prisma";
import type { PlatformRole, Project, Team, User } from "@/lib/types";
import { ServiceError } from "./auth-context";

const roleToStored: Record<PlatformRole, string> = {
  admin: "ADMIN",
  projectManager: "PROJECT_MANAGER",
  teamLead: "TEAM_LEAD",
  participant: "PARTICIPANT"
};

const storedToRole: Record<string, PlatformRole> = {
  ADMIN: "admin",
  PROJECT_MANAGER: "projectManager",
  TEAM_LEAD: "teamLead",
  PARTICIPANT: "participant"
};

export interface ExternalRoleCandidate {
  externalPersonId: string;
  externalId: string;
  name: string;
  employeeNo?: string;
  jobTitle?: string;
  departmentName?: string;
  isLeader: boolean;
  personId?: string;
  userId?: string;
  currentRole?: PlatformRole;
  syncedAt: string;
}

export interface LeadershipAssignmentInput {
  externalPersonId: string;
  role: Extract<PlatformRole, "projectManager" | "teamLead">;
  projectId?: string;
  teamId?: string;
}

export interface LeadershipAssignmentResult {
  userId: string;
  personId: string;
  role: Extract<PlatformRole, "projectManager" | "teamLead">;
  project?: Project;
  team?: Team;
}

/**
 * Lists Feishu-synced people that can be promoted into platform leadership roles.
 */
export async function listExternalRoleCandidates(): Promise<ExternalRoleCandidate[]> {
  const externalPeople = await prisma.externalPerson.findMany({
    orderBy: [{ departmentName: "asc" }, { name: "asc" }],
    include: {
      person: {
        include: {
          users: {
            include: { memberships: true },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  return externalPeople.map((item) => {
    const user = item.person?.users.find((candidate) => candidate.role !== "ADMIN") ?? item.person?.users[0];

    return {
      externalPersonId: item.id,
      externalId: item.externalId,
      name: item.name,
      employeeNo: item.employeeNo ?? undefined,
      jobTitle: item.jobTitle ?? undefined,
      departmentName: item.departmentName ?? undefined,
      isLeader: item.isLeader,
      personId: item.personId ?? undefined,
      userId: user?.id,
      currentRole: user ? storedToRole[user.role] ?? "participant" : undefined,
      syncedAt: item.syncedAt.toISOString()
    };
  });
}

/**
 * Creates or updates a platform user from Feishu-synced person data and assigns
 * project manager or team lead responsibilities. Only platform admins can call it.
 */
export async function assignLeadershipFromExternalPerson(
  input: LeadershipAssignmentInput,
  caller: User
): Promise<LeadershipAssignmentResult> {
  if (caller.role !== "admin") {
    throw new ServiceError("只有管理员可以添加项目经理或团队负责人。", 403);
  }
  if (input.role === "projectManager" && !input.projectId) {
    throw new ServiceError("添加项目经理时必须选择项目。", 400);
  }
  if (input.role === "teamLead" && !input.teamId) {
    throw new ServiceError("添加团队负责人时必须选择团队。", 400);
  }

  const externalPerson = await prisma.externalPerson.findUnique({
    where: { id: input.externalPersonId },
    include: {
      person: {
        include: {
          users: {
            include: { memberships: true },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });
  if (!externalPerson) {
    throw new ServiceError("飞书同步人员不存在。", 404);
  }

  const person = externalPerson.person ?? await prisma.person.create({
    data: {
      name: externalPerson.name,
      role: externalPerson.jobTitle ?? "成员",
      capacity: 40,
      skills: "[]",
      employeeNo: externalPerson.employeeNo ?? null,
      jobTitle: externalPerson.jobTitle ?? null,
      departmentCode: externalPerson.departmentCode ?? null,
      departmentName: externalPerson.departmentName ?? null,
      externalId: externalPerson.externalId
    }
  });

  if (!externalPerson.personId) {
    await prisma.externalPerson.update({
      where: { id: externalPerson.id },
      data: { personId: person.id }
    });
  }

  const storedRole = roleToStored[input.role];
  const existingUser =
    externalPerson.person?.users.find((user) => user.role === storedRole) ??
    externalPerson.person?.users.find((user) => user.role !== "ADMIN");
  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: externalPerson.name,
          role: storedRole as any,
          roles: JSON.stringify([input.role])
        },
        include: { memberships: true }
      })
    : await prisma.user.create({
        data: {
          name: externalPerson.name,
          role: storedRole as any,
          roles: JSON.stringify([input.role]),
          personId: person.id
        },
        include: { memberships: true }
      });

  if (input.role === "projectManager") {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) {
      throw new ServiceError("项目不存在。", 404);
    }
    await prisma.projectMembership.upsert({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
      create: {
        userId: user.id,
        projectId: project.id,
        isLead: true
      },
      update: { isLead: true }
    });

    return {
      userId: user.id,
      personId: person.id,
      role: input.role,
      project: {
        id: project.id,
        identifier: project.identifier,
        name: project.name,
        description: project.description ?? undefined,
        parentId: project.parentId ?? undefined,
        status: project.status === "ACTIVE" ? "active" : project.status === "ON_HOLD" ? "onHold" : "archived",
        health: project.health === "HIGH" ? "High" : project.health === "LOW" ? "Low" : "Medium",
        initialDifficulty: project.initialDifficulty.toLowerCase() as Project["initialDifficulty"],
        difficultyOverride: project.difficultyOverride
          ? project.difficultyOverride.toLowerCase() as Project["difficultyOverride"]
          : undefined,
        progress: project.progress,
        startDate: project.startDate?.toISOString(),
        endDate: project.endDate?.toISOString(),
        enabledModules: JSON.parse(project.enabledModules)
      }
    };
  }

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    include: { memberships: true }
  });
  if (!team) {
    throw new ServiceError("团队不存在。", 404);
  }

  await prisma.team.update({
    where: { id: team.id },
    data: {
      leadId: person.id,
      manualOverride: true
    }
  });
  await prisma.teamMembership.upsert({
    where: { teamId_personId: { teamId: team.id, personId: person.id } },
    create: {
      teamId: team.id,
      personId: person.id
    },
    update: {}
  });

  return {
    userId: user.id,
    personId: person.id,
    role: input.role,
    team: {
      id: team.id,
      name: team.name,
      description: team.description ?? undefined,
      leadId: person.id,
      memberIds: Array.from(new Set([...team.memberships.map((membership) => membership.personId), person.id])),
      manualOverride: true,
      externalId: team.externalId ?? undefined,
      syncedAt: team.syncedAt?.toISOString() ?? undefined,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString()
    }
  };
}
