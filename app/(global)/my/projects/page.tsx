import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { ProjectDeleteButton } from "@/components/projects/ProjectDeleteButton";
import { roleLabels } from "@/lib/rbac";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { Project } from "@/lib/types";
import { projectStatusLabel, projectStatusTone } from "@/lib/work-package-presentation";

export const dynamic = "force-dynamic";

export default async function MyProjectsPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const myProjects = currentUser
    ? snapshot.projects.filter((project) =>
        currentUser.managedProjectIds.includes(project.id) ||
        currentUser.participatingProjectIds.includes(project.id)
      )
    : [];

  return (
    <>
      <Breadcrumb items={[{ label: "我的项目" }]} />

      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">我的项目</h1>
          <p className="page-subtitle">
            {currentUser
              ? `${roleLabels[currentUser.role]}当前参与或负责的项目，包含主项目与子项目。`
              : "请先在右上角选择一个演示账号。"}
          </p>
        </div>
        {currentUser?.role === "projectManager" ? (
          <Link href="/projects/new" className="btn" data-size="sm" data-variant="primary">
            添加项目
          </Link>
        ) : null}
      </header>

      <Surface title={`我的项目 (${myProjects.length})`} description="进入项目后可继续查看阶段、工作项、成员与看板。" flush>
        {myProjects.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState title="暂无参与项目" description="当前账号还没有关联到负责或参与的项目。" />
          </div>
        ) : (
          <MyProjectsTable projects={myProjects} currentUserId={currentUser?.id} />
        )}
      </Surface>
    </>
  );
}

function MyProjectsTable({ projects, currentUserId }: { projects: Project[]; currentUserId?: string }) {
  return (
    <div className="scroll-x">
      <table className="data-table" style={{ minWidth: 640 }}>
        <colgroup>
          <col />
          <col style={{ width: 120 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 96 }} />
        </colgroup>
        <thead>
          <tr>
            <th>项目</th>
            <th>状态</th>
            <th>健康度</th>
            <th>进度</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
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
              </td>
              <td>
                <Badge tone={projectStatusTone(project.status)}>{projectStatusLabel(project.status)}</Badge>
              </td>
              <td>
                <Badge
                  tone={
                    project.health === "High"
                      ? "danger"
                      : project.health === "Medium"
                        ? "attention"
                        : "success"
                  }
                >
                  {project.health}
                </Badge>
              </td>
              <td className="hint mono">{project.progress}%</td>
              <td>
                {currentUserId && project.createdByUserId === currentUserId ? (
                  <ProjectDeleteButton
                    identifier={project.identifier}
                    projectName={project.name}
                    currentUserId={currentUserId}
                  />
                ) : (
                  <span className="hint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
