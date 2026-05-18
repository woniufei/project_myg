import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PermissionOverridesPanel } from "@/components/admin/PermissionOverridesPanel";
import { UsersTable } from "@/components/admin/UsersTable";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { listTeams } from "@/lib/services/team-workflow";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const teams = await listTeams();

  const isAdmin = currentUser?.role === "admin";

  // 非 admin 用户只能只读查看
  const people = snapshot.people.map((p) => ({
    id: p.id,
    name: p.name,
    externalId: p.externalId,
    departmentName: p.departmentName
  }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "管理员", href: "/admin" },
          { label: "用户管理" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">用户管理</h1>
          <p className="page-subtitle">
            管理平台用户的角色分配与外部源标记。
          </p>
        </div>
        {!isAdmin && (
          <p className="hint" style={{ fontSize: 13, color: "var(--fg-subtle)" }}>
            只读视图 — 仅平台管理员可编辑角色。
          </p>
        )}
      </header>

      <UsersTable users={snapshot.users} people={people} canEdit={isAdmin} />
      {isAdmin ? (
        <PermissionOverridesPanel
          currentUser={currentUser}
          users={snapshot.users}
          projects={snapshot.projects}
          teams={teams}
        />
      ) : null}
    </>
  );
}