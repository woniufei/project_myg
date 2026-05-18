"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Select } from "@/components/primer/Select";
import { Surface } from "@/components/primer/Surface";
import type { ExternalRoleCandidate } from "@/lib/services/admin-role-workflow";
import { roleLabels } from "@/lib/rbac";
import type { Project, Team } from "@/lib/types";

interface LeadershipAssignmentPanelProps {
  candidates: ExternalRoleCandidate[];
  projects: Project[];
  teams: Team[];
}

/**
 * Assigns platform leadership roles from the Feishu-synced external directory.
 */
export function LeadershipAssignmentPanel({
  candidates,
  projects,
  teams
}: LeadershipAssignmentPanelProps) {
  const router = useRouter();
  const [role, setRole] = useState<"projectManager" | "teamLead">("projectManager");
  const [externalPersonId, setExternalPersonId] = useState(candidates[0]?.externalPersonId ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.externalPersonId === externalPersonId),
    [candidates, externalPersonId]
  );
  const targetOptionsReady = role === "projectManager" ? Boolean(projectId) : Boolean(teamId);

  async function saveAssignment() {
    if (!externalPersonId || !targetOptionsReady) {
      setMessage({ tone: "danger", text: "请选择人员和配置范围。" });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/role-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalPersonId,
          role,
          projectId: role === "projectManager" ? projectId : undefined,
          teamId: role === "teamLead" ? teamId : undefined
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "添加失败。");
      }
      setMessage({
        tone: "success",
        text: role === "projectManager" ? "项目经理已添加。" : "团队负责人已添加。"
      });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "添加失败。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface
      title="添加项目经理 / 团队负责人"
      description="人员来源于飞书同步外部人员表，保存后会创建或更新平台账号并写入项目/团队关系。"
      flush
    >
      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        {message ? (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: message.tone === "success" ? "var(--success-fg)" : "var(--danger-fg)"
            }}
          >
            {message.text}
          </p>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <Select value={role} onChange={(event) => setRole(event.target.value as "projectManager" | "teamLead")}>
            <option value="projectManager">添加项目经理</option>
            <option value="teamLead">添加团队负责人</option>
          </Select>
          <Select
            value={externalPersonId}
            disabled={busy || candidates.length === 0}
            onChange={(event) => setExternalPersonId(event.target.value)}
          >
            <option value="">{candidates.length === 0 ? "暂无飞书同步人员" : "选择飞书人员"}</option>
            {candidates.map((candidate) => (
              <option key={candidate.externalPersonId} value={candidate.externalPersonId}>
                {candidate.name}
                {candidate.jobTitle ? ` · ${candidate.jobTitle}` : ""}
                {candidate.departmentName ? ` · ${candidate.departmentName}` : ""}
              </option>
            ))}
          </Select>
          {role === "projectManager" ? (
            <Select value={projectId} disabled={busy || projects.length === 0} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">选择项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          ) : (
            <Select value={teamId} disabled={busy || teams.length === 0} onChange={(event) => setTeamId(event.target.value)}>
              <option value="">选择团队</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          )}
          <Button variant="primary" disabled={busy || !externalPersonId || !targetOptionsReady} onClick={saveAssignment}>
            {busy ? "保存中..." : "保存添加"}
          </Button>
        </div>

        {selectedCandidate ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone="accent">飞书同步</Badge>
            {selectedCandidate.isLeader ? <Badge tone="success">外部负责人</Badge> : null}
            {selectedCandidate.currentRole ? (
              <Badge tone="default">当前：{roleLabels[selectedCandidate.currentRole]}</Badge>
            ) : (
              <Badge tone="default">未创建平台账号</Badge>
            )}
            <span className="hint mono" style={{ fontSize: 11 }}>
              {selectedCandidate.externalId}
            </span>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
