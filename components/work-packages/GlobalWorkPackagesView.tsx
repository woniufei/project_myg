"use client";

import { useMemo, useState } from "react";
import { Surface } from "@/components/primer/Surface";
import {
  WorkPackageFilters,
  filterWorkPackages,
  type WorkPackageFilterValue
} from "./WorkPackageFilters";
import { WorkPackageTable } from "./WorkPackageTable";
import type { Person, Project, WorkPackage } from "@/lib/types";

interface GlobalWorkPackagesViewProps {
  workPackages: WorkPackage[];
  projects: Project[];
  people: Person[];
}

/**
 * Cross-project work-package list rendered at /work-packages.
 * Each row links into the work package detail inside its project context.
 */
export function GlobalWorkPackagesView({
  workPackages,
  projects,
  people
}: GlobalWorkPackagesViewProps) {
  const [filter, setFilter] = useState<WorkPackageFilterValue>({
    type: "all",
    status: "all",
    assigneeId: "all",
    projectId: "all",
    query: ""
  });

  const filtered = useMemo(() => filterWorkPackages(workPackages, filter), [filter, workPackages]);
  const statusOptions = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.status))).sort(),
    [workPackages]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Surface title="筛选" description={`显示 ${filtered.length} / ${workPackages.length} 个工作项`}>
        <WorkPackageFilters
          value={filter}
          onChange={setFilter}
          people={people}
          projects={projects}
          statusOptions={statusOptions}
        />
      </Surface>
      <WorkPackageTable
        workPackages={filtered}
        projects={projects}
        people={people}
        hrefBuilder={(wp, project) =>
          project
            ? `/projects/${project.identifier}/work-packages/${wp.id}?returnTo=/work-packages`
            : `/work-packages?focus=${wp.id}`
        }
      />
    </div>
  );
}
