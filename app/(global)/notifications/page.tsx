import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { NotificationCenterView } from "@/components/notifications/NotificationCenterView";
import { userHasRole } from "@/lib/rbac";
import {
  listNotificationMessages,
  listNotificationTemplates
} from "@/lib/services/notification-center";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const canManage = userHasRole(currentUser, "admin");
  const messages = currentUser ? await listNotificationMessages(currentUser) : [];
  const templates = canManage ? await listNotificationTemplates() : [];

  return (
    <>
      <Breadcrumb items={[{ label: "通知中心" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">通知中心</h1>
          <p className="page-subtitle">
            保存项目评论、待决策、阻塞和证据类关键节点，后续可对接飞书卡片消息推送。
          </p>
        </div>
      </header>
      <NotificationCenterView
        channels={canManage ? snapshot.notificationChannels : []}
        rules={canManage ? snapshot.notificationRules : []}
        stewardMessages={canManage ? snapshot.stewardMessages : []}
        messages={messages}
        templates={templates}
        currentUser={currentUser}
        canManage={canManage}
      />
    </>
  );
}
