"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/primer/Button";

interface ProjectDeleteButtonProps {
  identifier: string;
  projectName: string;
  currentUserId: string;
}

/**
 * Deletes a project through the creator-only project API.
 */
export function ProjectDeleteButton({
  identifier,
  projectName,
  currentUserId
}: ProjectDeleteButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`确认删除项目「${projectName}」？其阶段、节点和任务会一并删除。`)) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${identifier}`, {
        method: "DELETE",
        headers: { "x-user-id": currentUserId }
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "删除项目失败。");
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "删除项目失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="danger" disabled={busy} onClick={handleDelete}>
      {busy ? "删除中…" : "删除"}
    </Button>
  );
}
