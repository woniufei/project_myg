import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PermissionOverridesPanel } from "@/components/admin/PermissionOverridesPanel";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { ProjectMemberAddPanel } from "@/components/projects/ProjectMemberAddPanel";
import { roleLabels } from "@/lib/rbac";
import { listProjectMemberCandidates } from "@/lib/services/project-workflow";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectMembersPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot, currentUser } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }

  const members = snapshot.users.filter(
    (user) =>
      user.managedProjectIds.includes(project.id) ||
      user.participatingProjectIds.includes(project.id)
  );
  const visibleMembers = filterManageableMembers(members, currentUser, new Set(snapshot.people.map((person) => person.id)));
  const personLookup = new Map(snapshot.people.map((person) => [person.id, person]));
  const memberCandidates = currentUser
    ? await listProjectMemberCandidates(project.id, currentUser)
    : [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "成员" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">成员</h1>
          <p className="page-subtitle">项目内的用户、对应人员档案与是否为项目负责人。</p>
        </div>
      </header>
      <Surface
        title={`成员 (${visibleMembers.length})`}
        description="仅展示当前账号可查看和可操作的下级成员。"
        flush
      >
        {currentUser && currentUser.role !== "participant" ? (
          <div style={{ padding: 16, borderBottom: "1px solid var(--border-default)" }}>
            <ProjectMemberAddPanel
              projectIdentifier={project.identifier}
              currentUser={currentUser}
              candidates={memberCandidates}
            />
          </div>
        ) : null}
        {visibleMembers.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState title="暂无成员" />
          </div>
        ) : (
          <div className="scroll-x">
            <table className="data-table" style={{ minWidth: 760 }}>
              <colgroup>
                <col style={{ width: 220 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>用户</th>
                  <th>系统角色</th>
                  <th>项目角色</th>
                  <th>容量 (h/周)</th>
                  <th>能力</th>
                  <th>负责人</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((user) => {
                  const person = personLookup.get(user.personId);
                  const isLead = user.managedProjectIds.includes(project.id);
                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            aria-hidden="true"
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "var(--bg-emphasis)",
                              color: "var(--fg-default)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 600,
                              fontSize: 11,
                              flexShrink: 0
                            }}
                          >
                            {user.name.slice(0, 1)}
                          </span>
                          <strong style={{ fontSize: 13 }}>{user.name}</strong>
                        </div>
                      </td>
                      <td>
                        <Badge
                          tone={
                            user.role === "admin"
                              ? "danger"
                              : user.role === "projectManager"
                                ? "accent"
                                : "default"
                          }
                        >
                          {roleLabels[user.role]}
                        </Badge>
                      </td>
                      <td className="hint">{person?.role ?? "—"}</td>
                      <td className="hint mono">{person?.capacity ?? "—"}</td>
                      <td className="hint" data-wrap="true" style={{ whiteSpace: "normal" }}>
                        {person?.skills?.join("、") ?? "—"}
                      </td>
                      <td>
                        <Badge tone={isLead ? "success" : "default"}>{isLead ? "是" : "否"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
      {currentUser?.role === "admin" ? (
        <PermissionOverridesPanel
          currentUser={currentUser}
          users={visibleMembers}
          projects={snapshot.projects}
          fixedScope={{
            type: "project",
            id: project.id,
            label: `${project.name} 项目`
          }}
        />
      ) : null}
    </>
  );
}

function filterManageableMembers(
  members: User[],
  currentUser: User | undefined,
  visiblePersonIds: Set<string>
): User[] {
  if (!currentUser) {
    return [];
  }

  const currentRank = highestRoleRank(currentUser);
  return members.filter((member) => {
    if (member.id === currentUser.id) {
      return false;
    }
    if (highestRoleRank(member) >= currentRank) {
      return false;
    }
    if (currentUser.role === "teamLead") {
      return visiblePersonIds.has(member.personId);
    }
    return true;
  });
}

function highestRoleRank(user: User) {
  switch (user.role) {
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
