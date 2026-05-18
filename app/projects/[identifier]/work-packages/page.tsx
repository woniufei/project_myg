import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProjectWorkPackagesView } from "@/components/work-packages/ProjectWorkPackagesView";
import { listNotificationMessages } from "@/lib/services/notification-center";
import { listProjectTeamLeadCandidates } from "@/lib/services/project-workflow";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectWorkPackagesPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot, currentUser } = await getShellRequestContext();

  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }

  const projectWorkPackages = snapshot.workPackages.filter((wp) => wp.projectId === project.id);
  const comments = snapshot.workPackageComments.filter((comment) =>
    projectWorkPackages.some((wp) => wp.id === comment.workPackageId)
  );
  const approvals = snapshot.workPackageApprovals.filter((approval) =>
    projectWorkPackages.some((wp) => wp.id === approval.workPackageId)
  );
  const notificationMessages = currentUser
    ? (await listNotificationMessages(currentUser)).filter((message) =>
        message.projectId === project.id &&
        Boolean(message.workPackageId && projectWorkPackages.some((wp) => wp.id === message.workPackageId))
      )
    : [];
  const teamLeadCandidates = await listProjectTeamLeadCandidates();
  const peopleById = new Map(snapshot.people.map((person) => [person.id, person]));
  const teamLeadPeople = teamLeadCandidates
    .map((candidate) => peopleById.get(candidate.personId))
    .filter((person): person is (typeof snapshot.people)[number] => Boolean(person));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "工作项" }
        ]}
      />
      <ProjectWorkPackagesView
        project={project}
        workPackages={projectWorkPackages}
        allWorkPackages={snapshot.workPackages}
        projects={snapshot.projects}
        comments={comments}
        approvals={approvals}
        notificationMessages={notificationMessages}
        people={snapshot.people}
        teamLeadCandidates={teamLeadPeople}
        currentUser={currentUser}
      />
    </div>
  );
}
