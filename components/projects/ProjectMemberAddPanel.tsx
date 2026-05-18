"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primer/Button";
import { Select } from "@/components/primer/Select";
import { Badge } from "@/components/primer/Badge";
import { roleLabels } from "@/lib/rbac";
import type { ProjectMemberCandidate } from "@/lib/services/project-workflow";
import type { User } from "@/lib/types";

interface ProjectMemberAddPanelProps {
  projectIdentifier: string;
  currentUser?: User;
  candidates: ProjectMemberCandidate[];
}

/**
 * Adds a visible lower-role user into the current project membership.
 */
export function ProjectMemberAddPanel({
  projectIdentifier,
  currentUser,
  candidates
}: ProjectMemberAddPanelProps) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isLead, setIsLead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const selectedCandidate = candidates.find((candidate) => candidate.userId === selectedUserId);
  const canSetProjectLead = currentUser?.role === "admin" || currentUser?.role === "projectManager";

  async function addMember() {
    if (!currentUser || !selectedUserId) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectIdentifier}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({
          userId: selectedUserId,
          isLead: canSetProjectLead ? isLead : false
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "添加成员失败。");
      }

      setSelectedUserId("");
      setIsLead(false);
      setMessage({ type: "success", text: "成员已添加到项目。" });
      router.refresh();
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "添加成员失败。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="muted-card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>添加成员</p>
          <p className="hint" style={{ margin: "4px 0 0", fontSize: 12 }}>
            候选成员来自当前账号可管辖范围，已在项目内的成员不会重复展示。
          </p>
        </div>
        {selectedCandidate?.externalId ? <Badge tone="accent">飞书同步</Badge> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto auto", gap: 8, alignItems: "center" }}>
        <Select
          value={selectedUserId}
          disabled={busy || candidates.length === 0}
          onChange={(event) => setSelectedUserId(event.target.value)}
        >
          <option value="">{candidates.length === 0 ? "暂无可添加成员" : "选择要添加的成员"}</option>
          {candidates.map((candidate) => (
            <option key={candidate.userId} value={candidate.userId}>
              {candidate.userName} · {roleLabels[candidate.role]} · {candidate.personRole}
              {candidate.departmentName ? ` · ${candidate.departmentName}` : ""}
            </option>
          ))}
        </Select>
        {canSetProjectLead ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={isLead}
              disabled={busy || !selectedUserId}
              onChange={(event) => setIsLead(event.target.checked)}
            />
            设为项目负责人
          </label>
        ) : null}
        <Button
          size="sm"
          variant="primary"
          disabled={busy || !selectedUserId}
          onClick={addMember}
        >
          {busy ? "添加中…" : "添加成员"}
        </Button>
      </div>

      {message ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: message.type === "success" ? "var(--success-fg)" : "var(--danger-fg)"
          }}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
