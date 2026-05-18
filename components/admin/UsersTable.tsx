"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/primer/Badge";
import { Surface } from "@/components/primer/Surface";
import { roleLabels } from "@/lib/rbac";
import type { User, PlatformRole } from "@/lib/types";

const allRoles: PlatformRole[] = ["admin", "projectManager", "teamLead", "participant"];

const roleToneMap: Record<PlatformRole, "danger" | "accent" | "success" | "default"> = {
  admin: "danger",
  projectManager: "accent",
  teamLead: "success",
  participant: "default"
};

interface UsersTableProps {
  users: User[];
  people: { id: string; name: string; externalId?: string; departmentName?: string }[];
  canEdit?: boolean;
}

export function UsersTable({ users, people, canEdit = true }: UsersTableProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<PlatformRole>("participant");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const startEdit = useCallback((user: User) => {
    setEditingUserId(user.id);
    setSelectedRole(user.role);
    setMessage(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingUserId(null);
    setSelectedRole("participant");
    setMessage(null);
  }, []);

  const saveRoles = useCallback(async () => {
    if (!editingUserId) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/users/${editingUserId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: [selectedRole] })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存失败");
      }

      setMessage({ type: "success", text: "角色更新成功。" });
      setEditingUserId(null);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }, [editingUserId, selectedRole]);

  const getPersonName = (personId: string) =>
    people.find((p) => p.id === personId)?.name ?? personId;
  const personLookup = new Map(people.map((person) => [person.id, person]));

  return (
    <Surface title={`用户管理 (${users.length})`} description="管理平台用户的角色分配。" flush>
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
      <table className="data-table">
        <colgroup>
          <col />
          <col style={{ width: 160 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 80 }} />
        </colgroup>
        <thead>
          <tr>
            <th>用户</th>
            <th>角色</th>
            <th>来源</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <strong style={{ fontSize: 13 }}>{user.name}</strong>
                <p className="hint mono" style={{ margin: "2px 0 0", fontSize: 11 }}>
                  {getPersonName(user.personId)}
                </p>
              </td>
              <td>
                {canEdit && editingUserId === user.id ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {allRoles.map((role) => (
                      <label
                        key={role}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: selectedRole === role
                            ? "var(--accent-bg)"
                            : "var(--bg-subtle)"
                        }}
                      >
                        <input
                          type="radio"
                          name={`role-${user.id}`}
                          checked={selectedRole === role}
                          onChange={() => setSelectedRole(role)}
                          style={{ margin: 0 }}
                        />
                        {roleLabels[role]}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <Badge tone={roleToneMap[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  </div>
                )}
              </td>
              <td>
                {personLookup.get(user.personId)?.externalId ? (
                  <Badge tone="accent">飞书</Badge>
                ) : (
                  <span className="hint" style={{ fontSize: 12 }}>
                    手动
                  </span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {canEdit && editingUserId === user.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      className="btn"
                      data-size="sm"
                      data-variant="primary"
                      onClick={saveRoles}
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
                ) : canEdit ? (
                  <button
                    className="btn"
                    data-size="sm"
                    data-variant="ghost"
                    onClick={() => startEdit(user)}
                  >
                    编辑
                  </button>
                ) : (
                  <span className="hint" style={{ fontSize: 12 }}>只读</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}