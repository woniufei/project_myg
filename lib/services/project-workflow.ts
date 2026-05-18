import { prisma } from "@/lib/prisma";
import { isPersonalProjectId } from "@/lib/project-constants";
import {
  mapProject,
  serializeEnabledModules,
  toStoredDifficulty,
  toStoredProjectStatus,
  toStoredRiskLevel,
  type StoredProject
} from "@/lib/repositories/workspace-mappers";
import type { Difficulty, Project, ProjectModule, ProjectStatus, RiskLevel, User } from "@/lib/types";
import { assertProjectVisible, ServiceError } from "./auth-context";

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/;

export interface ProjectCreateInput {
  identifier: string;
  name: string;
  description?: string;
  parentId?: string;
  status?: ProjectStatus;
  health?: RiskLevel;
  initialDifficulty?: Difficulty;
  enabledModules: ProjectModule[];
  phases: ProjectPhaseInput[];
}

export interface ProjectPhaseInput {
  subject: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  assigneeId?: string;
  teamLeadPersonId?: string;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  status?: ProjectStatus;
  health?: RiskLevel;
  difficultyOverride?: Difficulty | null;
  enabledModules?: ProjectModule[];
}

export interface ProjectMemberCandidate {
  userId: string;
  userName: string;
  role: User["role"];
  personId: string;
  personName: string;
  personRole: string;
  externalId?: string;
  departmentName?: string;
}

export interface ProjectTeamLeadCandidate {
  userId: string;
  personId: string;
  personName: string;
  personRole: string;
  externalId?: string;
  departmentName?: string;
}

/**
 * Creates a new project after validating the identifier and the caller's
 * permission. Always seeds the creator as project lead.
 */
export async function createProject(input: ProjectCreateInput, user: User): Promise<Project> {
  if (user.role !== "projectManager") {
    throw new ServiceError("只有项目经理可以创建项目。", 403);
  }

  const identifier = input.identifier.trim().toLowerCase();
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new ServiceError(
      "项目标识符必须是小写字母或数字开头，2-41 位，可含 -。",
      400
    );
  }
  const existing = await prisma.project.findUnique({ where: { identifier } });
  if (existing) {
    throw new ServiceError(
      `项目标识符「${identifier}」已被占用，请更换后重试。`,
      409
    );
  }
  if (!input.name.trim()) {
    throw new ServiceError("项目名称不能为空。", 400);
  }
  if (!input.enabledModules.includes("overview")) {
    throw new ServiceError("项目必须至少启用 overview 模块。", 400);
  }
  const phases = normalizeProjectPhases(input.phases);
  if (phases.length === 0) {
    throw new ServiceError("项目经理创建项目时必须至少创建 1 个项目阶段。", 400);
  }
  const teamLeadUsersByPersonId = await loadTeamLeadUsersByPersonId(
    Array.from(new Set(phases.map((phase) => phase.teamLeadPersonId).filter(Boolean) as string[]))
  );
  const invalidTeamLeadPersonId = phases
    .map((phase) => phase.teamLeadPersonId)
    .find((personId) => personId && !teamLeadUsersByPersonId.has(personId));
  if (invalidTeamLeadPersonId) {
    throw new ServiceError("阶段人员配置只能选择平台已配置的团队负责人。", 400);
  }
  if (input.parentId) {
    const parent = await prisma.project.findUnique({ where: { id: input.parentId } });
    if (!parent) {
      throw new ServiceError("父项目不存在。", 404);
    }
    assertProjectVisible(user, parent.id);
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        identifier,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        createdByUserId: user.id,
        parentId: input.parentId ?? null,
        status: toStoredProjectStatus(input.status ?? "active"),
        health: toStoredRiskLevel(input.health ?? "Medium"),
        initialDifficulty: toStoredDifficulty(input.initialDifficulty ?? "medium"),
        progress: 0,
        enabledModules: serializeEnabledModules(input.enabledModules),
        memberships: {
          create: {
            userId: user.id,
            isLead: true
          }
        }
      }
    });

    for (const phase of phases) {
      const teamLeadUser = phase.teamLeadPersonId
        ? teamLeadUsersByPersonId.get(phase.teamLeadPersonId)
        : undefined;
      if (teamLeadUser) {
        await tx.projectMembership.upsert({
          where: { userId_projectId: { userId: teamLeadUser.id, projectId: created.id } },
          create: {
            userId: teamLeadUser.id,
            projectId: created.id,
            isLead: false
          },
          update: {}
        });
      }
    }

    for (const [index, phase] of phases.entries()) {
      await tx.workPackage.create({
        data: {
          projectId: created.id,
          type: "PHASE",
          subject: phase.subject,
          description: phase.description ?? "",
          status: "todo",
          priority: index === 0 ? "P0" : "P1",
          difficulty: toStoredDifficulty(input.initialDifficulty ?? "medium"),
          origin: "MANAGER",
          createdByUserId: user.id,
          assigneeId: phase.teamLeadPersonId ?? phase.assigneeId ?? user.personId,
          startDate: phase.startDate ? new Date(phase.startDate) : null,
          dueDate: phase.dueDate ? new Date(phase.dueDate) : null,
          percentComplete: 0,
          lastProgressNote: "",
          dependencies: "[]",
          requiredSkills: "[]",
          assignments: phase.teamLeadPersonId
            ? {
                create: {
                  personId: phase.teamLeadPersonId,
                  role: "团队负责人",
                  responsibility: "阶段推进与团队任务拆解",
                  sortOrder: 0
                }
              }
            : undefined
        }
      });
    }

    return created;
  });

  return mapProject(project as StoredProject);
}

