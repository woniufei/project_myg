import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { TeamsTree } from "@/components/admin/TeamsTree";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadPeople() {
  const { snapshot } = await getShellRequestContext();
  return snapshot.people.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    externalId: p.externalId,
    departmentName: p.departmentName
  }));
}

async function loadTeams(): Promise<Team[]> {
  const { listTeams } = await import("@/lib/services/team-workflow");
  return listTeams();
}

export default async function AdminTeamsPage() {
  const [people, teams, { currentUser }] = await Promise.all([
    loadPeople(),
    loadTeams(),
    getShellRequestContext()
  ]);

  const isAdmin = currentUser?.role === "admin";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "管理员", href: "/admin" },
          { label: "团队管理" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">团队管理</h1>
          <p className="page-subtitle">
            管理团队结构、负责人及成员。飞书同步来的团队将自动标记。
          </p>
        </div>
        {!isAdmin && (
          <p className="hint" style={{ fontSize: 13, color: "var(--fg-subtle)" }}>
            只读视图 — 仅平台管理员可编辑团队。
          </p>
        )}
      </header>

      <TeamsTree teamsPromise={Promise.resolve(teams)} people={people} />
    </>
  );
}