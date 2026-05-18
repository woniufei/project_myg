"use client";

import { useState } from "react";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";

export interface AttachmentDraft {
  fileName: string;
  contentType: string;
  size: number;
  dataUrl: string;
}

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ATTACHMENT_ACCEPT = [
  "image/*",
  "application/pdf",
  "text/*",
  ".txt",
  ".md",
  ".csv",
  ".tsv",
  ".json",
  ".xls",
  ".xlsx",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
].join(",");

interface RequirementListEditorProps {
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  compact?: boolean;
}

/**
 * Shared dynamic requirement editor used by project and personal work-package forms.
 */
export function RequirementListEditor({
  value,
  onChange,
  required,
  compact
}: RequirementListEditorProps) {
  const items = value.length > 0 ? value : [""];

  return (
    <div className="muted-card" style={{ padding: compact ? 8 : 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span className="label">需求项{required ? " *" : ""}</span>
        <span className="hint" style={{ fontSize: 12 }}>
          逐条填写，可点击新增需求
        </span>
      </div>
      {items.map((item, index) => (
        <div key={index} style={{ display: "flex", gap: 8 }}>
          <Input
            value={item}
            placeholder="需求项，例如：验证接口权限拒绝路径"
            onChange={(event) =>
              onChange(items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))
            }
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={items.length === 1}
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            删除
          </Button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <Button size="sm" variant="ghost" onClick={() => onChange([...items, ""])}>
          + 新增需求
        </Button>
      </div>
    </div>
  );
}

interface AttachmentPickerProps {
  value: AttachmentDraft[];
  onChange: (value: AttachmentDraft[]) => void;
  disabled?: boolean;
}

/**
 * Reads small evidence files into data URLs so the demo SQLite backend can
 * persist and preview work-package attachments without an object store.
 */
export function AttachmentPicker({ value, onChange, disabled }: AttachmentPickerProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setError(null);
    const nextFiles = Array.from(files);
    if (value.length + nextFiles.length > MAX_ATTACHMENT_COUNT) {
      setError(`最多上传 ${MAX_ATTACHMENT_COUNT} 个附件。`);
      return;
    }

    const tooLarge = nextFiles.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (tooLarge) {
      setError(`附件「${tooLarge.name}」超过 2MB，请压缩后再上传。`);
      return;
    }

    try {
      const drafts = await Promise.all(nextFiles.map(readFileAsDataUrl));
      onChange([...value, ...drafts]);
    } catch {
      setError("附件读取失败，请重新选择文件。");
    }
  }

  return (
    <div className="muted-card" style={{ padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span className="label">附件</span>
        <span className="hint" style={{ fontSize: 12 }}>
          支持图片、PDF、文本、CSV、Excel，单个不超过 2MB
        </span>
      </div>
      <Input
        type="file"
        multiple
        disabled={disabled || value.length >= MAX_ATTACHMENT_COUNT}
        accept={ATTACHMENT_ACCEPT}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {value.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {value.map((attachment, index) => (
            <li
              key={`${attachment.fileName}-${index}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
                border: "1px solid var(--border-muted)",
                borderRadius: 8,
                padding: "6px 8px"
              }}
            >
              <span className="hint" style={{ fontSize: 12 }}>
                {attachment.fileName} · {formatBytes(attachment.size)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              >
                移除
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}
    </div>
  );
}

/**
 * Trims requirement rows while preserving the visual editor's empty placeholder.
 */
export function normalizeRequirementItems(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

function readFileAsDataUrl(file: File): Promise<AttachmentDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      resolve({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result)
      });
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
