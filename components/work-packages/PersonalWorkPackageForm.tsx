"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import { Textarea } from "@/components/primer/Textarea";
import {
  AttachmentPicker,
  RequirementListEditor,
  normalizeRequirementItems,
  type AttachmentDraft
} from "@/components/work-packages/WorkPackageFormFields";
import { userHasRole } from "@/lib/rbac";
import type { Person, Priority, Project, RiskLevel, User, WorkPackageType } from "@/lib/types";

interface PersonalWorkPackageFormProps {
  currentUser?: User;
  projects: Project[];
  people: Person[];
}

const TYPE_OPTIONS: Array<{ value: WorkPackageType; label: string }> = [
  { value: "task", label: "任务" },
  { value: "milestone", label: "里程碑" },
  { value: "risk", label: "风险" },
  { value: "phase", label: "阶段" }
];

const PRIORITY_OPTIONS: Priority[] = ["P0", "P1", "P2"];
const RISK_LEVEL_OPTIONS: RiskLevel[] = ["Low", "Medium", "High"];

/**
 * Full work package creation form for personal workspace flows.
 */
export function PersonalWorkPackageForm({
  currentUser,
  projects,
  people
}: PersonalWorkPackageFormProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState<WorkPackageType>("task");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("P1");
  const [assigneeId, setAssigneeId] = useState(currentUser?.personId ?? "");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("Medium");
  const [riskImpact, setRiskImpact] = useState("");
  const [riskMitigation, setRiskMitigation] = useState("");
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
          description,
          priority,
          assigneeId: assigneeId || undefined,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          estimateHours: estimateHours ? Number(estimateHours) : undefined,
          requiredSkills: parseCsv(requiredSkills),
          dependencies: parseNumberCsv(dependencies),
          requirements: normalizedRequirements,
          attachments,
          riskLevel: type === "risk" ? riskLevel : undefined,
          riskImpact: type === "risk" ? riskImpact : undefined,
          riskMitigation: type === "risk" ? riskMitigation : undefined
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建工作项失败。");
      }

      router.push("/my/page");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建工作项失败。");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) {
    return <p className="hint">请先在右上角选择一个演示账号。</p>;
  }

  return (
    <div className="surface">
      <div className="surface__body" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="项目">
            <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">个人事项</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="类型">
            <Select value={type} onChange={(event) => setType(event.target.value as WorkPackageType)}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="主题">
          <Input
            value={subject}
            placeholder="输入工作项标题"
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>

        <Field label="描述">
          <Textarea
            rows={4}
            value={description}
            placeholder="补充背景、验收口径或执行说明"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <RequirementListEditor
          value={requirements}
          onChange={setRequirements}
          required={isRequirementRequired}
        />

        <AttachmentPicker value={attachments} onChange={setAttachments} disabled={busy} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Field label="优先级">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="负责人">
            <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">未分配</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} · {person.role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="估时（小时）">
            <Input
              type="number"
              min={0}
              value={estimateHours}
              onChange={(event) => setEstimateHours(event.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="开始日期">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="截止日期">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="依赖 ID">
            <Input
              value={dependencies}
              placeholder="例如：1, 2, 3"
              onChange={(event) => setDependencies(event.target.value)}
            />
          </Field>
          <Field label="所需技能">
            <Input
              value={requiredSkills}
              placeholder="例如：前端实现, 测试设计"
              onChange={(event) => setRequiredSkills(event.target.value)}
            />
          </Field>
        </div>

        {type === "risk" ? (
          <div className="muted-card" style={{ padding: 12, display: "grid", gap: 10 }}>
            <Field label="风险等级">
              <Select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}>
                {RISK_LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="风险影响">
              <Textarea rows={2} value={riskImpact} onChange={(event) => setRiskImpact(event.target.value)} />
            </Field>
            <Field label="缓解措施">
              <Textarea
                rows={2}
                value={riskMitigation}
                onChange={(event) => setRiskMitigation(event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" disabled={busy} onClick={() => router.push("/my/page")}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={
              busy ||
              !subject.trim() ||
              (isRequirementRequired && normalizeRequirementItems(requirements).length === 0)
            }
            onClick={submit}
          >
            {busy ? "创建中…" : "创建工作项"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberCsv(value: string): number[] {
  return parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}
