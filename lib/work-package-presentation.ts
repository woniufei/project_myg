import type { BadgeTone } from "@/components/primer/Badge";
import type {
  Priority,
  RiskLevel,
  WorkPackageOrigin,
  WorkPackageStatus,
  WorkPackageType
} from "./types";

const STATUS_LABELS: Record<string, string> = {
  todo: "待处理",
  inProgress: "进行中",
  review: "评审中",
  reviewFailed: "评审中",
  done: "已完成",
  blocked: "阻塞"
};

const STATUS_TONES: Record<string, BadgeTone> = {
  todo: "default",
  inProgress: "accent",
  review: "attention",
  reviewFailed: "attention",
  done: "success",
  blocked: "danger"
};

const TYPE_LABELS: Record<WorkPackageType, string> = {
  task: "任务",
  milestone: "里程碑",
  risk: "风险",
  phase: "阶段"
};

const TYPE_TONES: Record<WorkPackageType, BadgeTone> = {
  task: "accent",
  milestone: "done",
  risk: "danger",
  phase: "attention"
};

const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "P0",
  P1: "P1",
  P2: "P2"
};

const PRIORITY_TONES: Record<Priority, BadgeTone> = {
  P0: "danger",
  P1: "attention",
  P2: "default"
};

const RISK_TONES: Record<RiskLevel, BadgeTone> = {
  Low: "default",
  Medium: "attention",
  High: "danger"
};

const ORIGIN_LABELS: Record<WorkPackageOrigin, string> = {
  self: "自创建",
  aiSelf: "AI",
  manager: "项目经理",
  imImport: "IM 导入"
};

const ORIGIN_TONES: Record<WorkPackageOrigin, BadgeTone> = {
  self: "accent",
  aiSelf: "done",
  manager: "attention",
  imImport: "default"
};

export function statusLabel(status: WorkPackageStatus | string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusTone(status: WorkPackageStatus | string): BadgeTone {
  return STATUS_TONES[status] ?? "default";
}

export function typeLabel(type: WorkPackageType): string {
  return TYPE_LABELS[type];
}

export function typeTone(type: WorkPackageType): BadgeTone {
  return TYPE_TONES[type];
}

export function priorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

export function priorityTone(priority: Priority): BadgeTone {
  return PRIORITY_TONES[priority];
}

export function riskLevelTone(level: RiskLevel): BadgeTone {
  return RISK_TONES[level];
}

export function originLabel(origin: WorkPackageOrigin): string {
  return ORIGIN_LABELS[origin];
}

export function originTone(origin: WorkPackageOrigin): BadgeTone {
  return ORIGIN_TONES[origin];
}

export function projectStatusLabel(status: string): string {
  if (status === "active") return "进行中";
  if (status === "onHold") return "暂停";
  return "已归档";
}

export function projectStatusTone(status: string): BadgeTone {
  if (status === "active") return "success";
  if (status === "onHold") return "attention";
  return "default";
}

export function moduleLabel(module: string): string {
  switch (module) {
    case "overview":
      return "概览";
    case "work_packages":
      return "工作项";
    case "boards":
      return "看板";
    case "gantt":
      return "甘特图";
    case "members":
      return "成员";
    case "ai_diagnosis":
      return "AI 诊断";
    case "ai_breakdown":
      return "AI 拆解";
    case "settings":
      return "项目设置";
    default:
      return module;
  }
}
