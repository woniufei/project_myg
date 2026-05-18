"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/primer/Button";
import { Select } from "@/components/primer/Select";
import { Surface } from "@/components/primer/Surface";
import { permissionMatrix } from "@/lib/permissions";
import type {
  PermissionEffect,
  PermissionOverride,
  PermissionScopeType,
  Project,
  Team,
  User
} from "@/lib/types";

interface PermissionOverridesPanelProps {
  currentUser?: User;
  users: User[];
  projects?: Project[];
  teams?: Team[];
  fixedScope?: {
    type: PermissionScopeType;
    id?: string;
    label: string;
  };
}

/**
 * Operation-level permission editor for administrator-managed global, project, and team scopes.
 */
export function PermissionOverridesPanel({
  currentUser,
  users,
  projects = [],
  teams = [],
  fixedScope
}: PermissionOverridesPanelProps) {
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [subjectId, setSubjectId] = useState(users[0]?.id ?? "");
  const [permissionKey, setPermissionKey] = useState(permissionMatrix[0]?.key ?? "");
  const [effect, setEffect] = useState<PermissionEffect>("allow");
  const [scopeType, setScopeType] = useState<PermissionScopeType>(fixedScope?.type ?? "global");
  const [scopeId, setScopeId] = useState(fixedScope?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleOverrides = useMemo(
    () =>
      fixedScope
        ? overrides.filter(
            (item) => item.scopeType === fixedScope.type && (item.scopeId ?? "") === (fixedScope.id ?? "")
          )
        : overrides,
    [fixedScope, overrides]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/permissions");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { overrides?: PermissionOverride[] };
      if (!cancelled) {
        setOverrides(payload.overrides ?? []);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveOverride() {
    if (!currentUser || !subjectId || !permissionKey) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "user",
          subjectId,
          permissionKey,
          effect,
          scopeType: fixedScope?.type ?? scopeType,
          scopeId: fixedScope?.id ?? (scopeType === "global" ? null : scopeId)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        override?: PermissionOverride;
        error?: string;
      };
      if (!response.ok || !payload.override) {
        throw new Error(payload.error ?? "保存权限失败。");
      }
      setOverrides((current) => [
        payload.override!,
        ...current.filter((item) => item.id !== payload.override!.id)
      ]);
      setMessage("权限已保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存权限失败。");
    } finally {
      setBusy(false);
    }
  }

  async function removeOverride(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/permissions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "删除权限失败。");
      }
      setOverrides((current) => current.filter((item) => item.id !== id));
      setMessage("权限覆盖已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除权限失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface
      title="操作级权限配置"
      description={fixedScope ? `当前范围：${fixedScope.label}` : "配置用户在全局、项目或团队范围内的按钮/API 操作权限。"}
      flush
    >
      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        {message ? <p className="hint" style={{ margin: 0 }}>{message}</p> : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Select value={permissionKey} onChange={(event) => setPermissionKey(event.target.value)}>
            {permissionMatrix.map((permission) => (
              <option key={permission.key} value={permission.key}>
                {permission.label}
              </option>
            ))}
          </Select>
          <Select value={effect} onChange={(event) => setEffect(event.target.value as PermissionEffect)}>
            <option value="allow">允许</option>
            <option value="deny">拒绝</option>
          </Select>
          {!fixedScope ? (
            <>
              <Select value={scopeType} onChange={(event) => setScopeType(event.target.value as PermissionScopeType)}>
                <option value="global">全局</option>
                <option value="project">项目</option>
                <option value="team">团队</option>
              </Select>
              {scopeType === "project" ? (
                <Select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                  <option value="">选择项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              {scopeType === "team" ? (
                <Select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                  <option value="">选择团队</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              ) : null}
            </>
          ) : null}
          <Button variant="primary" disabled={busy || !subjectId} onClick={saveOverride}>
            保存权限
          </Button>
        </div>
      </div>
      <div className="scroll-x">
        <table className="data-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>用户/团队</th>
              <th>权限</th>
              <th>效果</th>
              <th>范围</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleOverrides.map((item) => (
              <tr key={item.id}>
                <td>{resolveUserName(users, item.subjectId)}</td>
                <td>{permissionMatrix.find((permission) => permission.key === item.permissionKey)?.label ?? item.permissionKey}</td>
                <td>{item.effect === "allow" ? "允许" : "拒绝"}</td>
                <td>{describeScope(item, projects, teams)}</td>
                <td style={{ textAlign: "right" }}>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => removeOverride(item.id)}>
                    删除
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function resolveUserName(users: User[], userId: string) {
  return users.find((user) => user.id === userId)?.name ?? userId;
}

function describeScope(item: PermissionOverride, projects: Project[], teams: Team[]) {
  if (item.scopeType === "global") {
    return "全局";
  }
  if (item.scopeType === "project") {
    return projects.find((project) => project.id === item.scopeId)?.name ?? item.scopeId ?? "项目";
  }
  return teams.find((team) => team.id === item.scopeId)?.name ?? item.scopeId ?? "团队";
}
