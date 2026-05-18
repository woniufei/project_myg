"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Textarea } from "@/components/primer/Textarea";
import type { VerificationStatus } from "@/lib/types";
import type { BadgeTone } from "@/components/primer/Badge";

const STATUS_LABEL: Record<string, string> = {
  notRequired: "无需核对",
  pending: "待核对",
  selfReportedDone: "已提交完成",
  verified: "已核对通过",
  rejected: "已驳回",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  notRequired: "default",
  pending: "attention",
  selfReportedDone: "accent",
  verified: "success",
  rejected: "danger",
};

interface VerificationPanelProps {
  workPackageId: number;
  currentUserId: string;
  verificationStatus?: VerificationStatus;
  requiresVerification?: boolean;
  rejectedReason?: string;
  canVerify: boolean;
}

/**
 * 核对面板 —— 展示核对状态并提供通过/驳回操作。
 * 仅对 requiresVerification = true 的工作项渲染。
 */
export function VerificationPanel({
  workPackageId,
  currentUserId,
  verificationStatus = "notRequired",
  requiresVerification,
  rejectedReason,
  canVerify,
}: VerificationPanelProps) {
  const router = useRouter();
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 不要求核对 → 不显示
  if (!requiresVerification) return null;

  const statusKey = verificationStatus ?? "notRequired";
  const showActions = canVerify && statusKey === "selfReportedDone";

  async function handleVerify() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/work-packages/${workPackageId}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUserId,
          },
        }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "核对失败");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "核对失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/work-packages/${workPackageId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUserId,
          },
          body: JSON.stringify({ rejectedReason: rejectReason.trim() }),
        }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "驳回失败");
      }
      setRejectReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "驳回失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <h3 style={{ fontSize: 13, margin: 0, fontWeight: 600, color: "var(--fg-default)" }}>
          核对状态
        </h3>
        <Badge tone={STATUS_TONE[statusKey] ?? "default"}>
          {STATUS_LABEL[statusKey] ?? statusKey}
        </Badge>
      </header>

      {statusKey === "rejected" && rejectedReason ? (
        <div
          className="muted-card"
          style={{
            padding: 10,
            marginBottom: 8,
            borderLeft: "3px solid var(--danger-fg)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--danger-fg)" }}>
            驳回原因
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13 }}>{rejectedReason}</p>
        </div>
      ) : null}

      {showActions ? (
        <div className="muted-card" style={{ padding: 10 }}>
          <Textarea
            value={rejectReason}
            rows={2}
            placeholder="如需驳回，请填写原因…"
            onChange={(event) => setRejectReason(event.target.value)}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
            <Button
              size="sm"
              variant="danger"
              disabled={busy || !rejectReason.trim()}
              onClick={handleReject}
            >
              {busy ? "处理中…" : "驳回"}
            </Button>
            <Button size="sm" variant="success" disabled={busy} onClick={handleVerify}>
              {busy ? "处理中…" : "核对通过"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p style={{ color: "var(--danger-fg)", margin: "4px 0 0", fontSize: 12 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}