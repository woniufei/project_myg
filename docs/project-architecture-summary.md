# project_myg 项目架构总结

> 面向项目型组织的 AI 统筹平台 —— 把需求 → 任务 → 排期 → 执行 → 核对 → 风险 → 总结 串成闭环。

---

## 1. 项目定位

**核心理念**: 参考 OpenProject 16.x 的信息架构，以「项目层级 + 工作项 + 模块化导航」为骨架，嵌入 AI 诊断/拆解/通知作为可配置模块，同时保持普通员工界面极简。

**四类角色门户**:

| 角色 | 默认首页 | 产品承诺 |
|------|----------|----------|
| 普通员工 | `/my/page` 极简工作台 | 记录、看清、完成、总结 |
| 团队负责人 | `/team/page` 团队工作台 | 分配团队工作、核对完成质量、看团队负载 |
| 项目经理 | `/pm/page` 项目计划控制台 | 规划项目、倒排计划、处理风险和依赖 |
| 管理员 | `/admin/page` 平台治理中心 | 配置平台、角色、Skill、AI 工具与审计 |

---

## 2. 技术栈（全栈 TypeScript）

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | Next.js App Router | 16.2.4 |
| UI 库 | React | 19.2.5 |
| 样式 | TailwindCSS v4 + Primer Design System | 4.2.4 |
| 数据库 ORM | Prisma + better-sqlite3 | 7.8.0 |
| 数据校验 | Zod | 4.4.2 |
| 测试 | Vitest（单元）+ Playwright（E2E） | 4.1.5 / 1.59.1 |
| 构建输出 | standalone Docker 镜像 | — |
| 部署 | Docker Compose + GitHub Actions → VPS | — |

**设计系统**: GitHub Primer 浅色主题；大屏模式独立深色主题 `[data-theme="big-screen"]`。

---

## 3. 目录结构

```
app/                          # Next.js App Router
  (global)/                   # 无项目上下文路由组（GlobalSidebar）
    launch/page.tsx           # 项目启动选择页
    my/page/page.tsx          # 我的工作台
    my/work-packages/new/     # 个人新建工作项
    my/breakdown/page.tsx     # 个人 AI 拆解
    overview/page.tsx         # 平台总览（仪表盘 KPI）
    overview/screen/page.tsx  # 大屏看板模式（深色全屏甘特）
    projects/page.tsx         # 所有项目（层级树）
    work-packages/page.tsx    # 跨项目工作项
    notifications/page.tsx    # 通知中心
    admin/page.tsx            # 管理员区
    admin/feature-flags/      # 平台模块开关
    admin/agent-keys/         # Agent API Key 管理
    admin/agent-audit/        # AI 调用审计
  projects/[identifier]/      # 项目内上下文路由组（ProjectSidebar）
    overview/                 # 项目概览
    work-packages/            # 表格 + split-screen 详情
    boards/                   # 看板（按 status）
    gantt/                    # SVG 甘特图
    members/                  # 成员
    ai-diagnosis/             # AI 诊断
    ai-breakdown/             # AI 拆解
    settings/                 # 项目设置（含模块开关）
  api/                        # REST API 路由
    workspace/                # 工作区引导
    projects/                 # 项目 CRUD
    work-packages/            # 工作项 CRUD + 评论/签核
    assistant/                # AI 拆解草稿
    agent-workflow/confirm/   # 草稿确认 → WorkPackage
    overview/                 # 平台总览数据
    overview/screen/          # 大屏看板数据
    feature-flags/            # 平台模块开关
    agent/tools/              # GET 工具清单
    agent/invoke/             # POST 工具执行
    agent/api-keys/           # Agent API Key CRUD
    agent/audit/              # 审计查询
    mcp/[transport]/          # MCP 预留壳子（返回 501）
    health/                   # 健康检查

components/                   # React 组件
  layout/                     # AppShell / GlobalSidebar / ProjectSidebar
  primer/                     # 原子组件（Button / Input / Select / Badge 等）
  projects/                   # ProjectTree
  work-packages/              # WorkPackageTable / WorkPackageDetailPane
  boards/                     # KanbanBoard
  gantt/                      # GanttChart
  ai/                         # AIDiagnosisPanel / AIBreakdownWorkspace
  notifications/              # NotificationCenterView
  overview/                   # ProjectKpiCard / GlobalKpiBar
  big-screen/                 # BigScreenLayout / TimelineCanvas / ScreenAutoRefresh
  admin/                      # FeatureFlagsTable / AgentKeysPanel / AgentAuditView

lib/                          # 业务逻辑层
  types.ts                    # 共享 TypeScript 领域类型
  rbac.ts                     # 角色权限矩阵
  prisma.ts                   # Prisma Client 单例
  repositories/               # 数据映射层
    workspace-mappers.ts      # Prisma ↔ Domain 类型映射
    workspace-repository.ts   # 工作区数据加载
  services/                   # 领域服务（业务规则核心）
    workspace.ts              # 工作区快照加载
    project-workflow.ts       # 项目创建/更新/模块开关
    work-package-workflow.ts  # 工作项 CRUD + 评论/签核/删除
    agent-breakdown.ts        # AI 草稿生成与确认
    platform-overview.ts      # 平台总览 KPI 聚合
    feature-flags.ts          # 平台模块开关读写
    big-screen.ts             # 大屏数据装配
  intelligence/               # 智能分析四件套
    health.ts / reminders.ts / scheduling.ts / diagnosis.ts / critical-path.ts
  notifications/              # 通知系统
    channels.ts / router.ts
  agent/                      # AI 工具体系
    sdk.ts / invoke.ts / auth.ts / audit.ts / orchestrator.ts / provider.ts
    tools/registry.ts         # Tool 注册表（17 个工具）

prisma/
  schema.prisma               # 数据库模型（约 30 个模型）
  seed.mjs                    # 种子数据
```

