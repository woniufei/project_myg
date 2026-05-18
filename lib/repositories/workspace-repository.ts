import { prisma } from "@/lib/prisma";
import { PERSONAL_PROJECT_ID } from "@/lib/project-constants";
import type { User, WorkspaceSnapshot } from "@/lib/types";
import { applyAutomatedWorkPackageState } from "@/lib/work-package-status";
import {
  mapNotificationChannel,
  mapNotificationRule,
  mapPermissionOverride,
  mapPerson,
  mapProject,
  mapStewardMessage,
  mapTeam,
  mapUser,
  mapWorkPackage,
  mapWorkPackageApproval,
  mapWorkPackageComment,
  type StoredNotificationChannel,
  type StoredNotificationRule,
  type StoredPermissionOverride,
  type StoredPerson,
  type StoredProject,
  type StoredStewardMessage,
  type StoredTeam,
  type StoredUser,
  type StoredWorkPackage,
  type StoredWorkPackageApproval,
  type StoredWorkPackageComment
} from "./workspace-mappers";

export interface WorkspaceRepositoryOptions {
  userId?: string;
  projectId?: string;
}

type WorkPackageVisibilityWhere = {
  projectId?: string | { in: string[] };
  type?: "PHASE";
  createdByUserId?: string | { in: string[] };
  assigneeId?: string | { in: string[] };
  assignments?: { some: { personId: string | { in: string[] } } };
  OR?: WorkPackageVisibilityWhere[];
};

/**
 * Reads a production workspace snapshot from Prisma and maps it to the UI DTO.
 * Honors the OpenProject visibility rules: admins see everything, other roles
 * are restricted to their project memberships.
 */
