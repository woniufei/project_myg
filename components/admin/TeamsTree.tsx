"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Surface } from "@/components/primer/Surface";
import type { Team } from "@/lib/types";

interface TeamsTreeProps {
  teamsPromise: Promise<Team[]>;
  people: {
    id: string;
    name: string;
    role?: string;
    externalId?: string;
    departmentName?: string;
  }[];
}

export function TeamsTree({ teamsPromise, people }: TeamsTreeProps) {
  const teams = use(teamsPromise);
  const router = useRouter();
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLeadId, setEditLeadId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 创建新团队状态
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLeadId, setNewLeadId] = useState<string | undefined>(undefined);

  const getPersonName = (personId?: string) =>
    personId ? people.find((p) => p.id === personId)?.name ?? personId : "—";

  const startEdit = useCallback((team: Team) => {
    setEditingTeam(team.id);
    setEditName(team.name);
    setEditDescription(team.description ?? "");
    setEditLeadId(team.leadId);
    setMessage(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingTeam(null);
    setEditName("");
    setEditDescription("");
    setEditLeadId(undefined);
    setMessage(null);
  }, []);

  const saveTeam = useCallback(async (teamId: string) => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          description: editDescription || undefined,
          leadId: editLeadId || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存失败");
      }

      setMessage({ type: "success", text: "团队更新成功。" });
      setEditingTeam(null);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }, [editName, editDescription, editLeadId]);

  const deleteTeam = useCallback(async (teamId: string) => {
    if (!confirm("确定删除此团队？此操作不可恢复。")) return;

    setMessage(null);

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "删除失败");
      }

      setMessage({ type: "success", text: "团队已删除。" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  }, []);

  const toggleMember = useCallback(async (teamId: string, personId: string, selected: boolean) => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: selected ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "成员配置失败");
      }

      setMessage({ type: "success", text: selected ? "成员已添加。" : "成员已移除。" });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }, [router]);

  const createTeam = useCallback(async () => {
    if (!newName.trim()) {
      setMessage({ type: "error", text: "团队名称不能为空。" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription || undefined,
          leadId: newLeadId || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "创建失败");
      }

      setMessage({ type: "success", text: "团队已创建。" });
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewLeadId(undefined);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }, [newName, newDescription, newLeadId]);

  return (
    <Surface
      title={`团队管理 (${teams.length})`}
      description="管理团队结构、负责人及成员。"
      flush
    >
      {message && (
        <div
          style={{
            padding: "8px 16px",
            background: message.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
            color: message.type === "success" ? "var(--success-fg)" : "var(--danger-fg)",
            fontSize: 13
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-default)" }}>
        <button
          className="btn"
          data-size="sm"
          data-variant="primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? "取消创建" : "创建团队"}
        </button>
      </div>

      {showCreate && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <input
            className="input"
            placeholder="团队名称 *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13 }}
          />
          <input
            className="input"
            placeholder="描述（可选）"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13 }}
          />
          <select
            className="input"
            value={newLeadId ?? ""}
            onChange={(e) => setNewLeadId(e.target.value || undefined)}
            style={{ padding: "6px 10px", fontSize: 13 }}
          >
            <option value="">选择团队负责人（可选）</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div>
            <button
              className="btn"
              data-size="sm"
              data-variant="primary"
              onClick={createTeam}
              disabled={saving}
            >
              {saving ? "创建中…" : "创建"}
            </button>
          </div>
        </div>
      )}

      <table className="data-table">
        <colgroup>
          <col />
          <col style={{ width: 140 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 100 }} />
        </colgroup>
        <thead>
          <tr>
            <th>团队名称</th>
            <th>负责人</th>
            <th>来源</th>
            <th>成员</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td>
                {editingTeam === team.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ padding: "4px 8px", fontSize: 13 }}
                    />
                    <input
                      className="input"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="描述"
                      style={{ padding: "4px 8px", fontSize: 13 }}
                    />
                  </div>
                ) : (
                  <>
                    <strong style={{ fontSize: 13 }}>{team.name}</strong>
                    {team.description && (
                      <p className="hint" style={{ margin: "2px 0 0", fontSize: 11 }}>
                        {team.description}
                      </p>
                    )}
                  </>
                )}
              </td>
              <td>
                {editingTeam === team.id ? (
                  <select
                    className="input"
                    value={editLeadId ?? ""}
                    onChange={(e) => setEditLeadId(e.target.value || undefined)}
                    style={{ padding: "4px 8px", fontSize: 12, width: "100%" }}
                  >
                    <option value="">未设置</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 13 }}>{getPersonName(team.leadId)}</span>
                )}
              </td>
              <td>
                {team.externalId ? (
                  <Badge tone="accent">飞书</Badge>
                ) : (
                  <span className="hint" style={{ fontSize: 12 }}>
                    手动
                  </span>
                )}
              </td>
              <td style={{ fontSize: 13 }}>
                {editingTeam === team.id ? (
                  <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                    {people.map((person) => {
                      const selected = Boolean(team.memberIds?.includes(person.id));
                      return (
                        <label
                          key={person.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            fontSize: 12
                          }}
                        >
                          <span>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={saving}
                              onChange={(event) => toggleMember(team.id, person.id, event.target.checked)}
                              style={{ marginRight: 6 }}
                            />
                            {person.name}
                            <span className="hint"> · {person.role ?? "成员"}</span>
                          </span>
                          {person.externalId ? <Badge tone="accent">飞书</Badge> : null}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(team.memberIds ?? []).slice(0, 4).map((personId) => (
                      <Badge key={personId} tone="default">
                        {getPersonName(personId)}
                      </Badge>
                    ))}
                    {(team.memberIds?.length ?? 0) > 4 ? (
                      <span className="hint">+{(team.memberIds?.length ?? 0) - 4}</span>
                    ) : null}
                    {(team.memberIds?.length ?? 0) === 0 ? <span className="hint">暂无成员</span> : null}
                  </div>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {editingTeam === team.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      className="btn"
                      data-size="sm"
                      data-variant="primary"
                      onClick={() => saveTeam(team.id)}
                      disabled={saving}
                    >
                      {saving ? "保存中…" : "保存"}
                    </button>
                    <button
                      className="btn"
                      data-size="sm"
                      data-variant="ghost"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      className="btn"
                      data-size="sm"
                      data-variant="ghost"
                      onClick={() => startEdit(team)}
                    >
                      编辑
                    </button>
                    <button
                      className="btn"
                      data-size="sm"
                      data-variant="ghost"
                      onClick={() => deleteTeam(team.id)}
                      style={{ color: "var(--danger-fg)" }}
                    >
                      删除
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}