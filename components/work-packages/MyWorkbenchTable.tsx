"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import { WorkPackageDetailPane } from "@/components/work-packages/WorkPackageDetailPane";
import {
  getStatusTone,
  originLabel,
  originTone,
  priorityLabel,
  priorityTone,
  statusLabel,
  typeLabel,
  typeTone
} from "@/lib/work-package-presentation";
import { getDerivedWorkPackageStatusTags } from "@/lib/work-package-status";
import type {
  Person,
  Project,
  User,
  WorkPackage,
  WorkPackageApproval,
  WorkPackageComment,
  WorkPackageStatus
} from "@/lib/types";
import {
  ColumnConfigurator,
  useColumnPreferences,
  type ListColumn
} from "./ColumnConfigurator";
import { userHasRole } from "@/lib/rbac";

interface MyWorkbenchTableProps {
  currentUser?: User;
  workPackages: WorkPackage[];
  allWorkPackages?: WorkPackage[];
  projects: Project[];
  people: Person[];
  comments?: WorkPackageComment[];
  approvals?: WorkPackageApproval[];
}

interface MyWorkbenchColumn extends ListColumn {
  width?: number;
  render: (workPackage: WorkPackage, row: WorkbenchRow) => ReactNode;
}

interface WorkbenchRow {
  workPackage: WorkPackage;
  level: number;
}

interface InlineEditDraft {
  percentComplete: number;
  status: WorkPackageStatus;
}

const WORK_PACKAGE_STATUS_OPTIONS: WorkPackageStatus[] = [
  "todo",
  "inProgress",
  "review",
  "done",
  "blocked"
];

/**
 * Renders the unified My Workbench list: assigned work plus items created by me.
 */