export async function getWorkspaceSnapshotFromRepository(
  options: WorkspaceRepositoryOptions = {}
): Promise<WorkspaceSnapshot> {
  const users = (await prisma.user.findMany({
    include: { memberships: true, person: true },
    orderBy: { createdAt: "asc" }
  })) as unknown as StoredUser[];
  const currentUser = options.userId
    ? users.find((user) => user.id === options.userId)
    : users[0];
  const currentUserDto = currentUser ? mapUser(currentUser) : undefined;
  const visibleProjectIds = resolveVisibleProjectIds(currentUserDto, options.projectId);
  const workPackageWhere = await resolveVisibleWorkPackageWhere(
    currentUserDto,
    visibleProjectIds,
    options.projectId
  );

  const [
    people,
    projects,
    workPackages,
    stewardMessages,
    workPackageComments,
    workPackageApprovals,
    notificationChannels,
    notificationRules,
    permissionOverrides
  ] = await Promise.all([
    prisma.person.findMany({ orderBy: { id: "asc" } }),
    prisma.project.findMany({
      where: visibleProjectIds ? { id: { in: visibleProjectIds } } : undefined,
      orderBy: { createdAt: "asc" }
    }),
    prisma.workPackage.findMany({
      where: workPackageWhere,
      include: {
        requirements: { orderBy: { sortOrder: "asc" } },
        assignments: { orderBy: { sortOrder: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } }
      },
      orderBy: { id: "asc" }
    }),
    prisma.stewardMessage.findMany({
      where: visibleProjectIds
        ? { OR: [{ projectId: null }, { projectId: { in: visibleProjectIds } }] }
        : undefined,
      orderBy: { createdAt: "desc" }
    }),
    prisma.workPackageComment.findMany({
      where: workPackageWhere ? { workPackage: { is: workPackageWhere } } : undefined,
      orderBy: { createdAt: "desc" }
    }),
    prisma.workPackageApproval.findMany({
      where: workPackageWhere ? { workPackage: { is: workPackageWhere } } : undefined,
      orderBy: { createdAt: "desc" }
    }),
    prisma.notificationChannel.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.notificationRule.findMany({
      where: visibleProjectIds
        ? { OR: [{ projectId: null }, { projectId: { in: visibleProjectIds } }] }
        : undefined,
      include: { channels: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.permissionOverride.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  return {
    users: users.map(mapUser),
    people: (people as StoredPerson[]).map(mapPerson),
    projects: (projects as StoredProject[])
      .filter((project) => project.id !== PERSONAL_PROJECT_ID)
      .map(mapProject),
    workPackages: (workPackages as StoredWorkPackage[])
      .map(mapWorkPackage)
      .map((workPackage) => applyAutomatedWorkPackageState(workPackage)),
    workPackageComments: (workPackageComments as StoredWorkPackageComment[]).map(
      mapWorkPackageComment
    ),
    workPackageApprovals: (workPackageApprovals as StoredWorkPackageApproval[]).map(
      mapWorkPackageApproval
    ),
    stewardMessages: (stewardMessages as StoredStewardMessage[]).map(mapStewardMessage),
    notificationChannels: (notificationChannels as StoredNotificationChannel[]).map(
      mapNotificationChannel
    ),
    notificationRules: (notificationRules as StoredNotificationRule[]).map(mapNotificationRule),
    permissionOverrides: (permissionOverrides as StoredPermissionOverride[]).map(
      mapPermissionOverride
    )
  };
}

function resolveVisibleProjectIds(
  currentUser: User | undefined,
  requestedProjectId: string | undefined
): string[] | undefined {
  if (!currentUser && !requestedProjectId) {
    return undefined;
  }

  if (!currentUser) {
    return requestedProjectId ? [requestedProjectId] : undefined;
  }

  const scopedProjectIds = Array.from(
    new Set([...currentUser.managedProjectIds, ...currentUser.participatingProjectIds])
  ).filter((projectId) => projectId !== PERSONAL_PROJECT_ID);
  if (requestedProjectId) {
    return scopedProjectIds.includes(requestedProjectId) ? [requestedProjectId] : [];
  }

  if (currentUser.role === "admin") {
    return undefined;
  }

  return scopedProjectIds;
}

async function resolveVisibleWorkPackageWhere(
  currentUser: User | undefined,
  visibleProjectIds: string[] | undefined,
  requestedProjectId: string | undefined
): Promise<WorkPackageVisibilityWhere | undefined> {
  if (!currentUser) {
    return visibleProjectIds ? { projectId: { in: visibleProjectIds } } : undefined;
  }

  if (requestedProjectId) {
    if (currentUser.role === "participant") {
      return {
        OR: [
          { projectId: { in: visibleProjectIds ?? [] }, assigneeId: currentUser.personId },
          { projectId: { in: visibleProjectIds ?? [] }, assignments: { some: { personId: currentUser.personId } } },
          { projectId: { in: visibleProjectIds ?? [] }, createdByUserId: currentUser.id }
        ]
      };
    }
    return { projectId: { in: visibleProjectIds ?? [] } };
  }

  if (currentUser.role === "admin") {
    return undefined;
  }

  if (currentUser.role === "projectManager") {
    return {
      OR: [
        { projectId: { in: visibleProjectIds ?? [] } },
        { projectId: PERSONAL_PROJECT_ID, createdByUserId: currentUser.id }
      ]
    };
  }

  if (currentUser.role === "teamLead") {
    const teamMemberPersonIds = await resolveTeamMemberPersonIds(currentUser.personId);
    const teamUsers = await prisma.user.findMany({
      where: { personId: { in: teamMemberPersonIds } },
      select: { id: true }
    });
    const teamUserIds = teamUsers.map((user) => user.id);
    return {
      OR: [
        { projectId: { in: visibleProjectIds ?? [] }, assigneeId: { in: teamMemberPersonIds } },
        { projectId: { in: visibleProjectIds ?? [] }, assignments: { some: { personId: { in: teamMemberPersonIds } } } },
        { projectId: { in: visibleProjectIds ?? [] }, createdByUserId: { in: teamUserIds } },
        { projectId: { in: visibleProjectIds ?? [] }, type: "PHASE" },
        { projectId: PERSONAL_PROJECT_ID, createdByUserId: currentUser.id }
      ]
    };
  }

  return {
    OR: [
      { projectId: { in: visibleProjectIds ?? [] }, assigneeId: currentUser.personId },
      { projectId: { in: visibleProjectIds ?? [] }, assignments: { some: { personId: currentUser.personId } } },
      { projectId: { in: visibleProjectIds ?? [] }, createdByUserId: currentUser.id },
      { projectId: PERSONAL_PROJECT_ID, createdByUserId: currentUser.id }
    ]
  };
}

async function resolveTeamMemberPersonIds(leadPersonId: string): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { leadId: leadPersonId },
        { memberships: { some: { personId: leadPersonId } } }
      ]
    },
    include: { memberships: true }
  });

  return Array.from(new Set([
    leadPersonId,
    ...teams.flatMap((team) => [
      team.leadId,
      ...team.memberships.map((membership) => membership.personId)
    ])
  ].filter((id): id is string => Boolean(id))));
}