---

## 4. 数据模型核心（Prisma + SQLite）

**核心实体关系**:

```
Project (自引用层级: parent/children)
  └── WorkPackage (自引用层级: parent/children; projectId 可空 = 个人事项)
      ├── WorkPackageComment (评论/决策/阻塞/证据)
      ├── WorkPackageApproval (PM 签核)
      └── WorkPackageProgressEvent (进展事件审计)

Person ↔ User (1:1)
  └── ProjectMembership (项目成员关系，isLead 标记负责人)

NotificationChannel ↔ NotificationRule ↔ NotificationDelivery

PlatformFeatureFlag (平台模块开关: siteEnabled + roleOverrides JSON)

AgentApiKey ↔ AgentToolInvocation (API Key 与调用审计)

AgentBreakdownDraft (AI 拆解草稿)

ScheduleBaseline → ScheduleScenario → ScheduleChange (排程基线/方案/变更)

ProjectQualitySnapshot → ProjectQualityMetric (质量快照与指标)
```

**关键设计**:
- `WorkPackage` 统一模型: Task / Milestone / Risk / Phase 四种类型共用一表，全局自增整数 ID（OpenProject 风格 `#123`）
- `WorkPackage.projectId` 可空: `null` = 纯个人事项，仅本人与管理员可见
- `WorkPackage.origin` 枚举: `SELF` / `AI_SELF` / `MANAGER` / `IM_IMPORT`
- `WorkPackage.createdByUserId`: 与 `assigneeId` 解耦，删除权限以「创建者本人 + 管理员」为准

---

## 5. 前端架构

### 5.1 路由与布局策略

采用 **Next.js App Router** 双路由组设计:

```
┌─────────────────────────────────────────────────────────┐
│  App Header (ProjectSwitcher + Create + 通知 + 用户菜单) │
├─────────────────────────────────────────────────────────┤
│  Sidebar        │  Main Content                         │
│  (Global/Project)│                                      │
│                 │                                      │
└─────────────────────────────────────────────────────────┘
```

- **`(global)` 路由组**: 无项目上下文，渲染 `GlobalSidebar`
  - 顺序: Launch → My Page → Platform Overview → Projects → Work Packages → Notifications → Administration
