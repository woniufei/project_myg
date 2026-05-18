"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { Textarea } from "@/components/primer/Textarea";
import { getChannelTypeLabel } from "@/lib/notifications/channels";
import { buildDeliveries, markDeliveriesAsSent } from "@/lib/notifications/router";
import { riskLevelTone } from "@/lib/work-package-presentation";
import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationMessage,
  NotificationRule,
  NotificationTemplate,
  StewardMessage,
  User
} from "@/lib/types";

interface NotificationCenterViewProps {
  channels: NotificationChannel[];
  rules: NotificationRule[];
  stewardMessages: StewardMessage[];
  messages: NotificationMessage[];
  templates: NotificationTemplate[];
  currentUser?: User;
  canManage: boolean;
}

/**
 * Notification center: lists steward-driven deliveries, the routing rules,
 * and the available channels. The audit pane is the focus, with channel
 * and rule context surfaced in compact cards above.
 */
export function NotificationCenterView({
  channels,
  rules,
  stewardMessages,
  messages,
  templates,
  currentUser,
  canManage
}: NotificationCenterViewProps) {
  const router = useRouter();
  const [localChannels, setLocalChannels] = useState(channels);
  const [localTemplates, setLocalTemplates] = useState(templates);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>(() =>
    buildDeliveries(stewardMessages, channels, rules, {
      viewerRole: currentUser?.role
    })
  );
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [decisionCommentById, setDecisionCommentById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(channelId: string) {
    if (!canManage) return;
    setLocalChannels((current) => {
      const next = current.map((channel) =>
        channel.id === channelId ? { ...channel, enabled: !channel.enabled } : channel
      );
      setDeliveries(
        buildDeliveries(stewardMessages, next, rules, {
          viewerRole: currentUser?.role
        })
      );
      return next;
    });
  }

  function simulateSend(delivery: NotificationDelivery) {
    setDeliveries((current) => [
      ...markDeliveriesAsSent([delivery]),
      ...current.filter((item) => item.id !== delivery.id)
    ]);
  }

  function simulateSendAll() {
    setDeliveries((current) => markDeliveriesAsSent(current));
  }

  async function markRead(message: NotificationMessage) {
    if (!currentUser) return;
    setBusyId(message.id);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${message.id}/read`, {
        method: "POST",
        headers: { "x-user-id": currentUser.id }
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "标记已读失败");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "标记已读失败");
    } finally {
      setBusyId(null);
    }
  }

  async function resolveDecision(
    message: NotificationMessage,
    decision: "approved" | "changesRequested"
  ) {
    if (!currentUser || !message.workPackageId) return;
    setBusyId(message.id);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${message.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({
          workPackageId: message.workPackageId,
          decision,
          comment: decisionCommentById[message.id]
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "决策处理失败");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "决策处理失败");
    } finally {
      setBusyId(null);
    }
  }

  async function saveTemplates() {
    if (!currentUser) return;
    setBusyId("templates");
    setError(null);
    try {
      const response = await fetch("/api/notifications/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ templates: localTemplates })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "保存模板失败");
      }
      const payload = (await response.json()) as { templates: NotificationTemplate[] };
      setLocalTemplates(payload.templates);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存模板失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Surface
        title={`项目通知留痕 (${messages.length})`}
        description="项目参与人都能收到项目内活动通知；待决策仅团队负责人、项目经理或管理员可处理。"
        flush
      >
        {messages.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState title="暂无项目通知留痕" description="在工作项详情发布评论、待决策、阻塞或证据后会自动生成。" />
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {messages.map((message, index) => (
              <li
                key={message.id}
                style={{
                  padding: "14px 16px",
                  borderTop: index === 0 ? undefined : "1px solid var(--border-muted)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Badge tone={activityTone(message)}>{activityLabel(message.activityType)}</Badge>
                      {message.decisionStatus !== "none" ? (
                        <Badge tone={decisionTone(message.decisionStatus)}>
                          {decisionLabel(message.decisionStatus)}
                        </Badge>
                      ) : null}
                      {!message.readAt ? <Badge tone="accent">未读</Badge> : null}
                      <strong style={{ fontSize: 14 }}>{message.title}</strong>
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {message.body}
                    </p>
                    <p className="hint" style={{ margin: "8px 0 0", fontSize: 12 }}>
                      {message.projectName}
                      {message.workPackageId ? ` · #${message.workPackageId} ${message.workPackageSubject ?? ""}` : ""}
                      {message.senderName ? ` · 发起人 ${message.senderName}` : ""}
                      {message.decidedByName ? ` · 处理人 ${message.decidedByName}` : ""}
                      {" · "}
                      {formatDateTime(message.createdAt)}
                    </p>
                  </div>
                  <div style={{ display: "inline-flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {message.workPackageId ? (
                      <Link
                        className="btn"
                        data-size="sm"
                        data-variant="ghost"
                        href={`/projects/${message.projectIdentifier}/work-packages/${message.workPackageId}?returnTo=/notifications`}
                      >
                        查看工作项
                      </Link>
                    ) : null}
                    {!message.readAt ? (
                      <Button size="sm" variant="default" disabled={busyId === message.id} onClick={() => markRead(message)}>
                        标记已读
                      </Button>
                    ) : null}
                  </div>
                </div>
                {message.canTakeDecision ? (
                  <div className="muted-card" style={{ marginTop: 10, padding: 10, display: "grid", gap: 8 }}>
                    <Textarea
                      value={decisionCommentById[message.id] ?? ""}
                      rows={2}
                      placeholder="填写决策意见，留空使用默认文案。"
                      onChange={(event) =>
                        setDecisionCommentById((current) => ({
                          ...current,
                          [message.id]: event.target.value
                        }))
                      }
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busyId === message.id}
                        onClick={() => resolveDecision(message, "changesRequested")}
                      >
                        拒绝
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        disabled={busyId === message.id}
                        onClick={() => resolveDecision(message, "approved")}
                      >
                        同意
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {canManage ? (
        <>
          <Surface
            title="通知模板配置"
            description="用于生成站内留痕和后续飞书卡片消息，支持 {projectName}、{actorName}、{workPackageSubject}、{content} 占位符。"
            actions={
              <Button size="sm" variant="primary" disabled={busyId === "templates"} onClick={saveTemplates}>
                保存模板
              </Button>
            }
            flush
          >
            {localTemplates.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState title="暂无模板配置" />
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 8 }}>
                {localTemplates.map((template) => {
                  const expanded = expandedTemplateId === template.id;
                  return (
                    <li key={template.id} className="muted-card" style={{ padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: 13 }}>{template.name}</strong>
                          <p className="hint" style={{ margin: "2px 0 0", fontSize: 11 }}>
                            {activityLabel(template.activityType)} · {template.enabled ? "已启用" : "已停用"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedTemplateId(expanded ? null : template.id)}
                        >
                          {expanded ? "收起" : "编辑"}
                        </Button>
                      </div>
                      {expanded ? (
                        <fieldset
                          disabled={busyId === "templates"}
                          style={{ border: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}
                        >
                          <label style={{ display: "grid", gap: 4 }}>
                            <span className="label" style={{ fontSize: 11 }}>标题模板</span>
                            <Textarea
                              rows={2}
                              value={template.titleTemplate}
                              onChange={(event) => updateTemplate(template.id, "titleTemplate", event.target.value)}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span className="label" style={{ fontSize: 11 }}>正文模板</span>
                            <Textarea
                              rows={3}
                              value={template.bodyTemplate}
                              onChange={(event) => updateTemplate(template.id, "bodyTemplate", event.target.value)}
                            />
                          </label>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={template.enabled}
                              onChange={(event) => updateTemplate(template.id, "enabled", event.target.checked)}
                            />
                            启用该模板
                          </label>
                        </fieldset>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16
            }}
          >
            <Surface title="通讯通道" description="管理员可启用或停用通道。" flush>
              {localChannels.length === 0 ? (
                <div style={{ padding: 16 }}>
                  <EmptyState title="暂无通讯通道" />
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 4 }}>
                  {localChannels.map((channel) => (
                    <li
                      key={channel.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "var(--bg-subtle)",
                        overflow: "hidden"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 13 }}>{channel.name}</strong>
                        <p
                          className="hint mono"
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {getChannelTypeLabel(channel.type)} · {channel.target.replace(/^https?:\/\//, "")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={channel.enabled ? "success" : "default"}
                        onClick={() => toggleChannel(channel.id)}
                        style={{ flexShrink: 0 }}
                      >
                        {channel.enabled ? "已启用" : "未启用"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>

            <Surface title="路由规则" description="事件类型 + 最小风险等级决定推送通道。" flush>
              {rules.length === 0 ? (
                <div style={{ padding: 16 }}>
                  <EmptyState title="无可见规则" />
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 4 }}>
                  {rules.map((rule) => (
                    <li
                      key={rule.id}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: "var(--bg-subtle)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <strong style={{ fontSize: 13 }}>{rule.name}</strong>
                        <Badge tone={riskLevelTone(rule.minLevel)}>≥ {rule.minLevel}</Badge>
                      </div>
                      <p className="hint" style={{ margin: "6px 0 2px", fontSize: 11 }}>
                        事件 {rule.eventTypes.join(" · ")}
                      </p>
                      <p className="hint" style={{ margin: 0, fontSize: 11 }}>
                        通道 {rule.channelIds
                          .map((id) => localChannels.find((channel) => channel.id === id)?.name)
                          .filter(Boolean)
                          .join(" / ") || "无可见通道"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </div>

          <Surface
            title={`投递审计 (${deliveries.length})`}
            description="按 AI 管家与项目事件模拟向通道的投递负载。"
            actions={
              deliveries.length > 0 ? (
                <Button size="sm" variant="primary" onClick={simulateSendAll}>
                  一键模拟投递
                </Button>
              ) : null
            }
            flush
          >
            {deliveries.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState
                  title="暂无可投递的消息"
                  description="可先运行 AI 诊断或在工作项触发风险后再来查看。"
                />
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {deliveries.map((delivery, index) => (
                  <li
                    key={delivery.id}
                    style={{
                      padding: "12px 16px",
                      borderTop: index === 0 ? undefined : "1px solid var(--border-muted)"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap"
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Badge
                            tone={
                              delivery.status === "sent"
                                ? "success"
                                : delivery.status === "failed"
                                  ? "danger"
                                  : "default"
                            }
                          >
                            {deliveryStatusLabel(delivery.status)}
                          </Badge>
                          <strong style={{ fontSize: 13 }}>{delivery.notification.title}</strong>
                        </div>
                        <p className="hint" style={{ margin: "4px 0 0", fontSize: 12 }}>
                          {delivery.preview}
                        </p>
                        <p className="hint" style={{ margin: "4px 0 0", fontSize: 11 }}>
                          通道 {delivery.channelName} · 规则 {delivery.ruleName}
                        </p>
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={delivery.status === "sent"}
                          onClick={() => simulateSend(delivery)}
                        >
                          模拟发送
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedDeliveryId((current) => (current === delivery.id ? null : delivery.id))
                          }
                        >
                          {expandedDeliveryId === delivery.id ? "收起" : "查看负载"}
                        </Button>
                      </div>
                    </div>
                    {expandedDeliveryId === delivery.id ? (
                      <pre
                        style={{
                          marginTop: 10,
                          padding: 10,
                          background: "var(--bg-muted)",
                          borderRadius: 6,
                          fontSize: 11,
                          maxHeight: 240,
                          overflow: "auto",
                          lineHeight: 1.6,
                          fontFamily: "var(--font-mono)"
                        }}
                      >
                        {JSON.stringify(delivery.payload, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </>
      ) : null}

      {error ? (
        <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p>
      ) : null}
    </div>
  );

  function updateTemplate<K extends keyof NotificationTemplate>(
    id: string,
    key: K,
    value: NotificationTemplate[K]
  ) {
    setLocalTemplates((current) =>
      current.map((template) => (template.id === id ? { ...template, [key]: value } : template))
    );
  }
}

function deliveryStatusLabel(status: NotificationDelivery["status"]) {
  if (status === "sent") return "已发送";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  return "预览";
}

function activityLabel(type: NotificationMessage["activityType"]) {
  const labels: Record<NotificationMessage["activityType"], string> = {
    comment: "评论",
    decision: "待决策",
    blocker: "阻塞",
    evidence: "证据",
    approval: "决策结果",
    progress: "进展"
  };
  return labels[type];
}

function activityTone(message: NotificationMessage) {
  if (message.activityType === "decision") return "accent";
  if (message.activityType === "blocker") return "danger";
  if (message.activityType === "approval") return "success";
  return "default";
}

function decisionLabel(status: NotificationMessage["decisionStatus"]) {
  if (status === "approved") return "已同意";
  if (status === "rejected") return "已拒绝";
  if (status === "pending") return "待处理";
  return "无需处理";
}

function decisionTone(status: NotificationMessage["decisionStatus"]) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "pending") return "attention";
  return "default";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 16).replace("T", " ");
}
