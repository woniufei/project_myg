import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProjectWorkPackageCreateForm } from "./ProjectWorkPackageCreateForm";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function NewProjectWorkPackagePage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot, currentUser } = await getShellRequestContext();

  const project = snapshot.projects.find((p) => p.identifier === identifier);
  if (!project) {
    notFound();
  }

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 }}>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "工作项", href: `/projects/${project.identifier}/work-packages` },
          { label: "新建工作项" }
        ]}
      />

      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">新建工作项</h1>
          <p className="page-subtitle">
            项目经理补充阶段；团队负责人可在阶段下创建节点，并在节点下创建任务。
          </p>
        </div>
      </header>

      <ProjectWorkPackageCreateForm
        currentUser={currentUser}
        projectId={project.id}
        projectName={project.name}
        projectIdentifier={project.identifier}
        people={snapshot.people}
        workPackages={snapshot.workPackages.filter((wp) => wp.projectId === project.id)}
      />
    </div>
  );
}