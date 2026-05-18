"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import {
  ColumnConfigurator,
  useColumnPreferences,
  type ListColumn
} from "./ColumnConfigurator";
import {
  getStatusTone,
  priorityLabel,
  priorityTone,
  statusLabel,
  typeLabel,
  typeTone
} from "@/lib/work-package-presentation";
import type { Person, Project, WorkPackage } from "@/lib/types";

interface WorkPackageColumn extends ListColumn {
  width?: number;
  render: (workPackage: WorkPackage) => ReactNode;
}

interface WorkPackageTableProps {
  workPackages: WorkPackage[];
  projects: Project[];
  people: Person[];
  selectedId?: number;
  /** When provided, clicking a row selects it (split-screen view). */
  onSelect?: (workPackage: WorkPackage) => void;
  /**
   * When provided, the table emits links instead of selecting a row.
   * Used by the cross-project view to navigate into the project context.
   */
  hrefBuilder?: (workPackage: WorkPackage, project?: Project) => string;
}

/**
 * OpenProject-style work-package table with fixed column widths so badges
 * never wrap. Supports either row-selection or row-links.
 */
export function WorkPackageTable({
  workPackages,
  projects,
  people,
  selectedId,
  onSelect,
  hrefBuilder
}: WorkPackageTableProps) {
  const projectLookup = new Map(projects.map((project) => [project.id, project]));
  const personLookup = new Map(people.map((person) => [person.id, person]));
  const showProjectColumn = Boolean(hrefBuilder);
  const baseColumns: WorkPackageColumn[] = [
    {
      id: "type",
      label: "类型",
      width: 80,
      render: (wp) => <Badge tone={typeTone(wp.type)}>{typeLabel(wp.type)}</Badge>
    },
    { id: "id", label: "ID", width: 50, render: (wp) => <span className="hint mono">#{wp.id}</span> },
    {
      id: "subject",
      label: "主题",
      render: (wp) => {
        const project = wp.projectId ? projectLookup.get(wp.projectId) : undefined;
        const href = hrefBuilder ? hrefBuilder(wp, project) : undefined;
        return href ? (
          <Link href={href} style={{ color: "var(--fg-default)", fontWeight: 500 }}>
            {wp.subject}
          </Link>
        ) : (
          <span style={{ fontWeight: 500 }}>{wp.subject}</span>
        );
      }
    },
    {
      id: "status",
      label: "状态",
      width: 100,
      render: (wp) => <Badge tone={getStatusTone(wp.status)}>{statusLabel(wp.status)}</Badge>
    },
    {
      id: "priority",
      label: "优先级",
      width: 80,
      render: (wp) => <Badge tone={priorityTone(wp.priority)}>{priorityLabel(wp.priority)}</Badge>
    },
    {
      id: "assignee",
      label: "负责人",
      width: 120,
      render: (wp) => {
        const assignments = wp.assignments ?? [];
        if (assignments.length > 0) {
          const names = assignments
            .slice(0, 2)
            .map((assignment) => personLookup.get(assignment.personId)?.name ?? assignment.personId)
            .join("、");
          return (
            <span
              className="hint"
              title={assignments
                .map((assignment) => {
                  const name = personLookup.get(assignment.personId)?.name ?? assignment.personId;
                  return `${name}（${assignment.role}）：${assignment.responsibility || "未填写分工"}`;
                })
                .join("\n")}
            >
              {names}{assignments.length > 2 ? ` 等 ${assignments.length} 人` : ""}
            </span>
          );
        }
        const assignee = wp.assigneeId ? personLookup.get(wp.assigneeId) : undefined;
        return <span className="hint">{assignee ? assignee.name : "—"}</span>;
      }
    },
    {
      id: "project",
      label: "项目",
      width: 160,
      render: (wp) => {
        const project = wp.projectId ? projectLookup.get(wp.projectId) : undefined;
        return (
          <span className="hint">
            {project ? <Link href={`/projects/${project.identifier}/overview`}>{project.name}</Link> : "—"}
          </span>
        );
      }
    },
    {
      id: "progress",
      label: "进度",
      width: 90,
      render: (wp) => <span className="hint mono">{wp.percentComplete}%</span>
    },
    {
      id: "dueDate",
      label: "截止",
      width: 100,
      render: (wp) => (
        <span className="hint mono">
          {wp.dueDate ? new Date(wp.dueDate).toISOString().slice(0, 10) : "—"}
        </span>
      )
    }
  ];
  const columns = baseColumns.filter((column) => showProjectColumn || column.id !== "project");
  const {
    orderedColumns,
    visibleColumns,
    visibleIds,
    toggleColumn,
    moveColumn
  } = useColumnPreferences(showProjectColumn ? "work-package-table-global" : "work-package-table-project", columns);

  if (workPackages.length === 0) {
    return (
      <EmptyState
        title="暂无工作项"
        description="尝试调整筛选条件，或在工作项列表创建新条目。"
      />
    );
  }

  return (
    <div className="surface" data-flush="true">
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px" }}>
        <ColumnConfigurator
          columns={orderedColumns}
          visibleIds={visibleIds}
          onToggle={toggleColumn}
          onMove={moveColumn}
        />
      </div>
      <div className="scroll-x">
        <table className="data-table" style={{ minWidth: Math.max(520, visibleColumns.length * 110) }}>
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.id} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workPackages.map((wp) => {
              const isSelected = selectedId === wp.id;
              const handleClick = onSelect ? () => onSelect(wp) : undefined;
              const isClickable = Boolean(handleClick || hrefBuilder);
              return (
                <tr
                  key={wp.id}
                  data-clickable={isClickable ? "true" : undefined}
                  data-selected={isSelected ? "true" : undefined}
                  onClick={handleClick}
                >
                  {visibleColumns.map((column) => (
                    <td key={column.id}>{column.render(wp)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