/**
 * Updates an existing project, including module toggles and the project status.
 * Visibility is enforced by `assertProjectVisible`.
 */
export async function updateProject(
  projectId: string,
  input: ProjectUpdateInput,
  user: User
): Promise<Project> {
  if (user.role !== "projectManager") {
    throw new ServiceError("只有项目经理可以更新项目。", 403);
  }
  if (isPersonalProjectId(projectId)) {
    throw new ServiceError("个人事项默认项目不能修改。", 403);
  }
  assertProjectVisible(user, projectId);

  if (input.enabledModules && !input.enabledModules.includes("overview")) {
    throw new ServiceError("项目必须至少启用 overview 模块。", 400);
  }

  if (input.difficultyOverride !== undefined) {
    throw new ServiceError("只有管理员可以修改项目难度配置。", 403);
  }

  if (input.parentId) {
    if (input.parentId === projectId) {
      throw new ServiceError("项目不能成为自己的父项目。", 400);
    }
    const parent = await prisma.project.findUnique({ where: { id: input.parentId } });
    if (!parent) {
      throw new ServiceError("父项目不存在。", 404);
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: input.name?.trim(),
      description:
        input.description === undefined
          ? undefined
          : input.description === null
            ? null
            : input.description.trim() || null,
      parentId: input.parentId === undefined ? undefined : input.parentId ?? null,
      status: input.status ? toStoredProjectStatus(input.status) : undefined,
      health: input.health ? toStoredRiskLevel(input.health) : undefined,
      difficultyOverride:
        input.difficultyOverride === undefined
          ? undefined
          : input.difficultyOverride === null
            ? null
            : toStoredDifficulty(input.difficultyOverride),
      enabledModules: input.enabledModules
        ? serializeEnabledModules(input.enabledModules)
        : undefined
    }
  });

  return mapProject(updated as StoredProject);
}

/**
 * Deletes a project and its stages/nodes/tasks when the caller created it.
 */
export async function deleteProject(projectId: string, user: User): Promise<Project> {
  if (isPersonalProjectId(projectId)) {
    throw new ServiceError("个人事项默认项目不能删除。", 403);
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new ServiceError("项目不存在。", 404);
  }
  if (project.createdByUserId !== user.id) {
    throw new ServiceError("只能删除本人创建的项目。", 403);
  }
  assertProjectVisible(user, project.id);

  await prisma.project.delete({ where: { id: project.id } });
  return mapProject(project as StoredProject);
}

export async function findProjectByIdentifier(identifier: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({ where: { identifier } });
  return project ? mapProject(project as StoredProject) : null;
}

/**
 * Lists platform users that were configured as team leads by administrators.
 * Project creation and phase assignment use this list as the single source.
 */
export async function listProjectTeamLeadCandidates(): Promise<ProjectTeamLeadCandidate[]> {
  const teamLeadUsers = await prisma.user.findMany({
    where: { role: "TEAM_LEAD" },
    include: { person: true },
    orderBy: { createdAt: "asc" }
  });

  return teamLeadUsers.map((candidate) => ({
    userId: candidate.id,
    personId: candidate.personId,
    personName: candidate.person.name,
    personRole: candidate.person.role,
    externalId: candidate.person.externalId ?? undefined,
    departmentName: candidate.person.departmentName ?? undefined
  }));
}

/**
 * Lists users that the caller can add to the project as members.
 */
