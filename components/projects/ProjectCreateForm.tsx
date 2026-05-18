"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import { Textarea } from "@/components/primer/Textarea";
import type { Project, ProjectModule, ProjectStatus } from "@/lib/types";
import { moduleLabel } from "@/lib/work-package-presentation";

interface ProjectCreateFormProps {
  parentCandidates: Project[];
  defaultModules: ProjectModule[];
  allModules: ProjectModule[];
  teamLeadCandidates: ProjectTeamLeadCandidate[];
  currentUserId?: string;
  /** When true, parentId is required (TeamLead can only create sub-projects). */
  requireParentId?: boolean;
}

interface ProjectTeamLeadCandidate {
  userId: string;
  personId: string;
  personName: string;
  personRole: string;
  externalId?: string;
  departmentName?: string;
}

interface FormState {
  identifier: string;
  name: string;
  description: string;
  parentId: string;
  status: ProjectStatus;
  enabledModules: ProjectModule[];
  teamLeadPersonId: string;
  phases: ProjectPhaseDraft[];
}

interface ProjectPhaseDraft {
  subject: string;
  description: string;
  startDate: string;
  dueDate: string;
  teamLeadPersonId: string;
}

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "active", label: "进行中" },
  { value: "onHold", label: "暂停" },
  { value: "archived", label: "已归档" }
];

/**
 * Inline create-project form rendered on /projects/new. Submits to the
 * server and redirects into the new project's overview on success.
 */
