import type { Priority, ReminderItem, RiskLevel, WorkPackage, WorkspaceSnapshot } from "../types";

const priorityWeight: Record<Priority, number> = {
  P0: 5,
  P1: 3,
  P2: 1
};

const dayMs = 24 * 60 * 60 * 1000;

interface BuildReminderOptions {
  /** Override "now" to keep deterministic snapshots in tests. */
  now?: Date;
  /** Maximum number of reminders to return. */
  limit?: number;
}

/**
 * Builds smart reminders for work packages that look stalled, near-due, or
 * blocked. Each reminder also keeps the recommended notification channels for
 * routing.
 */
export function buildReminderItems(
  snapshot: WorkspaceSnapshot,
  options: BuildReminderOptions = {}
): ReminderItem[] {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 5;
  const peopleLookup = new Map(snapshot.people.map((person) => [person.id, person]));
  const channelIdsByEvent = groupChannelsByEvent(snapshot);

  return snapshot.workPackages
    .filter((wp) => wp.type !== "risk")
    .filter((wp) => wp.status !== "done")
    .map<ReminderItem>((wp) => {
      const owner = wp.assigneeId ? peopleLookup.get(wp.assigneeId) : undefined;
      const daysIdle = wp.lastUpdatedAt ? daysBetween(now, wp.lastUpdatedAt) : 0;
      const daysUntilDue = wp.dueDate
        ? daysBetween(new Date(wp.dueDate), now.toISOString())
        : undefined;
      const urgency = computeUrgency(wp, daysIdle, daysUntilDue);
      const level = inferReminderLevel(wp, urgency, daysUntilDue);
      const eventType = wp.status === "blocked" ? "risk" : "planning";

      return {
        workPackageId: wp.id,
        workPackageSubject: wp.subject,
        ownerId: wp.assigneeId,
        ownerName: owner?.name ?? "未分配",
        level,
        urgency,
        message: buildReminderMessage(wp, owner?.name ?? "负责人", daysIdle, daysUntilDue),
        preferredChannelIds: channelIdsByEvent[eventType] ?? channelIdsByEvent.planning ?? [],
        daysIdle,
        daysUntilDue
      };
    })
    .sort((left, right) => right.urgency - left.urgency)
    .slice(0, limit);
}

function groupChannelsByEvent(snapshot: WorkspaceSnapshot): Record<string, string[]> {
  const enabledChannelIds = new Set(
    snapshot.notificationChannels.filter((channel) => channel.enabled).map((channel) => channel.id)
  );
  const groups: Record<string, string[]> = {};

  for (const rule of snapshot.notificationRules) {
    for (const eventType of rule.eventTypes) {
      const channels = rule.channelIds.filter((id) => enabledChannelIds.has(id));
      groups[eventType] = Array.from(new Set([...(groups[eventType] ?? []), ...channels]));
    }
  }

  return groups;
}

function computeUrgency(
  wp: WorkPackage,
  daysIdle: number,
  daysUntilDue: number | undefined
): number {
  const idleScore = Math.max(0, daysIdle - 1) * 1.5;
  const dueScore = daysUntilDue === undefined ? 0 : Math.max(0, 5 - daysUntilDue) * 1.4;
  const blockedScore = wp.status === "blocked" ? 6 : 0;
  const reviewScore = wp.status === "review" ? 1.5 : 0;
  const todoScore = wp.status === "todo" ? 1 : 0;

  return Math.round(
    priorityWeight[wp.priority] + idleScore + dueScore + blockedScore + reviewScore + todoScore
  );
}

function inferReminderLevel(
  wp: WorkPackage,
  urgency: number,
  daysUntilDue: number | undefined
): RiskLevel {
  if (wp.status === "blocked" || urgency >= 12 || (daysUntilDue !== undefined && daysUntilDue < 0)) {
    return "High";
  }

  if (urgency >= 8 || (daysUntilDue !== undefined && daysUntilDue <= 2)) {
    return "Medium";
  }

  return "Low";
}

function buildReminderMessage(
  wp: WorkPackage,
  ownerName: string,
  daysIdle: number,
  daysUntilDue: number | undefined
): string {
  const parts = [`【${wp.priority}】${wp.subject}`];

  if (wp.status === "blocked") {
    parts.push("当前阻塞，需要立即同步阻塞原因与下一步");
  } else if (wp.status === "review") {
    parts.push("等待评审，请相关方在今日完成确认");
  } else if (wp.status === "todo") {
    parts.push("尚未启动，请确认是否进入冲刺范围");
  } else {
    parts.push(`进度 ${wp.percentComplete}%`);
  }

  if (daysIdle > 0) {
    parts.push(`已停滞 ${daysIdle} 天`);
  }

  if (daysUntilDue !== undefined) {
    if (daysUntilDue < 0) {
      parts.push(`已逾期 ${Math.abs(daysUntilDue)} 天`);
    } else if (daysUntilDue <= 2) {
      parts.push(`距截止仅剩 ${daysUntilDue} 天`);
    }
  }

  parts.push(`@${ownerName} 请在管家或飞书群同步进展`);

  return parts.join("，");
}

function daysBetween(later: Date, earlier: string): number {
  const earlierDate = new Date(earlier);
  if (Number.isNaN(earlierDate.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((later.getTime() - earlierDate.getTime()) / dayMs));
}
