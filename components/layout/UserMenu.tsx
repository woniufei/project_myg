"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { roleLabels } from "@/lib/rbac";
import type { User } from "@/lib/types";

interface UserMenuProps {
  currentUser?: User;
}

const DEMO_ACCOUNTS: Array<{ id: string; name: string; role: User["role"] }> = [
  { id: "u-admin", name: "平台管理员", role: "admin" },
  { id: "u-pm", name: "项目经理", role: "projectManager" },
  { id: "u-teamlead", name: "团队负责人", role: "teamLead" },
  { id: "u-member", name: "项目参与员", role: "participant" }
];

/**
 * Top-bar avatar + role switcher. The MVP carries the active user via the
 * `x-user-id` header read in route handlers; this menu lets demo viewers
 * switch role without manually editing requests.
 */
export function UserMenu({ currentUser }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function selectUser(userId: string) {
    setOpen(false);
    const account = DEMO_ACCOUNTS.find((item) => item.id === userId);
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
    } catch {
      // ignore network errors; the next refresh will keep the prior cookie
    }
    router.push(account?.role === "admin" ? "/admin" : "/my/page");
    router.refresh();
  }

  const initial = currentUser?.name.slice(0, 1) ?? "?";
  const title = currentUser
    ? `${currentUser.name} · ${roleLabels[currentUser.role]}`
    : "选择演示账号";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn"
        data-variant="ghost"
        data-size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ padding: 4, gap: 0 }}
        title={title}
      >
        <span
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--accent-fg)",
            color: "var(--fg-on-emphasis)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 11
          }}
        >
          {initial}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 224,
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-medium)",
            boxShadow: "var(--shadow-large)",
            padding: 6,
            zIndex: 40
          }}
        >
          <div style={{ padding: "8px 10px 6px" }}>
            <strong style={{ display: "block", fontSize: 13, color: "var(--fg-default)" }}>
              {currentUser?.name ?? "未登录"}
            </strong>
            <p className="hint" style={{ margin: 0, fontSize: 11 }}>
              {currentUser ? roleLabels[currentUser.role] : "请选择下方演示账号"}
            </p>
          </div>
          <hr className="divider" />
          <p className="sidebar-section-title" style={{ padding: "4px 10px 4px", marginBottom: 2 }}>
            演示账号
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.id}
                type="button"
                className="sidebar-link"
                data-active={currentUser?.id === account.id}
                onClick={() => selectUser(account.id)}
                style={{ border: "none", background: undefined, textAlign: "left" }}
              >
                <span className="sidebar-link__icon">{currentUser?.id === account.id ? <CheckIcon /> : <DotIcon />}</span>
                <span style={{ flex: 1 }}>{account.name}</span>
                <span className="hint" style={{ fontSize: 11 }}>
                  {roleLabels[account.role]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}
