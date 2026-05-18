"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Select } from "@/components/primer/Select";
import { Textarea } from "@/components/primer/Textarea";
import { Input } from "@/components/primer/Input";
import { canUser, userHasRole } from "@/lib/rbac";
import {
  getStatusTone,
  priorityLabel,
  priorityTone,
  riskLevelTone,
  statusLabel,
  typeLabel,
  typeTone
} from "@/lib/work-package-presentation";
import { getWorkPackageStatusInsights } from "@/lib/work-package-status";
import { SelfReportButton } from "@/components/work-packages/SelfReportButton";
import { VerificationPanel } from "@/components/work-packages/VerificationPanel";
import type {
  Person,
  Project,
  User,
  WorkPackage,
  WorkPackageApproval,
  WorkPackageApprovalStatus,
  WorkPackageComment,
  WorkPackageStatus,
  NotificationMessage
} from "@/lib/types";

interface WorkPackageDetailPaneProps {
  workPackage: WorkPackage;
  project: Project;
  people: Person[];
  teamLeadCandidates?: Person[];
  comments: WorkPackageComment[];
  approvals: WorkPackageApproval[];
  childWorkPackages?: WorkPackage[];
  allWorkPackages?: WorkPackage[];
  projects?: Project[];
  currentUser?: User;
  notificationMessages?: NotificationMessage[];
  onClose?: () => void;
}

const STATUS_BY_TYPE: Record<string, WorkPackageStatus[]> = {
  task: ["todo", "inProgress", "review", "done", "blocked"],
  milestone: ["todo", "inProgress", "review", "done", "blocked"],
  risk: ["todo", "inProgress", "review", "done", "blocked"],
  phase: ["todo", "inProgress", "review", "done", "blocked"]
};
const RISK_LEVEL_OPTIONS: Array<NonNullable<WorkPackage["riskLevel"]>> = ["Low", "Medium", "High"];

/**
 * Right-side detail pane with three logical groups: meta, progress edit,
 * and collaboration timeline (comments + approvals). Updates round-trip to
 * the server through the `/api/work-packages` endpoints.
 */