export function ProjectCreateForm({
  parentCandidates,
  defaultModules,
  allModules,
  teamLeadCandidates,
  currentUserId,
  requireParentId = false
}: ProjectCreateFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    identifier: "",
    name: "",
    description: "",
    parentId: "",
    status: "active",
    enabledModules: defaultModules,
    teamLeadPersonId: "",
    phases: [{ subject: "", description: "", startDate: "", dueDate: "", teamLeadPersonId: "" }]
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function toggleModule(module: ProjectModule) {
    setState((current) => {
      const next = new Set(current.enabledModules);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return { ...current, enabledModules: Array.from(next) };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (requireParentId && !state.parentId) {
      setError("团队负责人必须选择父项目以创建子项目");
      return;
    }
    const phases = normalizePhaseDrafts(state.phases, state.teamLeadPersonId);
    if (phases.length === 0) {
      setError("请至少创建 1 个项目阶段");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentUserId ? { "x-user-id": currentUserId } : {})
        },
        body: JSON.stringify({
          identifier: state.identifier.trim(),
          name: state.name.trim(),
          description: state.description.trim() || undefined,
          parentId: state.parentId || undefined,
          status: state.status,
          enabledModules: state.enabledModules,
          phases
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建项目失败");
      }
      const payload = (await response.json()) as { project: Project };
      router.push(`/projects/${payload.project.identifier}/overview`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建项目失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="项目名称" htmlFor="project-name">
        <Input
          id="project-name"
          required
          value={state.name}
          placeholder="例如：客户成功平台"
          onChange={(event) => update("name", event.target.value)}
        />
      </Field>

      <Field
        label="项目标识符"
        htmlFor="project-identifier"
        hint="由小写字母、数字和短横线组成，作为 /projects/{identifier} URL。"
      >
        <Input
          id="project-identifier"
          required
          value={state.identifier}
          placeholder="例如：cs-platform"
          pattern="[a-z0-9][a-z0-9-]{1,40}"
          onChange={(event) => update("identifier", event.target.value.toLowerCase())}
        />
      </Field>

      <Field label="项目描述" htmlFor="project-description">
        <Textarea
          id="project-description"
          rows={3}
          value={state.description}
          placeholder="补充项目目标、范围或团队备注。"
          onChange={(event) => update("description", event.target.value)}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field
          label={`父项目${requireParentId ? "（必填）" : ""}`}
          htmlFor="project-parent"
        >
          <Select
            id="project-parent"
            required={requireParentId}
            value={state.parentId}
            onChange={(event) => update("parentId", event.target.value)}
          >
            <option value="">{requireParentId ? "请选择父项目" : "无（顶级项目）"}</option>
            {parentCandidates.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="项目状态" htmlFor="project-status">
          <Select
            id="project-status"
            value={state.status}
            onChange={(event) => update("status", event.target.value as ProjectStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <ModuleToggles
        allModules={allModules}
        enabled={state.enabledModules}
        onToggle={toggleModule}
      />

      <Field
        label="人员配置（可选）"
        htmlFor="project-team-lead"
        hint="从管理员菜单已配置的团队负责人中选择。这里设置后会默认应用到每个新建阶段，也可在阶段内单独调整。"
      >
        <Select
          id="project-team-lead"
          value={state.teamLeadPersonId}
          onChange={(event) => update("teamLeadPersonId", event.target.value)}
        >
          <option value="">暂不配置团队负责人</option>
          {teamLeadCandidates.map((candidate) => (
            <option key={candidate.personId} value={candidate.personId}>
              {candidate.personName}
              {candidate.departmentName ? ` · ${candidate.departmentName}` : ""}
              {candidate.personRole ? ` · ${candidate.personRole}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <PhaseEditor
        phases={state.phases}
        teamLeadCandidates={teamLeadCandidates}
        defaultTeamLeadPersonId={state.teamLeadPersonId}
        onChange={(phases) => update("phases", phases)}
      />

      {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "创建中…" : "创建项目"}
        </Button>
      </div>
    </form>
  );
}

function PhaseEditor({
  phases,
  teamLeadCandidates,
  defaultTeamLeadPersonId,
  onChange
}: {
  phases: ProjectPhaseDraft[];
  teamLeadCandidates: ProjectTeamLeadCandidate[];
  defaultTeamLeadPersonId: string;
  onChange: (phases: ProjectPhaseDraft[]) => void;
}) {
  const rows = phases.length > 0
    ? phases
    : [{ subject: "", description: "", startDate: "", dueDate: "", teamLeadPersonId: "" }];
  return (
    <div className="muted-card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <span className="label">项目阶段 *</span>
          <p className="hint" style={{ margin: "4px 0 0", fontSize: 11 }}>
            阶段创建后，团队负责人可在阶段下挂载项目节点。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange([...rows, { subject: "", description: "", startDate: "", dueDate: "", teamLeadPersonId: "" }])}
        >
          + 新增阶段
        </Button>
      </div>
      {rows.map((phase, index) => (
        <div key={index} style={{ display: "grid", gap: 8, borderTop: index === 0 ? undefined : "1px solid var(--border-muted)", paddingTop: index === 0 ? 0 : 10 }}>
          <Input
            value={phase.subject}
            placeholder={`阶段 ${index + 1} 名称，例如：样件试制与联调`}
            onChange={(event) => onChange(rows.map((item, itemIndex) =>
              itemIndex === index ? { ...item, subject: event.target.value } : item
            ))}
          />
          <Textarea
            rows={2}
            value={phase.description}
            placeholder="阶段目标、边界或验收口径"
            onChange={(event) => onChange(rows.map((item, itemIndex) =>
              itemIndex === index ? { ...item, description: event.target.value } : item
            ))}
          />
          <Select
            value={phase.teamLeadPersonId}
            onChange={(event) => onChange(rows.map((item, itemIndex) =>
              itemIndex === index ? { ...item, teamLeadPersonId: event.target.value } : item
            ))}
          >
            <option value="">
              {defaultTeamLeadPersonId ? "使用项目人员配置" : "暂不配置阶段团队负责人"}
            </option>
            {teamLeadCandidates.map((candidate) => (
              <option key={candidate.personId} value={candidate.personId}>
                {candidate.personName}
                {candidate.departmentName ? ` · ${candidate.departmentName}` : ""}
              </option>
            ))}
          </Select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
            <Input
              type="date"
              value={phase.startDate}
              onChange={(event) => onChange(rows.map((item, itemIndex) =>
                itemIndex === index ? { ...item, startDate: event.target.value } : item
              ))}
            />
            <Input
              type="date"
              value={phase.dueDate}
              onChange={(event) => onChange(rows.map((item, itemIndex) =>
                itemIndex === index ? { ...item, dueDate: event.target.value } : item
              ))}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={rows.length === 1}
              onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
            >
              删除
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizePhaseDrafts(phases: ProjectPhaseDraft[], defaultTeamLeadPersonId: string) {
  return phases
    .map((phase) => ({
      subject: phase.subject.trim(),
      description: phase.description.trim() || undefined,
      startDate: phase.startDate || undefined,
      dueDate: phase.dueDate || undefined,
      teamLeadPersonId: phase.teamLeadPersonId || defaultTeamLeadPersonId || undefined
    }))
    .filter((phase) => phase.subject.length > 0);
}

function Field({
  label,
  htmlFor,
  hint,
  children
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="hint" style={{ marginTop: 4, fontSize: 11 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ModuleToggles({
  allModules,
  enabled,
  onToggle
}: {
  allModules: ProjectModule[];
  enabled: ProjectModule[];
  onToggle: (module: ProjectModule) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="label">启用模块</span>
        <span className="hint" style={{ fontSize: 11 }}>
          已启用 {enabled.length} / {allModules.length}
        </span>
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 8, fontSize: 11 }}>
        勾选后会立即出现在项目侧边栏。Overview 是必选项。
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8
        }}
      >
        {allModules.map((module) => {
          const checked = enabled.includes(module);
          return (
            <label
              key={module}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                border: `1px solid ${checked ? "var(--accent-fg)" : "var(--border-default)"}`,
                borderRadius: 8,
                background: checked ? "var(--accent-subtle)" : "var(--bg-canvas)",
                cursor: "pointer",
                transition: "background 0.1s ease, border-color 0.1s ease",
                fontSize: 13
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(module)}
                disabled={module === "overview"}
                style={{ accentColor: "var(--accent-fg)" }}
              />
              <span style={{ color: checked ? "var(--accent-emphasis)" : "var(--fg-default)" }}>
                {moduleLabel(module)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
