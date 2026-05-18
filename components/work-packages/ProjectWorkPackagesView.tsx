"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WorkPackageFilters,
  filterWorkPackages,
  type WorkPackageFilterValue
} from "./WorkPackageFilters";
import { WorkPackageTable } from "./WorkPackageTable";
import { WorkPackageDetailPane } from "./WorkPackageDetailPane";
import { Button } from "@/components/primer/Button";
import { Surface } from "@/components/primer/Surface";
import type {
  Person,
  Project,
  User,
  WorkPackage,
  WorkPackageApproval,
  WorkPackageComment,
  NotificationMessage
} from "@/lib/types";

interface ProjectWorkPackagesViewProps {
  project: Project;
  workPackages: WorkPackage[];
  allWorkPackages?: WorkPackage[];
  projects?: Project[];
  comments: WorkPackageComment[];
  approvals: WorkPackageApproval[];
  notificationMessages?: NotificationMessage[];
  people: Person[];
  teamLeadCandidates?: Person[];
  currentUser?: User;
  initialSelectedId?: number;
}

/**
 * OpenProject-style "table + detail pane" work-package view. Filters live
 * in a compact bar above the table; clicking a row opens the right pane.
 */
export function ProjectWorkPackagesView({
  project,
  workPackages,
  allWorkPackages = workPackages,
  projects = [project],
  comments,
  approvals,
  notificationMessages = [],
  people,
  teamLeadCandidates = [],
  currentUser,
  initialSelectedId
}: ProjectWorkPackagesViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<WorkPackageFilterValue>({
    type: "all",
    status: "all",
    assigneeId: "all",
    projectId: "all",
    query: ""
  });
  const [selectedId, setSelectedId] = useState<number | undefined>(
    initialSelectedId ?? workPackages[0]?.id
  );

  const filtered = useMemo(() => filterWorkPackages(workPackages, filter), [filter, workPackages]);
  const statusOptions = useMemo(
    () => Array.from(new Set(workPackages.map((wp) => wp.status))).sort(),
    [workPackages]
  );
  const selected = useMemo(
    () => workPackages.find((wp) => wp.id === selectedId),
    [workPackages, selectedId]
  );
  const canCreateProjectWorkPackage =
    currentUser?.role === "projectManager" || currentUser?.role === "teamLead";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Surface
        title="筛选"
        description={`显示 ${filtered.length} / ${workPackages.length} 个工作项`}
        actions={
          canCreateProjectWorkPackage ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(`/projects/${project.identifier}/work-packages/new`)}
            >
              <PlusIcon /> 新建工作项
            </Button>
          ) : null
        }
      >
        <WorkPackageFilters
          value={filter}
          onChange={setFilter}
          people={people}
          statusOptions={statusOptions}
        />
      </Surface>

      <div className="split-pane">
        <WorkPackageTable
          workPackages={filtered}
          projects={[project]}
          people={people}
          selectedId={selected?.id}
          onSelect={(wp) => setSelectedId(wp.id)}
        />
        <div className="split-pane__detail">
          {selected ? (
            <WorkPackageDetailPane
              key={selected.id}
              workPackage={selected}
              project={project}
              people={people}
              teamLeadCandidates={teamLeadCandidates}
              comments={comments}
              approvals={approvals}
              notificationMessages={notificationMessages.filter((message) => message.workPackageId === selected.id)}
              childWorkPackages={workPackages.filter((wp) => wp.parentId === selected.id)}
              allWorkPackages={allWorkPackages}
              projects={projects}
              currentUser={currentUser}
              onClose={() => setSelectedId(undefined)}
            />
          ) : (
            <Surface
              title="选择一项工作项"
              description="点击左侧表格的任意行可在此查看详情、更新进展、添加评论或签核。"
            >
              <p className="hint" style={{ margin: 0 }}>
                未选中任何工作项。
              </p>
            </Surface>
          )}
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
