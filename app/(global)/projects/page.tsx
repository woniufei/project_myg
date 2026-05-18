import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProjectTree } from "@/components/projects/ProjectTree";
import { Surface } from "@/components/primer/Surface";
import { canUser, filterProjectsForRole } from "@/lib/rbac";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { snapshot, currentUser } = await getShellRequestContext();

  const visibleProjects = filterProjectsForRole(snapshot.projects, currentUser);

  const canManage = canUser(currentUser, "manageProjects");

  return (
    <>
      <Breadcrumb items={[{ label: "项目" }]} />

      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">所有项目</h1>
          <p className="page-subtitle">
            按层级展示所有项目，子项目缩进显示。点击项目名称进入项目工作台。
          </p>
        </div>
        {canManage ? (
          <div className="page-header__actions">
            <Link href="/projects/new" className="btn" data-variant="primary">
              新建项目
            </Link>
          </div>
        ) : null}
      </header>

      <Surface
        title={`项目 (${visibleProjects.length})`}
        description="使用项目层级管理跨团队、跨业务线的工作。"
        flush
      >
        <ProjectTree projects={visibleProjects} />
      </Surface>
    </>
  );
}