- **`projects/[identifier]` 路由组**: 项目内上下文，渲染 `ProjectSidebar`
  - 按 `Project.enabledModules` 动态渲染模块入口

### 5.2 首屏重定向逻辑 (`/`)

```
cookie 有 lastSelectedProject 且未跳过  →  302 /projects/<id>/overview
cookie 有 skipLaunch=true               →  302 /my/page
否则                                     →  302 /launch
```

### 5.3 大屏看板特殊处理 (`/overview/screen`)

- **独立深色主题**: `data-theme="big-screen"`
- **自研 SVG 甘特**: 不引入第三方库
- **分辨率自适应**: `useScreenScale()` hook + `transform:scale` 适配 1920×1080 / 2K / 4K
- **自动刷新**: 30s 轮询 + 60s 多项目轮播
- **匿名访问**: 凭 `BIG_SCREEN_ANONYMOUS_TOKEN` 免登录挂屏

---

## 6. 后端架构

### 6.1 API 设计

RESTful API，按领域组织。核心端点：

| 领域 | 端点 | 说明 |
|------|------|------|
| 项目 | `GET/POST /api/projects` | 列表/创建 |
| 项目 | `GET/PATCH /api/projects/[identifier]` | 详情/更新 |
| 工作项 | `GET/POST /api/work-packages` | 列表/创建（projectId 可空） |
| 工作项 | `PATCH/DELETE /api/work-packages/[id]` | 更新/删除 |
| AI | `POST /api/assistant` | 拆解草稿 |
| AI | `POST /api/agent-workflow/confirm` | 草稿确认 |
| 总览 | `GET /api/overview` | KPI 聚合 |
| 大屏 | `GET /api/overview/screen` | 大屏数据 |
| Agent | `GET /api/agent/tools` | 工具清单 |
| Agent | `POST /api/agent/invoke` | 工具执行 |

### 6.2 服务层 (`lib/services/*`)

| 服务 | 职责 |
|------|------|
| `workspace.ts` | 单一入口加载工作区快照，失败回退到 sample-data |
| `project-workflow.ts` | 项目创建/更新/模块开关 |
| `work-package-workflow.ts` | 工作项 CRUD + 评论/签核/删除。支持 `projectId=null` |
| `agent-breakdown.ts` | AI 草稿生成与确认 |
| `platform-overview.ts` | 聚合每项目 KPI |
| `feature-flags.ts` | 读写 `PlatformFeatureFlag` |
| `big-screen.ts` | 大屏数据装配 |

### 6.3 数据访问层

- **Prisma Client 单例**: `lib/prisma.ts`
- **映射层**: `lib/repositories/workspace-mappers.ts`
- **仓库层**: `lib/repositories/workspace-repository.ts`

---

## 7. AI / Agent 架构（平台特色）

### 7.1 整体架构

```
AI Callers (内置管家 / Web客户端 / 未来 MCP)
        │
        ▼
┌────────────────────────────────────────┐
│  AgentInvokePipeline (lib/agent/invoke.ts) │
│  1. resolveAuth()      → AgentCallContext   │
│  2. checkPermissions() → RBAC 校验         │
│  3. checkFeatureFlags()→ 模块开关校验       │
│  4. validateInput()    → Zod schema 校验   │
│  5. checkIdempotency() → 幂等复用           │
│  6. preview/confirm    → dangerous 强制两步 │
│  7. tool.handler()     → 调用 Domain Service│
│  8. recordInvocation() → 审计日志（异步）    │
│  9. serializeOutput()  → 收敛输出字段       │
└────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│  Tool Registry (lib/agent/tools/registry.ts)│
│  17 个工具，统一结构：name / description /    │
│  inputSchema / outputSchema / requiredPermissions│
│  / writeLevel (read|write|dangerous) / handler │
└────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│  Domain Services（复用现有业务逻辑）        │
└────────────────────────────────────────┘
```

### 7.2 17 个初始工具

