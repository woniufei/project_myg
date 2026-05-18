import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlobalSidebar } from "@/components/layout/GlobalSidebar";
import { listPlatformFeatureFlags } from "@/lib/services/feature-flags";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

/**
 * Layout for routes living outside any specific project context.
 * Loads the workspace snapshot once and renders the global sidebar.
 */
export default async function GlobalLayout({ children }: { children: ReactNode }) {
  const { snapshot, currentUser } = await getShellRequestContext();
  const flags = await listPlatformFeatureFlags();

  return (
    <AppShell
      projects={snapshot.projects}
      currentUser={currentUser}
      sidebar={<GlobalSidebar flags={flags} projects={snapshot.projects} currentUser={currentUser} />}
    >
      {children}
    </AppShell>
  );
}