export function MyWorkbenchTable({
  currentUser,
  workPackages,
  allWorkPackages = workPackages,
  projects,
  people,
  comments = [],
  approvals = []
}: MyWorkbenchTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetProjects, setTargetProjects] = useState<Record<number, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<number, InlineEditDraft>>({});
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | undefined>();
  const projectLookup = new Map(projects.map((project) => [project.id, project]));
  const personLookup = new Map(people.map((person) => [person.id, person]));
  const hierarchicalRows = buildWorkbenchRows(workPackages);
  const selectedPhase = selectedPhaseId
    ? workPackages.find((workPackage) => workPackage.id === selectedPhaseId && workPackage.type === "phase")
    : undefined;
  const selectedPhaseProject = selectedPhase?.projectId ? projectLookup.get(selectedPhase.projectId) : undefined;

  async function deleteWorkPackage(workPackage: WorkPackage) {
    if (!currentUser || !confirm(`确认删除 #${workPackage.id} ${workPackage.subject}？`)) {
      return;
    }

    setBusyId(workPackage.id);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "DELETE",
        headers: { "x-user-id": currentUser.id }
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "删除失败。");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    } finally {
      setBusyId(null);
    }
  }

  async function attachToProject(workPackage: WorkPackage) {
    if (!currentUser) {
      return;
    }

    const nextProjectId = targetProjects[workPackage.id];
    if (!nextProjectId) {
      setError("请先选择要挂载的项目。");
      return;
    }

    setBusyId(workPackage.id);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({ projectId: nextProjectId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "挂载项目失败。");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "挂载项目失败。");
    } finally {
      setBusyId(null);
    }
  }

  function startInlineEdit(workPackage: WorkPackage) {
    setEditDrafts((current) => ({
      ...current,
      [workPackage.id]: current[workPackage.id] ?? {
        percentComplete: workPackage.percentComplete,
        status: workPackage.status
      }
    }));
  }

  function cancelInlineEdit(workPackageId: number) {
    setEditDrafts((current) => {
      const next = { ...current };
      delete next[workPackageId];
      return next;
    });
  }

  async function saveInlineEdit(workPackage: WorkPackage) {
    if (!currentUser) {
      return;
    }

    const draft = editDrafts[workPackage.id];
    if (!draft) {
      return;
    }

    const payload: {
      percentComplete: number;
      status?: WorkPackageStatus;
    } = {
      percentComplete: clampProgress(draft.percentComplete)
    };
    if (canEditStatus()) {
      payload.status = draft.status;
    }

    setBusyId(workPackage.id);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "更新进度失败。");
      }
      cancelInlineEdit(workPackage.id);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新进度失败。");
    } finally {
      setBusyId(null);
    }
  }

  function isOwnedByCurrentUser(workPackage: WorkPackage) {
    return Boolean(
      currentUser &&
        (workPackage.createdByUserId === currentUser.id ||
          workPackage.assigneeId === currentUser.personId ||
          workPackage.assignments?.some((assignment) => assignment.personId === currentUser.personId))
    );
  }

  function canEditStatus() {
    return Boolean(
      currentUser &&
        (userHasRole(currentUser, "admin") ||
          userHasRole(currentUser, "projectManager") ||
          userHasRole(currentUser, "teamLead"))
    );
  }

  function canEditProgressFor(workPackage: WorkPackage) {
    return Boolean(
      canEditStatus() ||
        (currentUser &&
          workPackage.status === "inProgress" &&
          isOwnedByCurrentUser(workPackage))
    );
  }

  function renderStatusCell(workPackage: WorkPackage) {
    const draft = editDrafts[workPackage.id];
    if (draft && canEditStatus()) {
      return (
        <Select
          aria-label={`修改 #${workPackage.id} 状态`}
          value={draft.status}
          disabled={busyId === workPackage.id}
          onChange={(event) =>
            setEditDrafts((current) => ({
              ...current,
              [workPackage.id]: {
                ...(current[workPackage.id] ?? draft),
                status: event.target.value as WorkPackageStatus
              }
            }))
          }
        >
          {WORK_PACKAGE_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </Select>
      );
    }

    const derivedTags = getDerivedWorkPackageStatusTags(workPackage, allWorkPackages, projects);
    const shouldCompactHistoryTags = workPackage.status === "inProgress" && derivedTags.length > 0;
    const badges = (
      <>
        <Badge
          tone={getStatusTone(workPackage.status)}
          data-emphasis={shouldCompactHistoryTags ? "primary" : undefined}
        >
          {statusLabel(workPackage.status)}
        </Badge>
        {derivedTags.map((tag) => (
          <Badge
            key={tag.key}
            tone={tag.tone}
            title={tag.title}
            data-size={shouldCompactHistoryTags ? "sm" : undefined}
          >
            {tag.label}
          </Badge>
        ))}
      </>
    );

    if (!canEditStatus()) {
      return <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{badges}</div>;
    }

    return (
      <button
        type="button"
        title="点击修改状态"
        onClick={() => startInlineEdit(workPackage)}
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          border: 0,
          padding: 0,
          background: "transparent",
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        {badges}
      </button>
    );
  }

  function renderProgressCell(workPackage: WorkPackage) {
    const draft = editDrafts[workPackage.id];
    const canEditProgress = canEditProgressFor(workPackage);
    if (draft && canEditProgress) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Input
            aria-label={`修改 #${workPackage.id} 进度`}
            type="number"
            min={0}
            max={100}
            value={draft.percentComplete}
            disabled={busyId === workPackage.id}
            onChange={(event) =>
              setEditDrafts((current) => ({
                ...current,
                [workPackage.id]: {
                  ...(current[workPackage.id] ?? draft),
                  percentComplete: Number(event.target.value)
                }
              }))
            }
            style={{ width: 76 }}
          />
          <Button
            size="sm"
            variant="primary"
            disabled={busyId === workPackage.id}
            onClick={() => saveInlineEdit(workPackage)}
          >
            保存
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === workPackage.id}
            onClick={() => cancelInlineEdit(workPackage.id)}
          >
            取消
          </Button>
        </div>
      );
    }

    if (!canEditProgress) {
      return <span className="hint mono">{workPackage.percentComplete}%</span>;
    }

    return (
      <button
        type="button"
        title="点击更新进度"
        onClick={() => startInlineEdit(workPackage)}
        className="hint mono"
        style={{
          border: 0,
          padding: 0,
          background: "transparent",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3
        }}
      >
        {workPackage.percentComplete}%
      </button>
    );
  }

  const columns: MyWorkbenchColumn[] = [
    {
      id: "type",
      label: "类型",
      width: 70,
      render: (wp, row) => row.level > 0 ? null : <Badge tone={typeTone(wp.type)}>{typeLabel(wp.type)}</Badge>
    },
    { id: "id", label: "ID", width: 50, render: (wp) => <span className="hint mono">#{wp.id}</span> },
    {
      id: "subject",
      label: "主题",
      render: (wp, row) => {
        const project = wp.projectId ? projectLookup.get(wp.projectId) : undefined;
        const href = project
          ? `/projects/${project.identifier}/work-packages/${wp.id}?returnTo=/my/page`
          : `/work-packages?focus=${wp.id}`;
        const canOpenPhasePane = wp.type === "phase" && Boolean(project);
        return (
          <div style={{ paddingLeft: row.level * 18, display: "flex", alignItems: "center", gap: 6 }}>
            {row.level > 0 ? (
              <span aria-hidden="true" style={{ color: "var(--fg-subtle)" }}>↳</span>
            ) : null}
            {canOpenPhasePane ? (
              <button
                type="button"
                onClick={() => setSelectedPhaseId(wp.id)}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  color: "var(--fg-default)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "left",
                  textDecoration: selectedPhaseId === wp.id ? "underline" : "none",
                  textUnderlineOffset: 3
                }}
              >
                {wp.subject}
              </button>
            ) : (
              <Link href={href} style={{ color: "var(--fg-default)", fontSize: 14, fontWeight: 400 }}>
                {wp.subject}
              </Link>
            )}
          </div>
        );
      }
    },
    {
      id: "status",
      label: "状态",
      width: 180,
      render: (wp) => renderStatusCell(wp)
    },
    {
      id: "priority",
      label: "优先级",
      width: 80,
      render: (wp) => <Badge tone={priorityTone(wp.priority)}>{priorityLabel(wp.priority)}</Badge>
    },
    {
      id: "project",
      label: "项目",
      width: 150,
      render: (wp) => {
        const project = wp.projectId ? projectLookup.get(wp.projectId) : undefined;
        return (
          <span className="hint">
            {project ? <Link href={`/projects/${project.identifier}/overview`}>{project.name}</Link> : "个人事项"}
          </span>
        );
      }
    },
    {
      id: "progress",
      label: "进度",
      width: 190,
      render: (wp) => renderProgressCell(wp)
    },
    {
      id: "dueDate",
      label: "截止时间",
      width: 110,
      render: (wp) => (
        <span className="hint mono">
          {wp.dueDate ? new Date(wp.dueDate).toISOString().slice(0, 10) : "—"}
        </span>
      )
    },
    {
      id: "origin",
      label: "来源",
      width: 90,
      render: (wp) => <Badge tone={originTone(wp.origin)}>{originLabel(wp.origin)}</Badge>
    },
    {
      id: "members",
      label: "成员分工",
      width: 160,
      render: (wp) => (
        <span className="hint" title={assignmentDetailTitle(wp, personLookup)}>
          {assignmentSummary(wp, personLookup)}
        </span>
      )
    },
    {
      id: "actions",
      label: "操作",
      width: 260,
      render: (wp) => renderActions(wp)
    }
  ];
  const {
    orderedColumns,
    visibleColumns,
    visibleIds,
    toggleColumn,
    moveColumn
  } = useColumnPreferences("my-workbench-table", columns);

  function renderActions(wp: WorkPackage) {
    const canDelete =
      currentUser && wp.createdByUserId === currentUser.id;
    const canAttach =
      currentUser &&
      !wp.projectId &&
      wp.createdByUserId === currentUser.id;
    const project = wp.projectId ? projectLookup.get(wp.projectId) : undefined;
    const canConfigureMembers =
      currentUser &&
      project &&
      userHasRole(currentUser, "teamLead");
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {canConfigureMembers ? (
          <Link
            href={`/projects/${project.identifier}/work-packages/${wp.id}?returnTo=/my/page`}
            className="btn"
            data-size="sm"
            data-variant="ghost"
            title={assignmentDetailTitle(wp, personLookup)}
          >
            配置人员
          </Link>
        ) : null}
        {canAttach ? (
          <>
            <Select
              aria-label={`选择 #${wp.id} 要挂载的项目`}
              value={targetProjects[wp.id] ?? ""}
              onChange={(event) =>
                setTargetProjects((current) => ({
                  ...current,
                  [wp.id]: event.target.value
                }))
              }
              style={{ width: 130 }}
            >
              <option value="">挂到项目…</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === wp.id || !targetProjects[wp.id]}
              onClick={() => attachToProject(wp)}
            >
              挂载
            </Button>
          </>
        ) : null}
        {canDelete ? (
          <Button
            size="sm"
            variant="danger"
            disabled={busyId === wp.id}
            onClick={() => deleteWorkPackage(wp)}
          >
            删除
          </Button>
        ) : null}
      </div>
    );
  }

  const table = (
    <div style={{ display: "grid", gap: 8 }}>
      {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ColumnConfigurator
          columns={orderedColumns}
          visibleIds={visibleIds}
          onToggle={toggleColumn}
          onMove={moveColumn}
        />
      </div>
      <div className="scroll-x">
        <table className="data-table" style={{ minWidth: Math.max(560, visibleColumns.length * 110), fontSize: 14 }}>
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
            {hierarchicalRows.map((row) => {
              const wp = row.workPackage;
              return (
                <tr
                  key={wp.id}
                  data-clickable={wp.type === "phase" ? "true" : undefined}
                  data-selected={selectedPhaseId === wp.id ? "true" : undefined}
                >
                  {visibleColumns.map((column) => (
                    <td key={column.id}>{column.render(wp, row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!selectedPhase || !selectedPhaseProject) {
    return table;
  }

  return (
    <>
      {table}
      <div className="my-workbench-detail-drawer" aria-label="阶段详情">
        <WorkPackageDetailPane
          key={selectedPhase.id}
          workPackage={selectedPhase}
          project={selectedPhaseProject}
          people={people}
          comments={comments}
          approvals={approvals}
          childWorkPackages={allWorkPackages.filter((wp) => wp.parentId === selectedPhase.id)}
          allWorkPackages={allWorkPackages}
          projects={projects}
          currentUser={currentUser}
          onClose={() => setSelectedPhaseId(undefined)}
        />
      </div>
    </>
  );
}

/**
 * Builds a stable parent-child row list from the already scoped My Work set.
 * It never pulls extra parent or child rows from the wider workspace snapshot.
 */
function buildWorkbenchRows(workPackages: WorkPackage[]): WorkbenchRow[] {
  const selectedIds = new Set(workPackages.map((workPackage) => workPackage.id));
  const childrenByParent = new Map<number, WorkPackage[]>();
  const roots: WorkPackage[] = [];

  for (const workPackage of workPackages) {
    if (workPackage.parentId && selectedIds.has(workPackage.parentId)) {
      const siblings = childrenByParent.get(workPackage.parentId) ?? [];
      siblings.push(workPackage);
      childrenByParent.set(workPackage.parentId, siblings);
    } else {
      roots.push(workPackage);
    }
  }

  const selectedOrderIndex = new Map(workPackages.map((workPackage, index) => [workPackage.id, index]));
  const sortByInputOrder = (left: WorkPackage, right: WorkPackage) =>
    (selectedOrderIndex.get(left.id) ?? 0) - (selectedOrderIndex.get(right.id) ?? 0);
  roots.sort(sortByInputOrder);
  for (const children of childrenByParent.values()) {
    children.sort(sortByInputOrder);
  }

  const rows: WorkbenchRow[] = [];
  const walk = (workPackage: WorkPackage, level: number) => {
    rows.push({ workPackage, level });
    for (const child of childrenByParent.get(workPackage.id) ?? []) {
      walk(child, level + 1);
    }
  };

  roots.forEach((root) => walk(root, 0));
  return rows;
}

function assignmentSummary(workPackage: WorkPackage, personLookup: Map<string, Person>) {
  const assignments = workPackage.assignments ?? [];
  if (assignments.length > 0) {
    const names = assignments
      .slice(0, 2)
      .map((assignment) => personLookup.get(assignment.personId)?.name ?? assignment.personId)
      .join("、");
    return `${names}${assignments.length > 2 ? ` 等 ${assignments.length} 人` : ""}`;
  }

  return workPackage.assigneeId
    ? personLookup.get(workPackage.assigneeId)?.name ?? workPackage.assigneeId
    : "未分配";
}

function assignmentDetailTitle(workPackage: WorkPackage, personLookup: Map<string, Person>) {
  const assignments = workPackage.assignments ?? [];
  if (assignments.length === 0) {
    return "暂无成员分工明细";
  }

  return assignments
    .map((assignment) => {
      const name = personLookup.get(assignment.personId)?.name ?? assignment.personId;
      return `${name}（${assignment.role}）：${assignment.responsibility || "未填写分工"}`;
    })
    .join("\n");
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}
