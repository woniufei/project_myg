import Link from "next/link";
import { LeadershipAssignmentPanel } from "@/components/admin/LeadershipAssignmentPanel";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/primer/Badge";
import { Surface } from "@/components/primer/Surface";
import { permissionMatrix, roleLabels } from "@/lib/rbac";
import { listExternalRoleCandidates } from "@/lib/services/admin-role-workflow";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { listTeams } from "@/lib/services/team-workflow";
import type { Person, Project, Team, User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const [teams, externalCandidates] = await Promise.all([
    listTeams(),
    listExternalRoleCandidates()
  ]);

  const isAdmin = currentUser?.role === "admin";

  return (
    <>
      <Breadcrumb items={[{ label: "管理员" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">管理员</h1>
          <p className="page-subtitle">
            {isAdmin
              ? "管理项目、用户与平台范围设置。"
              : "仅平台管理员可访问完整管理能力，下面以只读视角呈现。"}
          </p>
        </div>
        {isAdmin ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/users" className="btn" data-size="sm" data-variant="primary">
              用户与角色
            </Link>
            <Link href="/admin/teams" className="btn" data-size="sm">
              团队组织
            </Link>
            <Link href="/admin/feature-flags" className="btn" data-size="sm" data-variant="primary">
              平台模块开关
            </Link>
            <Link href="/admin/agent-keys" className="btn" data-size="sm">
              Agent Key
            </Link>
            <Link href="/admin/agent-audit" className="btn" data-size="sm">
              Agent 审计
            </Link>
          </div>
        ) : null}
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16
        }}
      >
        <Surface
          title={`项目 (${snapshot.projects.length})`}
          description="管理项目层级、模块开关与归档。"
          flush
        >
          <table className="data-table">
            <colgroup>
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 60 }} />
            </colgroup>
            <tbody>
              {snapshot.projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {project.parentId ? (
                        <span aria-hidden="true" style={{ color: "var(--fg-subtle)" }}>↳</span>
                      ) : null}
                      <Link
                        href={`/projects/${project.identifier}/overview`}
                        style={{ color: "var(--fg-default)", fontWeight: 500 }}
                      >
                        {project.name}
                      </Link>
                    </div>
                    <div className="hint mono" style={{ fontSize: 11, marginTop: 2 }}>
                      {project.identifier}
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={
                        project.status === "active"
                          ? "success"
                          : project.status === "onHold"
                            ? "attention"
                            : "default"
                      }
                    >
                      {project.status === "active"
                        ? "进行中"
                        : project.status === "onHold"
                          ? "暂停"
                          : "已归档"}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/projects/${project.identifier}/settings`}
                      className="btn"
                      data-size="sm"
                      data-variant="ghost"
                    >
                      设置
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>

        <Surface
          title={`用户 (${snapshot.users.length})`}
          description="平台账号和默认角色。"
          flush
        >
          <table className="data-table">
            <colgroup>
              <col />
              <col style={{ width: 120 }} />
            </colgroup>
            <tbody>
              {snapshot.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong style={{ fontSize: 13 }}>{user.name}</strong>
                    <p className="hint mono" style={{ margin: "2px 0 0", fontSize: 11 }}>
                      {user.id}
                    </p>
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
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </div>

      {isAdmin ? (
        <LeadershipAssignmentPanel
          candidates={externalCandidates}
          projects={snapshot.projects}
          teams={teams}
        />
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16
        }}
      >
        <TeamOrganizationView teams={teams} people={snapshot.people} />
        <ProjectPeopleView
          projects={snapshot.projects}
          users={snapshot.users}
          people={snapshot.people}
        />
      </div>

      <Surface
        title="角色权限矩阵"
        description="不同角色可执行的操作。"
        flush
      >
        <div className="scroll-x">
          <table className="data-table" style={{ minWidth: 720 }}>
            <colgroup>
              <col />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr>
                <th>权限</th>
                <th style={{ textAlign: "center" }}>管理员</th>
                <th style={{ textAlign: "center" }}>项目经理</th>
                <th style={{ textAlign: "center" }}>团队负责人</th>
                <th style={{ textAlign: "center" }}>参与员</th>
              </tr>
            </thead>
            <tbody>
              {permissionMatrix.map((permission) => (
                <tr key={permission.key}>
                  <td>{permission.label}</td>
                  <td style={{ textAlign: "center" }}>
                    {permission.admin ? <CheckMark /> : <Dash />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {permission.projectManager ? <CheckMark /> : <Dash />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {permission.teamLead ? <CheckMark /> : <Dash />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {permission.participant ? <CheckMark /> : <Dash />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </>
  );
}

function TeamOrganizationView({
  teams,
  people
}: {
  teams: Team[];
  people: Person[];
}) {
  const personLookup = new Map(people.map((person) => [person.id, person]));

  return (
    <Surface
      title="团队侧组织架构"
      description="按团队树展示负责人和成员，飞书同步团队会保留外部标记。"
      flush
    >
      <table className="data-table">
        <colgroup>
          <col />
          <col style={{ width: 140 }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden="true" style={{ color: "var(--fg-subtle)" }}>▸</span>
                    <Link href="/admin/teams" style={{ color: "var(--fg-default)", fontWeight: 600 }}>
                      {team.name}
                    </Link>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 20 }}>
                    {(team.memberIds ?? []).map((personId) => {
                      const person = personLookup.get(personId);
                      return (
                        <Badge key={personId} tone={team.leadId === personId ? "success" : "default"}>
                          {team.leadId === personId ? "负责人：" : ""}
                          {person?.name ?? personId}
                        </Badge>
                      );
                    })}
                    {(team.memberIds?.length ?? 0) === 0 ? <span className="hint">暂无成员</span> : null}
                  </div>
                </div>
              </td>
              <td className="hint">{team.leadId ? personLookup.get(team.leadId)?.name ?? team.leadId : "未设置"}</td>
              <td>{team.externalId ? <Badge tone="accent">飞书</Badge> : <Badge tone="default">手动</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}

function ProjectPeopleView({
  projects,
  users,
  people
}: {
  projects: Project[];
  users: User[];
  people: Person[];
}) {
  const personLookup = new Map(people.map((person) => [person.id, person]));

  return (
    <Surface
      title="项目维度组织人员"
      description="点开项目可进入该项目成员页查看完整组织人员信息。"
      flush
    >
      <table className="data-table">
        <colgroup>
          <col />
          <col style={{ width: 180 }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <tbody>
          {projects.map((project) => {
            const members = users.filter(
              (user) =>
                user.managedProjectIds.includes(project.id) ||
                user.participatingProjectIds.includes(project.id)
            );
            const depth = getProjectDepth(project, projects);

            return (
              <tr key={project.id}>
                <td>
                  <div style={{ paddingLeft: depth * 18 }}>
                    <Link
                      href={`/projects/${project.identifier}/members`}
                      style={{ color: "var(--fg-default)", fontWeight: 600 }}
                    >
                      {project.name}
                    </Link>
                    <p className="hint mono" style={{ margin: "2px 0 0", fontSize: 11 }}>
                      {project.identifier}
                    </p>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {members.slice(0, 4).map((user) => {
                      const person = personLookup.get(user.personId);
                      const isLead = user.managedProjectIds.includes(project.id);
                      return (
                        <Badge key={user.id} tone={isLead ? "success" : "default"}>
                          {isLead ? "负责人：" : ""}
                          {person?.name ?? user.name}
                        </Badge>
                      );
                    })}
                    {members.length > 4 ? <span className="hint">+{members.length - 4}</span> : null}
                    {members.length === 0 ? <span className="hint">暂无成员</span> : null}
                  </div>
                </td>
                <td>
                  <Link href={`/projects/${project.identifier}/members`} className="btn" data-size="sm" data-variant="ghost">
                    查看
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Surface>
  );
}

function getProjectDepth(project: Project, projects: Project[]) {
  let depth = 0;
  let parentId = project.parentId;
  while (parentId) {
    const parent = projects.find((item) => item.id === parentId);
    if (!parent) {
      break;
    }
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

function CheckMark() {
  return (
    <span style={{ color: "var(--success-fg)", fontWeight: 600 }} aria-label="允许">
      ✓
    </span>
  );
}

function Dash() {
  return (
    <span style={{ color: "var(--fg-subtle)" }} aria-label="不允许">
      —
    </span>
  );
}