export async function listProjectMemberCandidates(
  projectId: string,
  user: User
): Promise<ProjectMemberCandidate[]> {
  if (!canManageProjectMembers(user, projectId)) {
    return [];
  }

  const existingMemberships = await prisma.projectMembership.findMany({
    where: { projectId },
    select: { userId: true }
  });
  const existingUserIds = new Set(existingMemberships.map((membership) => membership.userId));
  const users = await prisma.user.findMany({
    include: { person: true, memberships: true },
    orderBy: { createdAt: "asc" }
  });
  const teamPersonIds = user.role === "teamLead"
    ? await getLedTeamPersonIds(user.personId)
    : undefined;

  return users
    .filter((candidate) => !existingUserIds.has(candidate.id))
    .filter((candidate) => isCandidateManageable(user, mapStoredRole(candidate.role), candidate.personId, teamPersonIds))
    .map((candidate) => ({
      userId: candidate.id,
      userName: candidate.name,
      role: mapStoredRole(candidate.role),
      personId: candidate.personId,
      personName: candidate.person.name,
      personRole: candidate.person.role,
      externalId: candidate.person.externalId ?? undefined,
      departmentName: candidate.person.departmentName ?? undefined
    }));
}

/**
 * Adds a user to a project after checking role hierarchy and project scope.
 */
export async function addProjectMember(
  projectIdentifier: string,
  targetUserId: string,
  input: { isLead?: boolean },
  user: User
): Promise<void> {
  const project = await prisma.project.findUnique({ where: { identifier: projectIdentifier } });
  if (!project) {
    throw new ServiceError("项目不存在。", 404);
  }
  if (!canManageProjectMembers(user, project.id)) {
    throw new ServiceError("当前角色无权添加项目成员。", 403);
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { memberships: true }
  });
  if (!targetUser) {
    throw new ServiceError("用户不存在。", 404);
  }
  if (targetUser.id === user.id) {
    throw new ServiceError("不能把自己重复添加为项目成员。", 400);
  }

  const teamPersonIds = user.role === "teamLead"
    ? await getLedTeamPersonIds(user.personId)
    : undefined;
  if (!isCandidateManageable(user, mapStoredRole(targetUser.role), targetUser.personId, teamPersonIds)) {
    throw new ServiceError("只能添加当前角色可管辖范围内的下级成员。", 403);
  }

  const existing = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: targetUserId, projectId: project.id } }
  });
  if (existing) {
    throw new ServiceError("该成员已在项目中。", 409);
  }

  await prisma.projectMembership.create({
    data: {
      userId: targetUserId,
      projectId: project.id,
      isLead: Boolean(input.isLead) && user.role !== "teamLead"
    }
  });
}

function canManageProjectMembers(user: User, projectId: string) {
  if (user.role === "admin") {
    return true;
  }
  if (user.role === "projectManager") {
    return user.managedProjectIds.includes(projectId);
  }
  if (user.role === "teamLead") {
    return user.participatingProjectIds.includes(projectId);
  }
  return false;
}

function isCandidateManageable(
  caller: User,
  targetRole: User["role"],
  targetPersonId: string,
  teamPersonIds?: Set<string>
) {
  if (targetPersonId === caller.personId) {
    return false;
  }
  if (roleRank(targetRole) >= roleRank(caller.role)) {
    return false;
  }
  if (caller.role === "teamLead") {
    return targetRole === "participant" && Boolean(teamPersonIds?.has(targetPersonId));
  }
  return true;
}

function roleRank(role: User["role"]) {
  switch (role) {
    case "admin":
      return 4;
    case "projectManager":
      return 3;
    case "teamLead":
      return 2;
    case "participant":
    default:
      return 1;
  }
}

async function getLedTeamPersonIds(leadPersonId: string) {
  const teams = await prisma.team.findMany({
    where: { leadId: leadPersonId },
    include: { memberships: true }
  });
  return new Set([
    leadPersonId,
    ...teams.flatMap((team) => team.memberships.map((membership) => membership.personId))
  ]);
}

function mapStoredRole(role: string): User["role"] {
  const lookup: Record<string, User["role"]> = {
    ADMIN: "admin",
    PROJECT_MANAGER: "projectManager",
    TEAM_LEAD: "teamLead",
    PARTICIPANT: "participant"
  };
  return lookup[role] ?? "participant";
}

function normalizeProjectPhases(phases: ProjectCreateInput["phases"]): ProjectPhaseInput[] {
  return (phases ?? [])
    .map((phase) => ({
      subject: phase.subject.trim(),
      description: phase.description?.trim() || undefined,
      startDate: phase.startDate || undefined,
      dueDate: phase.dueDate || undefined,
      assigneeId: phase.assigneeId || undefined,
      teamLeadPersonId: phase.teamLeadPersonId || phase.assigneeId || undefined
    }))
    .filter((phase) => phase.subject.length > 0);
}

async function loadTeamLeadUsersByPersonId(personIds: string[]) {
  if (personIds.length === 0) {
    return new Map<string, { id: string; personId: string }>();
  }

  const users = await prisma.user.findMany({
    where: {
      role: "TEAM_LEAD",
      personId: { in: personIds }
    },
    select: {
      id: true,
      personId: true
    }
  });

  return new Map(users.map((user) => [user.personId, user]));
}