| 名称 | writeLevel | 权限 | 说明 |
|------|-----------|------|------|
| `project.list` / `project.get` | read | overview | 项目查询 |
| `project.create` / `project.update` | write | manageProjects | 项目创建/更新 |
| `project.archive` | dangerous | manageProjects | 项目归档 |
| `workPackage.list` / `workPackage.get` | read | overview | 工作项查询 |
| `workPackage.create` / `workPackage.update` | write | assignWorkPackages / updateOwnWorkPackages | 工作项创建/更新 |
| `workPackage.delete` | dangerous | deleteOwnWorkPackage / deleteAnyWorkPackage | 工作项删除 |
| `workPackage.addComment` / `workPackage.approve` | write | updateOwnWorkPackages / approveWorkPackages | 评论/签核 |
| `personalWorkPackage.create` | write | createPersonalWorkPackage | 个人事项创建 |
| `agent.breakdown.draft` | write | usePersonalAgentBreakdown | AI 拆解草稿 |
| `agent.breakdown.confirm` | dangerous | usePersonalAgentBreakdown | 草稿确认批量写入 |
| `steward.summary` | read | viewIntelligence | AI 管家摘要 |
| `overview.snapshot` | read | viewPlatformOverview | 平台总览快照 |

### 7.3 三端暴露

| 端点 | 状态 | 说明 |
|------|------|------|
| 内部 SDK (`lib/agent/sdk.ts`) | ✅ 已落地 | `invokeTool(name, input, ctx)` |
| REST API (`/api/agent/*`) | ✅ 已落地 | 标准 HTTP，支持 Bearer Token |
| MCP (stdio / Streamable HTTP) | ⏳ 预留壳子 | 返回 501 + 契约文档链接 |

### 7.4 安全机制

- **双轨鉴权**: cookie (`x-user-id`) + `AgentApiKey` (`Authorization: Bearer <key>`)
- **写操作两步确认**: `writeLevel='dangerous'` 强制 dry-run → confirm
- **审计**: `AgentToolInvocation` 全量记录 who/how/when/tool/input/output/status/duration
- **管理员最高权限**: 天然「所有权限并集 + agentSuperuser」

---

## 8. 权限体系（RBAC）

### 8.1 角色矩阵

| 权限 | Admin | PM | Participant |
|------|:-----:|:--:|:-----------:|
| `overview` | ✅ | ✅ | ✅ |
| `manageProjects` | ✅ | ✅ | ❌ |
| `assignWorkPackages` | ✅ | ✅ | ❌ |
| `updateOwnWorkPackages` | ✅ | ✅ | ✅ |
| `approveWorkPackages` | ✅ | ✅ | ❌ |
| `useAgentBreakdown` | ✅ | ✅ | ❌ |
| `createPersonalWorkPackage` | ✅ | ✅ | ✅ |
| `deleteOwnWorkPackage` | ✅ | ✅ | ✅ |
| `deleteAnyWorkPackage` | ✅ | ❌ | ❌ |
| `viewPlatformOverview` | ✅ | ✅ | ✅ |
| `managePlatformFeatureFlags` | ✅ | ❌ | ❌ |
| `viewBigScreen` | ✅ | ✅ | ✅ |
| `useAgentTool` | ✅ | ✅ | ✅ |
| `manageAgentApiKeys` | ✅ | ❌ | ❌ |
| `viewAgentAudit` | ✅ | ✅ | ❌ |

### 8.2 数据可见性过滤

- **Admin**: 看全部
- **PM**: 看 `managedProjectIds` 对应项目 + 该项目下全部工作项
- **Participant**: 看 `participatingProjectIds` 对应项目 + 仅本人负责/创建的工作项
- **个人事项** (`projectId=null`): 仅本人 + Admin 可见

### 8.3 平台模块开关 (`PlatformFeatureFlag`)

双层判定: `siteEnabled === true` AND (`roleOverrides[user.role]` ?? `true`) === `true`

---

## 9. 通知系统

**多通道适配**: 飞书 / 企业微信 Bot / 钉钉 / Slack / 邮件 / 通用 Webhook

**核心流程**:
```
事件触发 → NotificationRule 匹配 → NotificationRuleChannel 路由
        → 各 Channel 适配器投递 → NotificationDelivery 记录状态
```

