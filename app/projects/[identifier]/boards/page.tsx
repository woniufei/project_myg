import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { KanbanBoard } from "@/components/boards/KanbanBoard";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

const TASK_COLUMNS = ["todo", "review", "reviewFailed", "inProgress", "blocked", "done"];

export default async function ProjectBoardsPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }

  const taskWorkPackages = snapshot.workPackages.filter(
    (wp) => wp.projectId === project.id && wp.type !== "risk"
  );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "看板" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">看板</h1>
          <p className="page-subtitle">按工作项状态分组的 Kanban 视图。点击卡片查看详情。</p>
        </div>
      </header>
      <KanbanBoard
        workPackages={taskWorkPackages}
        project={project}
        people={snapshot.people}
        columns={TASK_COLUMNS}
      />
    </>
  );
}
