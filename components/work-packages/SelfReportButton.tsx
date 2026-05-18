"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primer/Button";

interface SelfReportButtonProps {
  workPackageId: number;
  currentUserId: string;
  /** 当前核对状态，决定按钮是否可用 */
  verificationStatus?: string;
  /** 是否复核条件（assignee 本人） */
  canReport: boolean;
}

/**
 * "提交完成" 按钮 —— 团队成员自报工作项完成。
 * 核对状态为 pending 或 rejected 时可用。
 */
export function SelfReportButton({
  workPackageId,
  currentUserId,
  verificationStatus,
  canReport,
}: SelfReportButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVisible =
    canReport &&
    (verificationStatus === "pending" || verificationStatus === "rejected");

  if (!isVisible) return null;

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/work-packages/${workPackageId}/self-report`,
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
        throw new Error(payload.error ?? "提交失败");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        variant={verificationStatus === "rejected" ? "danger" : "primary"}
        size="sm"
        disabled={busy}
        onClick={handleClick}
      >
        {busy
          ? "提交中…"
          : verificationStatus === "rejected"
            ? "重新提交完成"
            : "提交完成"}
      </Button>
      {error ? (
        <p style={{ color: "var(--danger-fg)", fontSize: 12, margin: "4px 0 0" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}