**IM 评论回流**: `POST /api/im-comment?persist=1` 支持外部 IM 消息写入 WorkPackageComment（幂等）

---

## 10. 测试体系

| 类型 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest | agent-tools / analytics / big-screen / rbac / steward / platform-overview 等 |
| E2E 测试 | Playwright | smoke / agent-tools / big-screen / launch-overview-flags / personal-work-foundation |

---

## 11. 部署与运维

**Docker 化**:
- `Dockerfile` + `docker-compose.yml`（SQLite 数据卷持久化）
- `output: "standalone"` 生成独立 Next.js 运行时
- 健康检查: `scripts/health-check.mjs`

**CI/CD**:
- GitHub Actions 推送 `main`/`master` 时构建并推送 DockerHub
- 配置 VPS 变量后自动部署

---

## 12. 架构演进路线：已落地 vs TODO

### ✅ 已落地（第二阶段核心）

| 能力 | 关键文件 |
|------|----------|
| 个人工作项（projectId 可空） | `prisma/schema.prisma`, `lib/services/work-package-workflow.ts` |
| 我的工作台统一表 | `app/(global)/my/page/page.tsx` |
| 个人 AI 拆解 | `app/(global)/my/breakdown/page.tsx` |
| 首屏启动选择页 | `app/(global)/launch/page.tsx` |
| 平台总览仪表盘 | `app/(global)/overview/page.tsx`, `lib/services/platform-overview.ts` |
| 大屏看板模式 | `app/(global)/overview/screen/page.tsx`, `components/big-screen/*` |
| 平台模块开关 | `lib/services/feature-flags.ts` |
| AI 工具注册表（17 工具） | `lib/agent/tools/registry.ts` |
| 统一执行管道 | `lib/agent/invoke.ts`, `lib/agent/auth.ts`, `lib/agent/audit.ts` |
| 内部 SDK | `lib/agent/sdk.ts` |
| Agent API Key + 审计 | `prisma/schema.prisma`, `app/api/agent/*` |
| MCP 预留壳子 | `scripts/mcp-server.ts`, `app/api/mcp/[transport]/route.ts` |

### ⏳ TODO（第三阶段规划）

| 能力 | 代号 | 说明 |
|------|------|------|
| Skill 体系 | PWP-38~43 | 管理员低代码编排 Tool 为业务流程 |
| 多角色 + 团队层级 | PWP-44~45 | `User.roles[]` + `TEAM_LEAD` + `Team`/`TeamMembership` |
| 任务核对流程 | PWP-46~48 | 团队负责人对成员"自报完成"的 pass/reject |
| 飞书组织架构同步 | PWP-49~51 | 部门树 → Team 树，自动派生 `TEAM_LEAD` |
| 角色门户重构 | PWP-52,57 | 员工极简 / Team Lead 团队工作台 / PM 计划控制台 / Admin 治理中心 |
| AI 难度评估 | PWP-53 | 工作项难度/复杂度/不确定性/估时可信度 |
| 智能排期引擎 | PWP-54~56 | 里程碑倒排、资源均衡、大屏交互式拖拽排程 |
| AI 统筹闭环 | PWP-58 | `steward.commandCenter` 按权限聚合提醒/风险/待核对/待排程 |

---

## 13. 架构亮点总结

1. **统一工作项模型**: Task / Milestone / Risk / Phase 共用 `WorkPackage`，支持父子层级 + 个人化，极大简化数据层
2. **AI 原生设计**: Tool Registry + 统一执行管道 + 审计，确保 AI 调用与人工操作同权限、同审计
3. **平台模块开关**: `PlatformFeatureFlag` 站点级 + 角色级双层控制，管理员可动态开关功能
4. **大屏自研 SVG**: 不依赖第三方甘特库，高度契合汽车域控项目时间计划的可视化需求
5. **权限数据过滤统一**: `filterWorkspaceForUser()` 在服务端一次性过滤，安全边界清晰
6. **文档驱动开发**: `docs/platform-architecture.md` 详述每处边界、TODO 标记、验收清单