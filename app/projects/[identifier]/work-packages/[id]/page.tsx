import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Surface } from "@/components/primer/Surface";
import { WorkPackageDetailPane } from "@/components/work-packages/WorkPackageDetailPane";
import { listWorkPackageNotificationHistory } from "@/lib/services/notification-center";
import { listProjectTeamLeadCandidates } from "@/lib/services/project-workflow";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string; id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}

export default async function WorkPackageDetailPage({ params, searchParams }: PageProps) {
  const { identifier, id } = await params;
  const resolvedSearchParams = await searchParams;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    notFound();
  }

  const { snapshot, currentUser } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  const workPackage = snapshot.workPackages.find((wp) => wp.id === numericId);

  if (!project || !workPackage || workPackage.projectId !== project.id) {
    notFound();
  }
  const notificationMessages = currentUser
    ? await listWorkPackageNotificationHistory(project.id, workPackage.id, currentUser)
    : [];
  const teamLeadCandidates = await listProjectTeamLeadCandidates();
  const peopleById = new Map(snapshot.people.map((person) => [person.id, person]));
  const teamLeadPeople = teamLeadCandidates
    .map((candidate) => peopleById.get(candidate.personId))
    .filter((person): person is (typeof snapshot.people)[number] => Boolean(person));
  const listHref = normalizeReturnTo(resolvedSearchParams?.returnTo) ??
    `/projects/${project.identifier}/work-packages`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          {
            label: "工作项",
            href: listHref
          },
          { label: `#${workPackage.id}` }
        ]}
      />

      <Surface
        title="工作项详情"
        actions={
          <Link
            href={listHref}
            className="btn"
            data-size="sm"
          >
            返回列表
          </Link>
        }
      >
        <WorkPackageDetailPane
          workPackage={workPackage}
          project={project}
          people={snapshot.people}
          teamLeadCandidates={teamLeadPeople}
          comments={snapshot.workPackageComments}
          approvals={snapshot.workPackageApprovals}
          notificationMessages={notificationMessages}
          childWorkPackages={snapshot.workPackages.filter((wp) => wp.parentId === workPackage.id)}
          allWorkPackages={snapshot.workPackages}
          projects={snapshot.projects}
          currentUser={currentUser}
        />
      </Surface>
    </div>
  );
}

/**
 * Keeps detail-page back navigation inside known list pages so cross-page
 * jumps do not surface action buttons from a different page context.
 */
function normalizeReturnTo(value: string | undefined) {
  if (value === "/work-packages" || value === "/my/page") {
    return value;
  }

  return undefined;
}
