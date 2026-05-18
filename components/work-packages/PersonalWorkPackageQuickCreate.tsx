"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import {
  AttachmentPicker,
  RequirementListEditor,
  normalizeRequirementItems,
  type AttachmentDraft
} from "@/components/work-packages/WorkPackageFormFields";
import { userHasRole } from "@/lib/rbac";
import type { Priority, Project, User, WorkPackageType } from "@/lib/types";

interface PersonalWorkPackageQuickCreateProps {
  currentUser?: User;
  projects: Project[];
}

const TYPE_OPTIONS: Array<{ value: WorkPackageType; label: string }> = [
  { value: "task", label: "任务" },
  { value: "milestone", label: "里程碑" },
  { value: "risk", label: "风险" }
];

const PRIORITY_OPTIONS: Priority[] = ["P0", "P1", "P2"];

/**
 * Creates a personal or optionally project-mounted work package from My Page.
 */
export function PersonalWorkPackageQuickCreate({
  currentUser,
  projects
}: PersonalWorkPackageQuickCreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState<WorkPackageType>("task");
  const [priority, setPriority] = useState<Priority>("P1");
  const [dueDate, setDueDate] = useState("");
  const [requirements, setRequirements] = useState([""]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRequirementRequired =
    userHasRole(currentUser, "admin") ||
    userHasRole(currentUser, "projectManager") ||
    userHasRole(currentUser, "teamLead");

  async function submit() {
    if (!currentUser || !subject.trim()) {
      return;
    }
    const normalizedRequirements = normalizeRequirementItems(requirements);
    if (isRequirementRequired && normalizedRequirements.length === 0) {
      setError("当前角色创建工作项时至少需要填写 1 条需求项。");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/work-packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({
          projectId: projectId || null,
          type,
          subject: subject.trim(),
          priority,
          requirements: normalizedRequirements,
          attachments,
          dueDate: dueDate || undefined
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建工作项失败。");
      }

      setSubject("");
      setProjectId("");
      setType("task");
      setPriority("P1");
      setDueDate("");
      setRequirements([""]);
      setAttachments([]);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建工作项失败。");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div style={{ position: "relative" }}>
      <Button variant="primary" size="sm" onClick={() => setOpen((value) => !value)}>
        + 新建工作项
      </Button>
      {open ? (
        <div
          className="surface fade-in"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 420,
            zIndex: 20,
            boxShadow: "var(--shadow-floating)"
          }}
        >
          <div className="surface__body" style={{ display: "grid", gap: 10 }}>
            <label>
              <span className="label">标题</span>
              <Input
                value={subject}
                autoFocus
                placeholder="例如：整理本周客户反馈"
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
            <label>
              <span className="label">项目</span>
              <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">个人事项</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>
                <span className="label">类型</span>
                <Select
                  value={type}
                  onChange={(event) => setType(event.target.value as WorkPackageType)}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                <span className="label">优先级</span>
                <Select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as Priority)}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <label>
              <span className="label">截止日期</span>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <RequirementListEditor
              value={requirements}
              onChange={setRequirements}
              required={isRequirementRequired}
              compact
            />
            <AttachmentPicker value={attachments} onChange={setAttachments} disabled={busy} />
            {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={
                  busy ||
                  !subject.trim() ||
                  (isRequirementRequired && normalizeRequirementItems(requirements).length === 0)
                }
                onClick={submit}
              >
                {busy ? "创建中…" : "创建"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
