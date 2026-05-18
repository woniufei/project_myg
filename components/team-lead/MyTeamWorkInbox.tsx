"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Textarea } from "@/components/primer/Textarea";
import { Surface } from "@/components/primer/Surface";
import { getStatusTone, statusLabel, priorityLabel, priorityTone, typeLabel, typeTone } from "@/lib/work-package-presentation";
import type { WorkPackage, User, Person, Project } from "@/lib/types";

interface MyTeamWorkInboxProps {
  /** 待核对的工作项（SELF_REPORTED_DONE 状态） */
  pendingVerification: WorkPackage[];
  /** 已被驳回的工作项 */
  rejectedWorkPackages: WorkPackage[];
  /** 团队成员负责的工作项概览 */
  teamMemberWorkPackages: { person: Person; count: number }[];
  currentUser: User;
  projects?: Project[];
}

interface TeamWorkRow {
  workPackage: WorkPackage;
  level: number;
}

/**
 * 团队负责人工作收件箱组件
 * - 待核对列表：团队成员提交"完成自报"的工作项
 * - 已被驳回列表：负责人之前驳回的工作项
 * - 团队负载概览：每个成员当前负责的工作项数量
 */
export function MyTeamWorkInbox({
  pendingVerification,
  rejectedWorkPackages,
  teamMemberWorkPackages,
  currentUser,
  projects = []
}: MyTeamWorkInboxProps) {
  const router = useRouter();
  const [rejectComment, setRejectComment] = useState<Record<number, string>>({});
  const personLookup = new Map(teamMemberWorkPackages.map((item) => [item.person.id, item.person]));
  const projectLookup = new Map(projects.map((project) => [project.id, project]));
  const pendingRows = buildTeamWorkRows(pendingVerification);
  const rejectedRows = buildTeamWorkRows(rejectedWorkPackages);

  async function handleVerify(workPackageId: number) {
    try {
      const response = await fetch(`/api/work-packages/${workPackageId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id }
      });
      if (!response.ok) throw new Error("核对失败");
      router.refresh();
    } catch (error) {
      console.error("核对失败:", error);
    }
  }

  async function handleReject(workPackageId: number) {
    const reason = rejectComment[workPackageId]?.trim() || "需要补充";
    try {
      const response = await fetch(`/api/work-packages/${workPackageId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) throw new Error("驳回失败");
      router.refresh();
    } catch (error) {
      console.error("驳回失败:", error);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* 待核对列表 */}
      <Surface title={`待核对 (${pendingVerification.length})`} description="团队成员已提交完成自报，等待您核对确认。">
        {pendingVerification.length === 0 ? (
          <p className="hint" style={{ margin: 0, padding: 16, textAlign: "center" }}>
            暂无待核对的工作项。
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {pendingRows.map(({ workPackage: wp, level }) => (
              <div
                key={wp.id}
                style={{
                  border: "1px solid var(--border-muted)",
                  borderRadius: 8,
                  padding: 12,
                  marginLeft: level * 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}
                title={assignmentDetailTitle(wp, personLookup)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone={typeTone(wp.type)}>{typeLabel(wp.type)}</Badge>
                  <Badge tone={priorityTone(wp.priority)}>{priorityLabel(wp.priority)}</Badge>
                  <span className="hint mono" style={{ fontSize: 11 }}>#{wp.id}</span>
                </div>

                <Link
                  href={workPackageHref(wp, projectLookup)}
                  style={{ fontWeight: 500, color: "var(--fg-default)", fontSize: 14 }}
                >
                  {level > 0 ? "↳ " : ""}
                  {wp.subject}
                </Link>

                {wp.description && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.4,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"
                  }}>
                    {wp.description}
                  </p>
                )}

                <p className="hint" style={{ margin: 0, fontSize: 12 }}>
                  成员分工：{assignmentSummary(wp, personLookup)}
                </p>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <Textarea
                    placeholder="驳回原因（可选）"
                    value={rejectComment[wp.id] ?? ""}
                    rows={1}
                    onChange={(e) =>
                      setRejectComment((prev) => ({ ...prev, [wp.id]: e.target.value }))
                    }
                    style={{ flex: 1, minHeight: 32, fontSize: 12 }}
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleReject(wp.id)}
                  >
                    驳回
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleVerify(wp.id)}
                  >
                    通过 ✓
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* 已被驳回列表 */}
      <Surface title={`已驳回 (${rejectedWorkPackages.length})`} description="您之前驳回过的工作项，等待团队成员补充后重新提交。">
        {rejectedWorkPackages.length === 0 ? (
          <p className="hint" style={{ margin: 0, padding: 16, textAlign: "center" }}>
            暂无驳回记录。
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rejectedRows.map(({ workPackage: wp, level }) => (
              <div
                key={wp.id}
                style={{
                  border: "1px solid var(--border-danger)",
                  borderRadius: 8,
                  padding: 12,
                  marginLeft: level * 18
                }}
                title={assignmentDetailTitle(wp, personLookup)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="danger">{statusLabel(wp.status)}</Badge>
                  <Link href={workPackageHref(wp, projectLookup)} style={{ fontWeight: 500, fontSize: 13, color: "var(--fg-default)" }}>
                    {level > 0 ? "↳ " : ""}
                    {wp.subject}
                  </Link>
                </div>
                {wp.rejectedReason ? (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--danger-fg)" }}>
                    驳回原因：{wp.rejectedReason}
                  </p>
                ) : null}
                <p className="hint" style={{ margin: "6px 0 0", fontSize: 12 }}>
                  成员分工：{assignmentSummary(wp, personLookup)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* 团队负载概览 */}
      <Surface title="团队负载概览" description="团队成员当前负责的工作项数量。">
        {teamMemberWorkPackages.length === 0 ? (
          <p className="hint" style={{ margin: 0, padding: 16, textAlign: "center" }}>
            暂无团队成员数据。
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {teamMemberWorkPackages.map(({ person, count }) => (
              <div
                key={person.id}
                style={{
                  border: "1px solid var(--border-muted)",
                  borderRadius: 8,
                  padding: 12,
                  textAlign: "center"
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 24, color: "var(--accent-fg)" }}>
                  {count}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{person.name}</div>
                <div className="hint" style={{ fontSize: 11 }}>{person.role}</div>
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
}

/**
 * Flattens work packages into parent-child display rows for the team lead inbox.
 */
function buildTeamWorkRows(workPackages: WorkPackage[]): TeamWorkRow[] {
  const includedIds = new Set(workPackages.map((workPackage) => workPackage.id));
  const childrenByParent = new Map<number, WorkPackage[]>();
  const roots: WorkPackage[] = [];

  for (const workPackage of workPackages) {
    if (workPackage.parentId && includedIds.has(workPackage.parentId)) {
      const siblings = childrenByParent.get(workPackage.parentId) ?? [];
      siblings.push(workPackage);
      childrenByParent.set(workPackage.parentId, siblings);
    } else {
      roots.push(workPackage);
    }
  }

  const orderIndex = new Map(workPackages.map((workPackage, index) => [workPackage.id, index]));
  const orderByInput = (left: WorkPackage, right: WorkPackage) =>
    (orderIndex.get(left.id) ?? 0) - (orderIndex.get(right.id) ?? 0);
  roots.sort(orderByInput);
  for (const children of childrenByParent.values()) {
    children.sort(orderByInput);
  }

  const rows: TeamWorkRow[] = [];
  const walk = (workPackage: WorkPackage, level: number) => {
    rows.push({ workPackage, level });
    for (const child of childrenByParent.get(workPackage.id) ?? []) {
      walk(child, level + 1);
    }
  };

  roots.forEach((root) => walk(root, 0));
  return rows;
}

function workPackageHref(workPackage: WorkPackage, projectLookup: Map<string, Project>) {
  const project = workPackage.projectId ? projectLookup.get(workPackage.projectId) : undefined;
  return project
    ? `/projects/${project.identifier}/work-packages/${workPackage.id}?returnTo=/team`
    : `/work-packages?focus=${workPackage.id}`;
}

function assignmentSummary(workPackage: WorkPackage, personLookup: Map<string, Person>) {
  const assignments = workPackage.assignments ?? [];
  if (assignments.length === 0) {
    return workPackage.assigneeId
      ? personLookup.get(workPackage.assigneeId)?.name ?? workPackage.assigneeId
      : "未分配";
  }

  return assignments
    .map((assignment) => {
      const name = personLookup.get(assignment.personId)?.name ?? assignment.personId;
      return `${name}（${assignment.role}）`;
    })
    .join("、");
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