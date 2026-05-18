import type { PlatformRole, Project, User, WorkspaceSnapshot } from "./types";
import { permissionMatrix } from "./permissions";
export { permissionMatrix } from "./permissions";

export const roleLabels: Record<PlatformRole, string> = {
  admin: "管理员",
  projectManager: "项目经理",
  teamLead: "团队负责人",
  participant: "项目参与员"
};

/**
 * Checks whether the role can use the given permission.
 */
export function can(role: PlatformRole, permissionKey: string): boolean {
  const permission = permissionMatrix.find((item) => item.key === permissionKey);
  return permission ? permission[role] : false;
}

/**
 * Checks whether any of the user's roles can use the given permission.
 */
export function canAny(roles: PlatformRole[], permissionKey: string): boolean {
  return roles.some((role) => can(role, permissionKey));
}

/**
 * Returns the user's single platform role as an array for legacy call sites.
 */
export function getUserRoles(user?: Pick<User, "role" | "roles">): PlatformRole[] {
  if (!user) {
    return [];
  }
  return [user.role];
}

/**
 * Checks whether any of a user's roles can use the given permission.
 */
export function canUser(user: Pick<User, "role" | "roles"> | undefined, permissionKey: string): boolean {
  return canAny(getUserRoles(user), permissionKey);
}

/**
 * Checks whether the user has the given role.
 */
export function userHasRole(user: Pick<User, "role" | "roles"> | undefined, role: PlatformRole): boolean {
  return getUserRoles(user).includes(role);
}

/**
 * Checks whether the user's roles include the given role.
 */
export function hasExactRole(roles: PlatformRole[], role: PlatformRole): boolean {
  return roles.includes(role);
}

/**
 * Returns the person IDs of all team members for the given team lead.
 * Currently returns the lead's own personId as a safe fallback until
 * Team/TeamMembership tables are populated (see docs/权限与菜单设计方案.md).
 */
export function getTeamMemberPersonIds(leadPersonId: string): string[] {
  // TODO: replace with actual TeamMembership lookup once Team model is populated
  return [leadPersonId];
}

/**
 * Filters workspace data according to the current user's project scope.
 *
 * - Admin: sees everything.
 * - PM: sees managed + participating projects and all work packages in scope.
 * - TeamLead: sees participating projects + work packages of team members.
 * - Participant: sees participating projects + only own work packages.
 */
export function filterWorkspaceForUser(snapshot: WorkspaceSnapshot, user: User): WorkspaceSnapshot {
  const userRoles = getUserRoles(user);
  const isAdmin = user.role === "admin";
  const isPM = user.role === "projectManager";
  const isTeamLead = user.role === "teamLead";
  const isParticipant = user.role === "participant";

  if (isAdmin) {
    return snapshot;
  }

  const visibleProjectIds = new Set([...user.managedProjectIds, ...user.participatingProjectIds]);
  const visibleWorkPackages = snapshot.workPackages.filter(
    (wp) =>
      (wp.projectId ? visibleProjectIds.has(wp.projectId) : wp.createdByUserId === user.id)
  );

  let scopedWorkPackages: typeof visibleWorkPackages;
  if (isParticipant) {
    // Participant: only own work packages.
    scopedWorkPackages = visibleWorkPackages.filter(
      (wp) => isWorkPackageAssignedTo(wp, [user.personId]) || wp.createdByUserId === user.id
    );
  } else if (isTeamLead) {
    const teamMemberPersonIds = getTeamMemberPersonIds(user.personId);
    scopedWorkPackages = visibleWorkPackages.filter(
      (wp) =>
        isWorkPackageAssignedTo(wp, teamMemberPersonIds) ||
        teamMemberPersonIds.includes(wp.createdByUserId)
    );
  } else if (isPM) {
    // Project manager: see all in-scope work packages.
    scopedWorkPackages = visibleWorkPackages;
  } else {
    // fallback: participant-level scoping
    scopedWorkPackages = visibleWorkPackages.filter(
      (wp) => isWorkPackageAssignedTo(wp, [user.personId]) || wp.createdByUserId === user.id
    );
  }

  const visibleWorkPackageIds = new Set(scopedWorkPackages.map((wp) => wp.id));
  const visiblePeopleIds = new Set([
    ...scopedWorkPackages.map((wp) => wp.assigneeId).filter((id): id is string => Boolean(id)),
    ...scopedWorkPackages.flatMap((wp) => wp.assignments?.map((assignment) => assignment.personId) ?? []),
    user.personId
  ]);

  return {
    ...snapshot,
    projects: snapshot.projects.filter((project) => visibleProjectIds.has(project.id)),
    workPackages: scopedWorkPackages,
    people: snapshot.people.filter((person) => visiblePeopleIds.has(person.id)),
    workPackageComments: snapshot.workPackageComments.filter(
      (comment) =>
        visibleWorkPackageIds.has(comment.workPackageId) ||
        comment.authorPersonId === user.personId ||
        comment.mentionsPersonIds.includes(user.personId)
    ),
    workPackageApprovals: snapshot.workPackageApprovals.filter(
      (approval) =>
        visibleWorkPackageIds.has(approval.workPackageId) ||
        approval.reviewerPersonId === user.personId
    ),
    stewardMessages: snapshot.stewardMessages,
    notificationChannels: snapshot.notificationChannels.filter(
      (channel) =>
        channel.audienceRoles.some((role) => userRoles.includes(role)) ||
        channel.audiencePersonIds.includes(user.personId)
    ),
    notificationRules:
      !isPM && !isAdmin
        ? snapshot.notificationRules.filter((rule) =>
            rule.audienceRoles.some((role) => userRoles.includes(role))
          )
        : snapshot.notificationRules
  };
}

function isWorkPackageAssignedTo(
  workPackage: WorkspaceSnapshot["workPackages"][number],
  personIds: string[]
): boolean {
  const scopedPersonIds = new Set(personIds);
  return (
    Boolean(workPackage.assigneeId && scopedPersonIds.has(workPackage.assigneeId)) ||
    Boolean(workPackage.assignments?.some((assignment) => scopedPersonIds.has(assignment.personId)))
  );
}

/**
 * Filters projects list for project navigation according to role.
 * Admin sees all; execution roles see every project they manage or participate in.
 */
export function filterProjectsForRole(projects: Project[], user?: User): Project[] {
  if (!user) {
    return projects;
  }
  if (userHasRole(user, "admin")) {
    return projects;
  }

  const scopedIds = new Set([...user.managedProjectIds, ...user.participatingProjectIds]);
  return projects.filter((project) => scopedIds.has(project.id));
}


