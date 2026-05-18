# 通知中心功能总结

## 目标与范围（第一版）

- **消息留痕**：项目内评论、待决策、阻塞、证据等活动产生通知记录，供项目经理、团队负责人、项目参与员后续查看关键节点。
- **广播口径**：同一项目当前成员（`ProjectMembership`）在产生活动时均可收到对应通知；发起人不再被排除。
- **决策权限**：`DECISION` 类型通知仅 **团队负责人、项目经理、管理员** 可在通知中心执行同意/拒绝；任一授权人处理一次后，同批待决策通知状态统一更新。
- **其他活动类型**：评论、阻塞、证据、决策结果等以查看为主；飞书卡片 payload 在 `payload` 中预留，便于后续对接 IM。

## 角色与界面可见性

| 能力 | 管理员 | 项目经理 | 团队负责人 | 项目参与员 |
|------|--------|----------|------------|------------|
| 通知信息列表（留痕） | ✅ | ✅ | ✅ | ✅ |
| 待决策同意/拒绝 | ✅ | ✅ | ✅ | ❌ |
| 通知模板配置 | ✅ | ❌ | ❌ | ❌ |
| 通讯通道、路由规则、投递审计 | ✅ | ❌ | ❌ | ❌ |

说明：界面通过 `userHasRole(currentUser, "admin")` 控制配置区；权限矩阵中 `manageNotifications` 仅 **管理员** 为 true，与模板保存 API 一致。

## 数据模型（Prisma）

- **`NotificationTemplate`**：按活动类型唯一（`COMMENT` / `DECISION` / `BLOCKER` / `EVIDENCE` / `APPROVAL` / `PROGRESS`），存标题/正文模板与启用状态。
- **`NotificationMessage`**：单条留痕；关联 `Project`、`WorkPackage`，可选关联 `WorkPackageComment`、`WorkPackageApproval`；记录收件人 `User`/`Person`、是否需操作、决策状态、已读与处理人等。

迁移目录：`prisma/migrations/20260515150000_notification_center_messages/`。

## 业务触发点

- **`addWorkPackageComment`**（`lib/services/work-package-workflow.ts`）：项目工作项发表评论/待决策/阻塞/证据后，调用 `createWorkPackageActivityNotifications`。若为 **待决策** 且工作项未结束，会将工作项状态推到 `review` 以便评审闭环。
- **`addWorkPackageApproval`**：记录签核后写入 **决策结果** 类通知留痕。

## 主要服务与 API

| 路径 | 作用 |
|------|------|
| `GET/PATCH /api/notifications/templates` | 列表/保存模板（需 `manageNotifications`，即管理员） |
| `POST /api/notifications/[id]/read` | 标记已读 |
| `POST /api/notifications/[id]/decision` | 待决策处理（先写审批，再批量更新同 `commentId` 的决策通知） |

核心逻辑：`lib/services/notification-center.ts`。

### 演示数据与兜底

- **Seed**：`prisma/seed.mjs` 中含多条 `notificationMessages`，含面向 **项目经理 / 团队负责人 / 项目参与员** 的不同类型演示（评论、待决策、证据等）。
- **运行时**：`listNotificationMessages` 在可读库时会对缺失的演示 ID 做 **upsert** 补齐；若 delegate 不可用或查询失败，会用内存 **fallback** 列表，避免页面空白（便于演示与单测环境）。

## 前端入口

- 全局侧栏：**通知中心** → `/notifications`。
- 页面：`app/(global)/notifications/page.tsx`，组件：`components/notifications/NotificationCenterView.tsx`。

## 本地验证建议

1. 执行 `npx prisma db push`（或迁移部署）后 `npm run db:seed`。
2. 通过顶部用户菜单切换 **团队负责人**（`u-teamlead`），进入 `/notifications`，应看到含 **待决策** 徽章及同意/拒绝区域的通知。
3. 切换 **项目经理 / 项目参与员**，确认仅列表与各自可见范围一致；管理员额外看到模板、通道、规则、投递审计区块。

## 测试与构建

- `npm test`：通过。
- `npm run build`：通过。

## 后续可扩展

- 真实飞书发送：在写入 `NotificationMessage` 后异步调用 webhook，并将投递结果回写独立投递表（可与现有 `NotificationDelivery` 体系衔接）。
- 按项目配置模板覆盖、多语言占位符、通知静默时段等。

---

*文档生成对应代码版本以仓库当前 `main`/`HEAD` 为准，若表结构或路由有变更请同步更新本节。*
