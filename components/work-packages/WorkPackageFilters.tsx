"use client";

import { Select } from "@/components/primer/Select";
import { Input } from "@/components/primer/Input";
import { statusLabel, typeLabel } from "@/lib/work-package-presentation";
import type { Person, Project, WorkPackageType } from "@/lib/types";

export interface WorkPackageFilterValue {
  type: WorkPackageType | "all";
  status: string;
  assigneeId: string;
  projectId: string;
  query: string;
}

interface WorkPackageFiltersProps {
  value: WorkPackageFilterValue;
  onChange: (value: WorkPackageFilterValue) => void;
  people: Person[];
  projects?: Project[];
  statusOptions: string[];
}

export const ALL_TYPES: WorkPackageType[] = ["task", "milestone", "risk", "phase"];

/**
 * Filter row above OpenProject-style work-package tables. Compact, label-on-top
 * style that adapts the project column for cross-project usage.
 */
export function WorkPackageFilters({
  value,
  onChange,
  people,
  projects,
  statusOptions
}: WorkPackageFiltersProps) {
  function update<K extends keyof WorkPackageFilterValue>(key: K, next: WorkPackageFilterValue[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        alignItems: "end"
      }}
    >
      <div>
        <label className="label">类型</label>
        <Select
          value={value.type}
          onChange={(event) => update("type", event.target.value as WorkPackageFilterValue["type"])}
        >
          <option value="all">全部</option>
          {ALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="label">状态</label>
        <Select value={value.status} onChange={(event) => update("status", event.target.value)}>
          <option value="all">全部</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="label">负责人</label>
        <Select value={value.assigneeId} onChange={(event) => update("assigneeId", event.target.value)}>
          <option value="all">全部</option>
          <option value="unassigned">未分配</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      </div>
      {projects ? (
        <div>
          <label className="label">项目</label>
          <Select value={value.projectId} onChange={(event) => update("projectId", event.target.value)}>
            <option value="all">全部</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <label className="label">搜索</label>
        <Input
          value={value.query}
          placeholder="按主题或描述过滤"
          onChange={(event) => update("query", event.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * Filters work packages in memory based on the current filter value.
 */
export function filterWorkPackages<T extends import("@/lib/types").WorkPackage>(
  workPackages: T[],
  filter: WorkPackageFilterValue
): T[] {
  return workPackages.filter((wp) => {
    if (filter.type !== "all" && wp.type !== filter.type) {
      return false;
    }
    if (filter.status !== "all" && wp.status !== filter.status) {
      return false;
    }
    if (filter.assigneeId === "unassigned" && (wp.assigneeId || (wp.assignments?.length ?? 0) > 0)) {
      return false;
    }
    if (
      filter.assigneeId !== "all" &&
      filter.assigneeId !== "unassigned" &&
      wp.assigneeId !== filter.assigneeId &&
      !wp.assignments?.some((assignment) => assignment.personId === filter.assigneeId)
    ) {
      return false;
    }
    if (filter.projectId !== "all" && wp.projectId !== filter.projectId) {
      return false;
    }
    if (filter.query.trim()) {
      const needle = filter.query.toLowerCase();
      if (!wp.subject.toLowerCase().includes(needle) && !wp.description.toLowerCase().includes(needle)) {
        return false;
      }
    }
    return true;
  });
}