export function WorkPackageDetailPane({
  workPackage,
  project,
  people,
  teamLeadCandidates = [],
  comments,
  approvals,
  childWorkPackages = [],
  allWorkPackages,
  projects,
  currentUser,
  notificationMessages = [],
  onClose
}: WorkPackageDetailPaneProps) {
  const router = useRouter();
  const phaseTeamLeadPersonIds = new Set(teamLeadCandidates.map((person) => person.id));
  const [draft, setDraft] = useState({
    status: workPackage.status,
    percentComplete: workPackage.percentComplete,
    assigneeId: workPackage.assigneeId ?? "",
    lastProgressNote: workPackage.lastProgressNote,
    riskLevel: workPackage.riskLevel ?? ""
  });
  const [commentBody, setCommentBody] = useState("");
  const [commentType, setCommentType] = useState<WorkPackageComment["type"]>("comment");
  const [approvalComment, setApprovalComment] = useState("");
  const [childSubject, setChildSubject] = useState("");
  const [childAssigneeId, setChildAssigneeId] = useState("");
  const [childRequirements, setChildRequirements] = useState([""]);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [memberAssignments, setMemberAssignments] = useState(() =>
    initialAssignmentRows(
      workPackage,
      workPackage.type === "phase" ? phaseTeamLeadPersonIds : undefined
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const wpComments = comments
    .filter((comment) => comment.workPackageId === workPackage.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const wpApprovals = approvals
    .filter((approval) => approval.workPackageId === workPackage.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const sortedNotificationMessages = [...notificationMessages].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );

  const canUpdate =
    currentUser &&
    (canUser(currentUser, "assignWorkPackages") ||
      workPackage.createdByUserId === currentUser.id ||
      workPackage.assigneeId === currentUser.personId ||
      workPackage.assignments?.some((assignment) => assignment.personId === currentUser.personId));
  const canEditStatus =
    currentUser &&
    (userHasRole(currentUser, "admin") ||
      userHasRole(currentUser, "projectManager") ||
      userHasRole(currentUser, "teamLead"));
  const canEditProgress = Boolean(
    canEditStatus ||
      (currentUser &&
        workPackage.status === "inProgress" &&
        (workPackage.createdByUserId === currentUser.id ||
          workPackage.assigneeId === currentUser.personId ||
          workPackage.assignments?.some((assignment) => assignment.personId === currentUser.personId)))
  );
  const isPhaseLeadConfiguration = workPackage.type === "phase";
  const canConfigureMembers = Boolean(
    currentUser?.role === "teamLead" &&
      workPackage.projectId &&
      !isPhaseLeadConfiguration
  );
  const canConfigurePhaseLead = Boolean(
    currentUser &&
      workPackage.projectId &&
      isPhaseLeadConfiguration &&
      (userHasRole(currentUser, "admin") ||
        userHasRole(currentUser, "projectManager") ||
        userHasRole(currentUser, "teamLead"))
  );
  const canSaveAssignments = canConfigureMembers || canConfigurePhaseLead;
  const canApprove = canUser(currentUser, "approveWorkPackages");
  const personLookup = new Map(people.map((person) => [person.id, person]));
  const assignmentPeople = isPhaseLeadConfiguration ? teamLeadCandidates : people;
  const isAssignedToCurrentUser = Boolean(
    currentUser &&
      (workPackage.createdByUserId === currentUser.id ||
        workPackage.assigneeId === currentUser.personId ||
        workPackage.assignments?.some((assignment) => assignment.personId === currentUser.personId))
  );
  const canCreateChild = Boolean(
    currentUser?.role === "teamLead" &&
      workPackage.projectId &&
      (workPackage.type === "phase" || workPackage.type === "milestone")
  );
  const childCreateType: WorkPackage["type"] = workPackage.type === "phase" ? "milestone" : "task";
  const statusOptions = STATUS_BY_TYPE[workPackage.type] ?? STATUS_BY_TYPE.task;
  const statusInsights = getWorkPackageStatusInsights(
    workPackage,
    allWorkPackages ?? [workPackage, ...childWorkPackages],
    projects ?? [project]
  );

  async function saveProgress() {
    if (!currentUser) return;
    const payload: {
      percentComplete: number;
      lastProgressNote: string;
      status?: WorkPackageStatus;
      assigneeId?: string;
      riskLevel?: WorkPackage["riskLevel"] | null;
    } = {
      percentComplete: Number(draft.percentComplete),
      lastProgressNote: draft.lastProgressNote
    };
    if (canEditStatus) {
      payload.status = draft.status;
      payload.assigneeId = draft.assigneeId || undefined;
      payload.riskLevel = draft.riskLevel ? draft.riskLevel as WorkPackage["riskLevel"] : null;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "更新失败");
      }
      setInfo("已保存进展");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }

  async function postComment() {
    if (!currentUser || !commentBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ body: commentBody.trim(), type: commentType })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "评论失败");
      }
      setCommentBody("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评论失败");
    } finally {
      setBusy(false);
    }
  }

  async function approve(status: Exclude<WorkPackageApprovalStatus, "pending">) {
    if (!currentUser) return;
    const comment = approvalComment.trim() || (status === "approved" ? "已批准" : "需要补充信息");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ status, comment })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "签核失败");
      }
      setApprovalComment("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "签核失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveMemberAssignments() {
    if (!currentUser) return;
    const normalizedAssignments = normalizeAssignmentRows(memberAssignments, isPhaseLeadConfiguration);
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({
          assigneeId: normalizedAssignments[0]?.personId,
          memberAssignments: normalizedAssignments
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "成员配置失败");
      }
      setInfo("成员分工已保存");
      setIsAssignmentDialogOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "成员配置失败");
    } finally {
      setBusy(false);
    }
  }

  async function createChildWorkPackage() {
    if (!currentUser || !childSubject.trim()) return;
    const requirements = normalizeRequirementRows(childRequirements);
    if (
      (userHasRole(currentUser, "admin") ||
        userHasRole(currentUser, "projectManager") ||
        userHasRole(currentUser, "teamLead")) &&
      requirements.length === 0
    ) {
      setError("当前角色创建子任务时至少需要填写 1 条需求项。");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/work-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({
          projectId: project.id,
          type: childCreateType,
          subject: childSubject.trim(),
          parentId: workPackage.id,
          assigneeId: childAssigneeId || undefined,
          memberAssignments: childAssigneeId
            ? [{ personId: childAssigneeId, role: "主负责人", responsibility: "子任务执行" }]
            : [],
          requirements
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建失败");
      }
      setChildSubject("");
      setChildAssigneeId("");
      setChildRequirements([""]);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface fade-in">
      <header className="surface__header">
        <div className="surface__header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Badge tone={typeTone(workPackage.type)}>{typeLabel(workPackage.type)}</Badge>
            <span className="hint mono">#{workPackage.id}</span>
            <Badge tone={getStatusTone(workPackage.status)}>{statusLabel(workPackage.status)}</Badge>
            <Badge tone={priorityTone(workPackage.priority)}>{priorityLabel(workPackage.priority)}</Badge>
            {workPackage.riskLevel ? (
              <Badge tone={riskLevelTone(workPackage.riskLevel)}>风险 {workPackage.riskLevel}</Badge>
            ) : null}
          </div>
          <h2
            className="section-title"
            style={{ fontSize: 16, marginTop: 6, lineHeight: 1.4 }}
          >
            {workPackage.subject}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span className="hint" style={{ fontSize: 12 }}>
              成员：{assignmentSummary(workPackage, personLookup)}
            </span>
            {canSaveAssignments ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAssignmentDialogOpen(true)}
                title={assignmentDetailTitle(workPackage, personLookup)}
              >
                {isPhaseLeadConfiguration ? "配置团队负责人" : "配置成员"}
              </Button>
            ) : null}
          </div>
        </div>
        <div style={{ display: "inline-flex", gap: 4 }}>
          <Link
            href={`/projects/${project.identifier}/work-packages/${workPackage.id}`}
            className="btn"
            data-variant="ghost"
            data-size="sm"
            data-icon-only="true"
            aria-label="打开全屏视图"
            title="打开全屏视图"
          >
            <ExternalIcon />
          </Link>
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              data-icon-only="true"
              onClick={onClose}
              aria-label="关闭详情面板"
              title="关闭"
            >
              <CloseIcon />
            </Button>
          ) : null}
        </div>
      </header>
      <div className="surface__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {isAssignmentDialogOpen && (canSaveAssignments || canCreateChild) ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="配置成员分工"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(31, 35, 40, 0.32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16
            }}
          >
            <div
              className="surface"
              style={{
                width: "min(760px, 100%)",
                maxHeight: "86vh",
                overflowY: "auto",
                boxShadow: "var(--shadow-floating, 0 16px 40px rgba(31, 35, 40, 0.18))"
              }}
            >
              <header className="surface__header">
                <div>
                  <h3 className="section-title" style={{ margin: 0, fontSize: 15 }}>
                    {canSaveAssignments
                      ? isPhaseLeadConfiguration
                        ? "配置阶段团队负责人"
                        : "配置成员分工"
                      : childCreateType === "milestone"
                        ? "新增项目节点"
                        : "新增节点任务"}
                  </h3>
                  <p className="hint" style={{ margin: "4px 0 0", fontSize: 12 }}>
                    {canSaveAssignments
                      ? isPhaseLeadConfiguration
                        ? "候选人员来自管理员菜单中已配置的团队负责人。"
                        : "支持一个工作项配置多个成员，第一位作为主负责人。"
                      : "可先不配置负责人，稍后再由负责人补齐。"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setIsAssignmentDialogOpen(false)}>
                  关闭
                </Button>
              </header>
              <div className="surface__body" style={{ display: "grid", gap: 14 }}>
                {canSaveAssignments ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {memberAssignments.map((assignment, index) => (
                      <div
                        key={index}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isPhaseLeadConfiguration
                            ? "minmax(180px, 0.9fr) 1fr auto"
                            : "minmax(150px, 0.8fr) minmax(110px, 0.6fr) 1fr auto",
                          gap: 8
                        }}
                      >
                        <Select
                          value={assignment.personId}
                          onChange={(event) =>
                            setMemberAssignments((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, personId: event.target.value } : item
                              )
                            )
                          }
                        >
                          <option value="">
                            {isPhaseLeadConfiguration ? "选择团队负责人" : "选择成员"}
                          </option>
                          {assignmentPeople.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name} · {person.role}
                            </option>
                          ))}
                        </Select>
                        {isPhaseLeadConfiguration ? null : (
                          <Input
                            value={assignment.role}
                            placeholder={index === 0 ? "主负责人" : "协作成员"}
                            onChange={(event) =>
                              setMemberAssignments((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, role: event.target.value } : item
                                )
                              )
                            }
                          />
                        )}
                        <Input
                          value={assignment.responsibility}
                          placeholder={isPhaseLeadConfiguration ? "职责说明，例如：阶段推进与任务拆解" : "分工说明，例如：接口联调与验证"}
                          onChange={(event) =>
                            setMemberAssignments((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, responsibility: event.target.value } : item
                              )
                            )
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={memberAssignments.length === 1}
                          onClick={() =>
                            setMemberAssignments((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setMemberAssignments((current) => [
                            ...current,
                            {
                              personId: "",
                              role: isPhaseLeadConfiguration ? "团队负责人" : "协作成员",
                              responsibility: ""
                            }
                          ])
                        }
                      >
                        {isPhaseLeadConfiguration ? "+ 新增团队负责人" : "+ 新增成员"}
                      </Button>
                      <Button size="sm" variant="primary" disabled={busy} onClick={saveMemberAssignments}>
                        {busy ? "保存中…" : isPhaseLeadConfiguration ? "保存团队负责人" : "保存成员分工"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {canCreateChild ? (
                  <div className="muted-card" style={{ padding: 10, display: "grid", gap: 8 }}>
                    <p className="eyebrow" style={{ margin: 0 }}>
                      {childCreateType === "milestone" ? "继续拆分项目节点" : "继续拆分节点任务"}
                    </p>
                    <Input
                      value={childSubject}
                      placeholder={childCreateType === "milestone" ? "节点主题，例如：域控样件联调" : "任务主题，例如：补充产线节拍验证记录"}
                      onChange={(event) => setChildSubject(event.target.value)}
                    />
                    <Select value={childAssigneeId} onChange={(event) => setChildAssigneeId(event.target.value)}>
                      <option value="">选择团队成员/负责人</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} · {person.role}
                        </option>
                      ))}
                    </Select>
                    {childRequirements.map((item, index) => (
                      <div key={index} style={{ display: "flex", gap: 8 }}>
                        <Input
                          value={item}
                          placeholder="需求项，例如：验证接口权限拒绝路径"
                          onChange={(event) =>
                            setChildRequirements((current) =>
                              current.map((value, itemIndex) =>
                                itemIndex === index ? event.target.value : value
                              )
                            )
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={childRequirements.length === 1}
                          onClick={() =>
                            setChildRequirements((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setChildRequirements((current) => [...current, ""])}
                      >
                        + 新增需求项
                      </Button>
                      <Button size="sm" variant="primary" disabled={busy || !childSubject.trim()} onClick={createChildWorkPackage}>
                        {childCreateType === "milestone" ? "创建节点" : "创建任务"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {workPackage.description ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--fg-default)" }}>
            {workPackage.description}
          </p>
        ) : null}

        <Section
          title="阻塞 / 延期来源"
          subtitle={statusInsights.length > 0 ? `${statusInsights.length} 条` : undefined}
        >
          {statusInsights.length === 0 ? (
            <p className="hint" style={{ margin: 0, fontSize: 13 }}>
              当前没有阻塞、延期或历史风险记录。
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {statusInsights.map((insight) => (
                <div
                  key={insight.key}
                  className="muted-card"
                  style={{ padding: 10, display: "grid", gap: 4 }}
                >
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge tone={insight.tone}>{insight.label}</Badge>
                    <span className="hint" style={{ fontSize: 12 }}>
                      {insight.kind === "dependencyBlocked" || insight.kind === "dependencyOverdue"
                        ? "依赖来源"
                        : insight.kind === "wasDelayed" || insight.kind === "wasBlocked"
                          ? "历史痕迹"
                          : "当前关注"}
                    </span>
                  </div>
                  <p className="hint" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                    {insight.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {workPackage.requirements && workPackage.requirements.length > 0 ? (
          <Section title="需求项">
            <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, lineHeight: 1.7 }}>
              {workPackage.requirements.map((req, index) => (
                <li key={req.id ?? index}>{req.content}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        {workPackage.attachments && workPackage.attachments.length > 0 ? (
          <Section title="附件预览" subtitle={`${workPackage.attachments.length} 个`}>
            <AttachmentPreviewList attachments={workPackage.attachments} />
          </Section>
        ) : null}

        <Section title="成员子任务分配" subtitle={`${childWorkPackages.length} 项`}>
          <div style={{ display: "grid", gap: 8 }}>
            {childWorkPackages.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>暂无子任务分配。</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {childWorkPackages.map((child) => {
                  const assignee = child.assigneeId ? personLookup.get(child.assigneeId) : undefined;
                  return (
                    <li key={child.id} className="muted-card" style={{ padding: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>#{child.id} {child.subject}</span>
                        <span className="hint mono">{child.percentComplete}%</span>
                      </div>
                      <p className="hint" style={{ margin: "4px 0 0", fontSize: 12 }}>
                        负责人：{assignee?.name ?? "未分配"} · {statusLabel(child.status)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {canSaveAssignments || canCreateChild ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button size="sm" variant="ghost" onClick={() => setIsAssignmentDialogOpen(true)}>
                  {canSaveAssignments
                    ? isPhaseLeadConfiguration
                      ? "配置团队负责人 / 分配任务"
                      : "配置成员 / 分配任务"
                    : childCreateType === "milestone"
                      ? "新增项目节点"
                      : "新增节点任务"}
                </Button>
              </div>
            ) : null}
          </div>
        </Section>

        {workPackage.type === "risk" ? (
          <div className="muted-card" style={{ padding: 12 }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>影响</p>
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>{workPackage.riskImpact ?? "—"}</p>
            <p className="eyebrow" style={{ marginBottom: 4 }}>缓解建议</p>
            <p style={{ margin: 0, fontSize: 13 }}>{workPackage.riskMitigation ?? "—"}</p>
          </div>
        ) : null}

        {/* 核对流程区块 */}
        {currentUser ? (
          <Section title="核对流程">
            <SelfReportButton
              workPackageId={workPackage.id}
              currentUserId={currentUser.id}
              verificationStatus={workPackage.verificationStatus}
              canReport={
                isAssignedToCurrentUser ||
                userHasRole(currentUser, "admin")
              }
            />
            <div style={{ marginTop: 8 }}>
              <VerificationPanel
                workPackageId={workPackage.id}
                currentUserId={currentUser.id}
                verificationStatus={workPackage.verificationStatus}
                requiresVerification={workPackage.requiresVerification}
                rejectedReason={workPackage.rejectedReason}
                canVerify={
                  userHasRole(currentUser, "admin") ||
                  userHasRole(currentUser, "projectManager") ||
                  userHasRole(currentUser, "teamLead")
                }
              />
            </div>
          </Section>
        ) : null}

        <Section title="进展更新">
          <fieldset
            disabled={!canUpdate || !canEditProgress || busy}
            style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="状态">
                <Select
                  value={draft.status}
                  disabled={!canEditStatus}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as WorkPackageStatus }))}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="完成度 (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.percentComplete}
                  onChange={(event) => setDraft((current) => ({ ...current, percentComplete: Number(event.target.value) }))}
                />
              </Field>
            </div>
            {canEditStatus ? (
              <Field label="风险等级">
                <Select
                  value={draft.riskLevel}
                  onChange={(event) => setDraft((current) => ({ ...current, riskLevel: event.target.value }))}
                >
                  <option value="">无风险等级</option>
                  {RISK_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="最新进展备注">
              <Textarea
                value={draft.lastProgressNote}
                rows={2}
                onChange={(event) => setDraft((current) => ({ ...current, lastProgressNote: event.target.value }))}
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="primary" size="sm" onClick={saveProgress} disabled={!canUpdate || !canEditProgress || busy}>
                {busy ? "保存中…" : "保存进展"}
              </Button>
            </div>
          </fieldset>
          {!canEditProgress && currentUser ? (
            <p className="hint" style={{ margin: "8px 0 0", fontSize: 12 }}>
              项目参与员只能更新本人任务进度；状态流转、风险和阻塞由团队负责人处理。
            </p>
          ) : null}
        </Section>

        <Section
          title="活动"
          subtitle={`${wpComments.length + wpApprovals.length + sortedNotificationMessages.length} 条记录`}
        >
          {currentUser ? (
            <div className="muted-card" style={{ padding: 10 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <Select
                  value={commentType}
                  onChange={(event) => setCommentType(event.target.value as WorkPackageComment["type"])}
                  style={{ width: 120 }}
                >
                  <option value="comment">评论</option>
                  <option value="decision">决策</option>
                  <option value="blocker">阻塞</option>
                  <option value="evidence">证据</option>
                </Select>
              </div>
              <Textarea
                value={commentBody}
                rows={2}
                placeholder="补充协作记录、决策结论或阻塞原因…"
                onChange={(event) => setCommentBody(event.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <Button size="sm" variant="primary" disabled={busy || !commentBody.trim()} onClick={postComment}>
                  发布
                </Button>
              </div>
            </div>
          ) : null}
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {wpComments.length === 0 && wpApprovals.length === 0 && sortedNotificationMessages.length === 0 ? (
              <li className="hint">暂无协作记录。</li>
            ) : null}
            {wpComments.map((comment) => {
              const author = personLookup.get(comment.authorPersonId);
              return (
                <li
                  key={comment.id}
                  style={{
                    border: "1px solid var(--border-muted)",
                    borderRadius: 8,
                    padding: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: 13 }}>{author?.name ?? comment.authorDisplayName ?? "未知作者"}</strong>
                    <Badge
                      tone={
                        comment.type === "blocker"
                          ? "danger"
                          : comment.type === "decision"
                            ? "done"
                            : comment.type === "evidence"
                              ? "accent"
                              : "default"
                      }
                    >
                      {comment.type === "comment"
                        ? "评论"
                        : comment.type === "decision"
                          ? "决策"
                          : comment.type === "blocker"
                            ? "阻塞"
                            : "证据"}
                    </Badge>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {comment.body}
                  </p>
                  <p className="hint" style={{ margin: "6px 0 0", fontSize: 11 }}>
                    {comment.source && comment.source !== "platform" ? `来源 ${comment.source} · ` : ""}
                    {formatDateTime(comment.createdAt)}
                  </p>
                </li>
              );
            })}
            {wpApprovals.map((approval) => {
              const reviewer = personLookup.get(approval.reviewerPersonId);
              return (
                <li
                  key={approval.id}
                  style={{
                    border: "1px solid var(--border-muted)",
                    borderRadius: 8,
                    padding: 10,
                    background: "var(--bg-subtle)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{reviewer?.name ?? approval.reviewerPersonId}</strong>
                    <Badge
                      tone={
                        approval.status === "approved"
                          ? "success"
                          : approval.status === "changesRequested"
                            ? "danger"
                            : "default"
                      }
                    >
                      {approval.status === "approved" ? "已批准" : approval.status === "changesRequested" ? "需修改" : "待签核"}
                    </Badge>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13 }}>{approval.comment}</p>
                  <p className="hint" style={{ margin: "6px 0 0", fontSize: 11 }}>
                    {formatDateTime(approval.createdAt)}
                  </p>
                </li>
              );
            })}
            {sortedNotificationMessages.map((message) => (
              <li
                key={message.id}
                style={{
                  border: "1px solid var(--border-muted)",
                  borderRadius: 8,
                  padding: 10
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{message.title}</strong>
                  <Badge tone={notificationTone(message.activityType)}>
                    {notificationLabel(message.activityType)}
                  </Badge>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {message.body}
                </p>
                <p className="hint" style={{ margin: "6px 0 0", fontSize: 11 }}>
                  接收人：{message.recipientUserId ?? message.recipientPersonId} · {formatDateTime(message.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        {canApprove ? (
          <Section title="签核">
            <div className="muted-card" style={{ padding: 10 }}>
              <Textarea
                value={approvalComment}
                rows={2}
                placeholder="可填写签核意见，留空使用默认文案。"
                onChange={(event) => setApprovalComment(event.target.value)}
              />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                <Button size="sm" variant="default" disabled={busy} onClick={() => approve("changesRequested")}>
                  请求修改
                </Button>
                <Button size="sm" variant="success" disabled={busy} onClick={() => approve("approved")}>
                  批准
                </Button>
              </div>
            </div>
          </Section>
        ) : null}

        {error ? (
          <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p>
        ) : null}
        {info ? (
          <p style={{ color: "var(--success-fg)", margin: 0, fontSize: 12 }}>{info}</p>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, margin: 0, fontWeight: 600, color: "var(--fg-default)" }}>{title}</h3>
        {subtitle ? <span className="hint" style={{ fontSize: 11 }}>{subtitle}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="label" style={{ fontSize: 11, marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function notificationLabel(type: NotificationMessage["activityType"]) {
  if (type === "comment") return "评论";
  if (type === "decision") return "决策";
  if (type === "blocker") return "阻塞";
  if (type === "evidence") return "证据";
  if (type === "approval") return "签核";
  return "进展";
}

function notificationTone(type: NotificationMessage["activityType"]) {
  if (type === "blocker") return "danger";
  if (type === "decision") return "done";
  if (type === "evidence") return "accent";
  if (type === "approval") return "success";
  return "default";
}

function AttachmentPreviewList({
  attachments
}: {
  attachments: NonNullable<WorkPackage["attachments"]>;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="muted-card"
          style={{ padding: 10, display: "grid", gap: 8 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: 13 }}>{attachment.fileName}</strong>
              <p className="hint" style={{ margin: "2px 0 0", fontSize: 11 }}>
                {attachment.contentType} · {formatBytes(attachment.size)}
              </p>
            </div>
            <a
              href={attachment.dataUrl}
              download={attachment.fileName}
              target="_blank"
              rel="noreferrer"
              className="btn"
              data-size="sm"
              data-variant="ghost"
            >
              打开
            </a>
          </div>
          <AttachmentPreview attachment={attachment} />
        </div>
      ))}
    </div>
  );
}

function AttachmentPreview({
  attachment
}: {
  attachment: NonNullable<WorkPackage["attachments"]>[number];
}) {
  if (attachment.contentType.startsWith("image/")) {
    return (
      <object
        data={attachment.dataUrl}
        type={attachment.contentType}
        aria-label={attachment.fileName}
        style={{
          maxWidth: "100%",
          width: "100%",
          maxHeight: 260,
          border: "1px solid var(--border-muted)",
          borderRadius: 8,
          background: "var(--bg-canvas)"
        }}
      >
        <a href={attachment.dataUrl} download={attachment.fileName}>打开图片附件</a>
      </object>
    );
  }

  if (attachment.contentType === "application/pdf") {
    return (
      <iframe
        title={attachment.fileName}
        src={attachment.dataUrl}
        style={{
          width: "100%",
          height: 280,
          border: "1px solid var(--border-muted)",
          borderRadius: 8
        }}
      />
    );
  }

  if (isDelimitedTableAttachment(attachment)) {
    return <DelimitedTablePreview attachment={attachment} />;
  }

  if (isExcelAttachment(attachment)) {
    return (
      <div
        style={{
          border: "1px solid var(--border-muted)",
          borderRadius: 8,
          padding: 12,
          background: "var(--bg-canvas)"
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Excel 表格文件</p>
        <p className="hint" style={{ margin: "4px 0 0", fontSize: 12 }}>
          浏览器无法稳定内嵌解析 xls/xlsx，可点击“打开”下载后查看。
        </p>
      </div>
    );
  }

  if (attachment.contentType.startsWith("text/") || attachment.contentType === "application/json") {
    return (
      <pre
        style={{
          margin: 0,
          maxHeight: 220,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          border: "1px solid var(--border-muted)",
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          lineHeight: 1.6,
          background: "var(--bg-canvas)"
        }}
      >
        {decodeTextDataUrl(attachment.dataUrl)}
      </pre>
    );
  }

  return <p className="hint" style={{ margin: 0 }}>此附件类型暂不支持内嵌预览，可点击打开查看。</p>;
}

function DelimitedTablePreview({
  attachment
}: {
  attachment: NonNullable<WorkPackage["attachments"]>[number];
}) {
  const text = decodeTextDataUrl(attachment.dataUrl);
  const delimiter = attachment.fileName.toLowerCase().endsWith(".tsv") ? "\t" : ",";
  const rows = parseDelimitedRows(text, delimiter).slice(0, 50);
  const columnCount = Math.max(...rows.map((row) => row.length), 0);

  if (rows.length === 0 || columnCount === 0) {
    return <p className="hint" style={{ margin: 0 }}>表格内容为空，无法预览。</p>;
  }

  return (
    <div className="scroll-x" style={{ maxHeight: 280, overflow: "auto" }}>
      <table className="data-table" style={{ minWidth: Math.max(360, columnCount * 120) }}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columnCount }).map((_, columnIndex) => {
                const Cell = rowIndex === 0 ? "th" : "td";
                return (
                  <Cell key={columnIndex} style={{ whiteSpace: "nowrap" }}>
                    {row[columnIndex] ?? ""}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isDelimitedTableAttachment(attachment: NonNullable<WorkPackage["attachments"]>[number]) {
  const fileName = attachment.fileName.toLowerCase();
  return (
    fileName.endsWith(".csv") ||
    fileName.endsWith(".tsv") ||
    attachment.contentType === "text/csv" ||
    attachment.contentType === "text/tab-separated-values"
  );
}

function isExcelAttachment(attachment: NonNullable<WorkPackage["attachments"]>[number]) {
  const fileName = attachment.fileName.toLowerCase();
  return (
    fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx") ||
    attachment.contentType === "application/vnd.ms-excel" ||
    attachment.contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function parseDelimitedRows(value: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cellValue) => cellValue.trim().length > 0));
}

function decodeTextDataUrl(dataUrl: string) {
  const payload = dataUrl.split(",", 2)[1];
  if (!payload) {
    return "附件内容为空或格式异常。";
  }

  try {
    const decoded = dataUrl.includes(";base64,")
      ? atob(payload)
      : decodeURIComponent(payload);
    return decoded.length > 4000 ? `${decoded.slice(0, 4000)}\n...` : decoded;
  } catch {
    return "无法预览此文本附件。";
  }
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function initialAssignmentRows(workPackage: WorkPackage, allowedPersonIds?: Set<string>) {
  if (workPackage.assignments && workPackage.assignments.length > 0) {
    const assignments = workPackage.assignments
      .filter((assignment) => !allowedPersonIds || allowedPersonIds.has(assignment.personId))
      .map((assignment, index) => ({
      personId: assignment.personId,
      role: allowedPersonIds ? "团队负责人" : assignment.role || (index === 0 ? "主负责人" : "协作成员"),
      responsibility: assignment.responsibility
    }));
    if (assignments.length > 0) {
      return assignments;
    }
  }

  return [{
    personId: workPackage.assigneeId && (!allowedPersonIds || allowedPersonIds.has(workPackage.assigneeId))
      ? workPackage.assigneeId
      : "",
    role: allowedPersonIds ? "团队负责人" : "主负责人",
    responsibility: ""
  }];
}

function normalizeAssignmentRows(
  rows: Array<{ personId: string; role: string; responsibility: string }>,
  forceTeamLeadRole = false
) {
  const seen = new Set<string>();
  return rows
    .map((row, index) => ({
      personId: row.personId.trim(),
      role: forceTeamLeadRole ? "团队负责人" : row.role.trim() || (index === 0 ? "主负责人" : "协作成员"),
      responsibility: row.responsibility.trim(),
      sortOrder: index
    }))
    .filter((row) => {
      if (!row.personId || seen.has(row.personId)) {
        return false;
      }
      seen.add(row.personId);
      return true;
    });
}

function normalizeRequirementRows(rows: string[]): string[] {
  return rows.map((row) => row.trim()).filter(Boolean);
}

function assignmentSummary(
  workPackage: WorkPackage,
  personLookup: Map<string, Person>
) {
  const assignments = workPackage.assignments ?? [];
  if (assignments.length > 0) {
    return assignments
      .slice(0, 3)
      .map((assignment) => personLookup.get(assignment.personId)?.name ?? assignment.personId)
      .join("、") + (assignments.length > 3 ? ` 等 ${assignments.length} 人` : "");
  }

  return workPackage.assigneeId
    ? personLookup.get(workPackage.assigneeId)?.name ?? workPackage.assigneeId
    : "未分配";
}

function assignmentDetailTitle(
  workPackage: WorkPackage,
  personLookup: Map<string, Person>
) {
  const assignments = workPackage.assignments ?? [];
  if (assignments.length === 0) {
    return "暂无成员分工明细";
  }

  return assignments
    .map((assignment) => {
      const name = personLookup.get(assignment.personId)?.name ?? assignment.personId;
      const responsibility = assignment.responsibility || "未填写分工";
      return `${name}（${assignment.role}）：${responsibility}`;
    })
    .join("\n");
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 3H13V6.5M13 3L7 9M5 4H4C3.44772 4 3 4.44772 3 5V12C3 12.5523 3.44772 13 4 13H11C11.5523 13 12 12.5523 12 12V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
