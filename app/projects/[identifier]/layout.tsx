import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlobalSidebar } from "@/components/layout/GlobalSidebar";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { userHasRole } from "@/lib/rbac";
import { listPlatformFeatureFlags } from "@/lib/services/feature-flags";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface ProjectLayoutProps {
  params: Promise<{ identifier: string }>;
  children: ReactNode;
}

export default async function ProjectLayout({ params, children }: ProjectLayoutProps) {
  const { identifier } = await params;
  const { snapshot, currentUser } = await getShellRequestContext();
  const flags = await listPlatformFeatureFlags();

  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }
  const useWorkspaceSidebar =
    userHasRole(currentUser, "projectManager") || userHasRole(currentUser, "teamLead");

  return (
    <AppShell
      projects={snapshot.projects}
      currentUser={currentUser}
      currentProjectIdentifier={identifier}
      sidebar={
        useWorkspaceSidebar ? (
          <GlobalSidebar
            flags={flags}
            projects={snapshot.projects}
            currentUser={currentUser}
            contextualProject={project}
          />
        ) : (
          <ProjectSidebar project={project} currentUser={currentUser} />
        )
      }
    >
      {children}
    </AppShell>
  );
}
