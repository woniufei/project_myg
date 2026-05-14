# project_myg

OpenProject 风格的 AI 项目管理平台原型，提供项目层级、统一工作项（WorkPackage）、看板 / 甘特图 / 成员视图，并把 AI 诊断、AI 拆解、通知作为可配置模块嵌入项目侧边栏。

## 功能

- OpenProject 16.x 风格的「顶部 + 左侧栏 + 主内容区」三栏布局
- 项目支持 parent / sub-project 层级，可在顶部项目切换器与项目列表中按层级缩进展示
- WorkPackage 统一模型（任务 / 里程碑 / 风险 / 阶段），表格 + 右侧详情的 split-screen 视图
- 项目级模块开关：每个项目独立启用 Overview / Work Packages / Boards / Gantt / Members / AI 诊断 / AI 拆解 / Settings
- 看板（按状态分组）、甘特图（SVG 时间线）、成员视图
- AI 诊断面板（健康度 / 催办 / 调度建议）、AI 拆解工作区（草稿 → 项目经理确认 → 写入 WorkPackage）
- 通知中心（飞书 / 企业微信 / 钉钉 / Slack / 邮件 / 通用 Webhook 适配 + 路由规则 + 投递审计）
- 管理员、项目经理、项目参与员三种权限视角，支持顶部 UserMenu 切换演示账号
- Prisma + SQLite 数据模型与种子数据

## 本地运行


```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

访问 `http://localhost:3000`，会重定向到 `/my/page`。

## 验证

```bash
npm run test
npm run build
```

页面冒烟测试：

```bash
npm run test:e2e
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

健康检查：

```bash
curl http://localhost:3000/api/health
```

## GitHub Secrets

自动部署到 VPS 需要配置：

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`
- `APP_URL`
- `APP_ENV`
- `DOCKERHUB_NAME`
- `DOCKER_TOKEN`

CI 在推送到 `main` 或 `master` 时会把镜像推送到 `DOCKERHUB_NAME/project-myg`，例如 `yuguang822/project-myg:latest` 和 `yuguang822/project-myg:<commit-sha>`。

缺少 VPS 变量时，CI 仍会完成测试、构建、Docker 镜像验证和 DockerHub 推送，但会跳过真实 VPS 部署。

## 关键路由

| 路径 | 说明 |
| --- | --- |
| `/my/page` | 我的工作台（默认入口） |
| `/projects` | 所有项目（层级树） |
| `/projects/new` | 创建项目 |
| `/projects/[identifier]/overview` | 项目概览 |
| `/projects/[identifier]/work-packages` | 工作项表格 + split-screen 详情 |
| `/projects/[identifier]/boards` | 看板 |
| `/projects/[identifier]/gantt` | 甘特图 |
| `/projects/[identifier]/members` | 成员 |
| `/projects/[identifier]/ai-diagnosis` | AI 诊断 |
| `/projects/[identifier]/ai-breakdown` | AI 拆解 |
| `/projects/[identifier]/settings` | 项目设置（含模块开关） |
| `/work-packages` | 跨项目工作项列表 |
| `/notifications` | 通知中心 |
| `/admin` | 管理员区 |

## 关键 API

| API | 说明 |
| --- | --- |
| `GET /api/workspace` | 工作区引导（projects + counts） |
| `GET / POST /api/projects` | 项目列表 / 创建 |
| `GET / PATCH /api/projects/[identifier]` | 单项目读取 / 更新（含模块开关） |
| `GET / POST /api/work-packages` | 工作项列表 / 创建 |
| `PATCH /api/work-packages/[id]` | 更新工作项进展 |
| `POST /api/work-packages/[id]/comments` | 写入评论 / 决策 / 阻塞 / 证据 |
| `POST /api/work-packages/[id]/approvals` | 项目经理签核 |
| `POST /api/assistant` | AI 拆解草稿 |
| `POST /api/agent-workflow/confirm` | 草稿确认 → 写入正式 WorkPackage |
| `POST /api/im-comment?persist=1` | 外部 IM 评论回流（幂等） |
| `GET /api/steward` | AI 管家进展摘要 |
| `GET /api/health` | 健康检查 |

详细架构与模块边界见 [`docs/platform-architecture.md`](docs/platform-architecture.md)。

## Cursor Skill 选择

| 场景 | 使用 skill |
| --- | --- |
| 定义新功能、页面、用户旅程或验收标准 | `product-definition` |
| 拆分需求池、优先级、依赖、里程碑和任务 | `demand-management` |
| 实现明确范围内的代码或文档改动 | `development-execution` |
| 验证单测、API、页面冒烟、构建或回归 | `test-verification` |
| 检查 Docker、GitHub Actions、VPS 和健康检查 | `deploy-operations` |
| 核对当前项目进度、风险、验证和部署事实 | `progress-check` |
| 生成面向项目经理或团队的同步简报和风险提醒 | `steward-reporting` |
| 大范围、多轮、多 Subagent 的 Cursor 研发闭环 | `unattended-platform-development` |

小改动优先走轻量链路：`product-definition` → `demand-management` → `development-execution` → `test-verification`。
