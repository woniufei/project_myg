"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import { Surface } from "@/components/primer/Surface";
import { Textarea } from "@/components/primer/Textarea";
import {
  RequirementListEditor,
  normalizeRequirementItems
} from "@/components/work-packages/WorkPackageFormFields";
import { userHasRole } from "@/lib/rbac";
import type { Person, Priority, RiskLevel, User, WorkPackage, WorkPackageType } from "@/lib/types";

interface ProjectWorkPackageCreateFormProps {
  currentUser?: User;
  projectId: string;
  projectName: string;
  projectIdentifier: string;
  people: Person[];
  workPackages: WorkPackage[];
}

const TYPE_OPTIONS: Array<{ value: WorkPackageType; label: string }> = [
  { value: "task", label: "任务" },
  { value: "milestone", label: "里程碑" },
  { value: "risk", label: "风险" },
  { value: "phase", label: "阶段" }
];

const PRIORITY_OPTIONS: Priority[] = ["P0", "P1", "P2"];
const RISK_LEVEL_OPTIONS: RiskLevel[] = ["Low", "Medium", "High"];

function resolveTypeOptions(user?: User): Array<{ value: WorkPackageType; label: string }> {
  if (user?.role === "projectManager") {
    return TYPE_OPTIONS.filter((option) => option.value === "phase");
  }
  if (user?.role === "teamLead") {
    return TYPE_OPTIONS.filter((option) => option.value === "milestone" || option.value === "task");
  }
  return [];
}

export function ProjectWorkPackageCreateForm({
  currentUser,
  projectId,
  projectName,
  projectIdentifier,
  people,
  workPackages
}: ProjectWorkPackageCreateFormProps) {
  const router = useRouter();

  const [type, setType] = useState<WorkPackageType>(
    currentUser?.role === "projectManager" ? "phase" : "milestone"
  );
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("P1");
  const [memberAssignments, setMemberAssignments] = useState([
    { personId: "", role: "主负责人", responsibility: "" }
  ]);
  const [parentId, setParentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("Medium");
  const [riskImpact, setRiskImpact] = useState("");
  const [riskMitigation, setRiskMitigation] = useState("");
  const [requirements, setRequirements] = useState([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRequirementRequired =
    userHasRole(currentUser, "admin") ||
    userHasRole(currentUser, "projectManager") ||
    userHasRole(currentUser, "teamLead");
  const typeOptions = resolveTypeOptions(currentUser);
  const parentCandidates = type === "task"
    ? workPackages.filter((wp) => wp.type === "milestone")
    : workPackages.filter((wp) => wp.type === "phase");

  async function handleSubmit() {
    if (!currentUser || !subject.trim()) {
      return;
    }
    const normalizedRequirements = normalizeRequirementItems(requirements);
    const normalizedAssignments = normalizeAssignmentItems(memberAssignments);
    if (isRequirementRequired && normalizedRequirements.length === 0) {
      setError("当前角色创建工作项时至少需要填写 1 条需求项。");
      return;
    }
    if (currentUser.role === "teamLead" && !parentId) {
      setError(type === "task" ? "创建任务时必须选择所属节点。" : "创建节点时必须选择所属阶段。");
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
          projectId,
          type,
          subject: subject.trim(),
          description,
          priority,
          assigneeId: normalizedAssignments[0]?.personId,
          memberAssignments: normalizedAssignments,
          parentId: parentId ? Number(parentId) : undefined,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          estimateHours: estimateHours ? Number(estimateHours) : undefined,
          requiredSkills: parseCsv(requiredSkills),
          dependencies: parseNumberCsv(dependencies),
          requirements: normalizedRequirements,
          riskLevel: type === "risk" ? riskLevel : undefined,
          riskImpact: type === "risk" ? riskImpact : undefined,
          riskMitigation: type === "risk" ? riskMitigation : undefined
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建工作项失败。");
      }

      router.push(`/projects/${projectIdentifier}/work-packages`);
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
  if (typeOptions.length === 0) {
    return <p className="hint">当前角色不能在项目内创建阶段、节点或任务。</p>;
  }

  return (
    <Surface>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="类型">
            <Select value={type} onChange={(event) => setType(event.target.value as WorkPackageType)}>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="所属项目">
            <Input value={projectName} disabled />
          </Field>
        </div>

        {currentUser.role === "teamLead" ? (
          <Field label={type === "task" ? "所属节点" : "所属阶段"}>
            <Select value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">{type === "task" ? "请选择项目节点" : "请选择项目阶段"}</option>
              {parentCandidates.map((workPackage) => (
                <option key={workPackage.id} value={workPackage.id}>
                  #{workPackage.id} {workPackage.subject}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

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

        <Field label="成员分工">
          <div className="muted-card" style={{ padding: 10, display: "grid", gap: 8 }}>
            {memberAssignments.map((assignment, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 0.8fr) minmax(100px, 0.6fr) 1fr auto", gap: 8 }}>
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
                  <option value="">选择成员</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} · {person.role}
                    </option>
                  ))}
                </Select>
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
                <Input
                  value={assignment.responsibility}
                  placeholder="分工说明，例如：接口联调与自测"
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
                  onClick={() => setMemberAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  删除
                </Button>
              </div>
            ))}
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setMemberAssignments((current) => [
                    ...current,
                    { personId: "", role: "协作成员", responsibility: "" }
                  ])
                }
              >
                + 新增成员
              </Button>
            </div>
          </div>
        </Field>

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
          <Button variant="ghost" disabled={busy} onClick={() => router.back()}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={busy || !subject.trim() || (isRequirementRequired && normalizeRequirementItems(requirements).length === 0)}
            onClick={handleSubmit}
          >
            {busy ? "创建中…" : "创建工作项"}
          </Button>
        </div>
      </div>
    </Surface>
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

function normalizeAssignmentItems(
  items: Array<{ personId: string; role: string; responsibility: string }>
) {
  const seen = new Set<string>();
  return items
    .map((item, index) => ({
      personId: item.personId.trim(),
      role: item.role.trim() || (index === 0 ? "主负责人" : "协作成员"),
      responsibility: item.responsibility.trim(),
      sortOrder: index
    }))
    .filter((item) => {
      if (!item.personId || seen.has(item.personId)) {
        return false;
      }
      seen.add(item.personId);
      return true;
    });
}

function parseNumberCsv(value: string): number[] {
  return parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}