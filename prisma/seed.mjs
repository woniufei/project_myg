import prismaClientPkg from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
const { PrismaClient } = prismaClientPkg;

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db"
});
const prisma = new PrismaClient({ adapter });
const PERSONAL_PROJECT_ID = "personProject";

const people = [
  { id: "p1", name: "产品负责人", role: "Product", capacity: 32, employeeNo: "YG0001", jobTitle: "项目经理", departmentCode: "D-PMO", departmentName: "项目管理办公室", externalId: "feishu-p1", skills: ["产品定义", "用户故事", "验收口径"] },
  { id: "p2", name: "前端开发", role: "Frontend", capacity: 36, employeeNo: "YG0002", jobTitle: "前端工程师", departmentCode: "D-SW", departmentName: "域控软件交付组", externalId: "feishu-p2", skills: ["看板设计", "前端实现", "图表可视化"] },
  { id: "p3", name: "后端开发", role: "Backend", capacity: 36, employeeNo: "YG0003", jobTitle: "软件交付负责人", departmentCode: "D-SW", departmentName: "域控软件交付组", externalId: "feishu-p3", skills: ["接口设计", "数据建模", "Agent 编排"] },
  { id: "p4", name: "测试与部署", role: "QA/Ops", capacity: 28, employeeNo: "YG0004", jobTitle: "测试与部署工程师", departmentCode: "D-SW", departmentName: "域控软件交付组", externalId: "feishu-p4", skills: ["测试设计", "部署运维", "健康检查"] },
  { id: "p5", name: "嵌入式开发", role: "Embedded", capacity: 32, employeeNo: "YG0005", jobTitle: "嵌入式软件工程师", departmentCode: "D-SW", departmentName: "域控软件交付组", externalId: "feishu-p5", skills: ["AUTOSAR", "诊断协议", "刷写验证"] },
  { id: "p6", name: "团队负责人-cs", role: "Customer Success Lead", capacity: 32, employeeNo: "YG0006", jobTitle: "客户成功团队负责人", departmentCode: "D-CS", departmentName: "客户成功交付组", externalId: "feishu-p6", skills: ["客户交付", "阶段推进", "风险升级"] }
];

const externalDepartments = [
  {
    id: "ed-pmo",
    externalId: "od-pmo",
    name: "项目管理办公室",
    parentId: null,
    code: "D-PMO",
    leaderId: "feishu-p1",
    leaderName: "产品负责人",
    memberCount: 1
  },
  {
    id: "ed-sw",
    externalId: "od-sw",
    name: "域控软件交付组",
    parentId: null,
    code: "D-SW",
    leaderId: "feishu-p3",
    leaderName: "后端开发",
    memberCount: 4
  },
  {
    id: "ed-cs",
    externalId: "od-cs",
    name: "客户成功交付组",
    parentId: null,
    code: "D-CS",
    leaderId: "feishu-p6",
    leaderName: "团队负责人-cs",
    memberCount: 1
  }
];

const externalPersons = people.map((person) => ({
  id: `ep-${person.id}`,
  externalId: person.externalId,
  name: person.name,
  email: `${person.employeeNo.toLowerCase()}@example.com`,
  employeeNo: person.employeeNo,
  jobTitle: person.jobTitle,
  departmentCode: person.departmentCode,
  departmentName: person.departmentName,
  departmentId: person.departmentCode === "D-SW" ? "ed-sw" : person.departmentCode === "D-CS" ? "ed-cs" : "ed-pmo",
  isLeader: person.id === "p1" || person.id === "p3" || person.id === "p6",
  personId: person.id
}));

const projects = [
  {
    id: PERSONAL_PROJECT_ID,
    identifier: "person-project",
    name: "个人事项默认项目",
    description: "系统内置的个人事项挂载项目，不在普通项目列表中展示。",
    createdByUserId: "u-admin",
    parentId: null,
    status: "ACTIVE",
    health: "LOW",
    initialDifficulty: "LOW",
    progress: 0,
    startDate: null,
    endDate: null,
    enabledModules: ["overview", "work_packages"]
  },
  {
    id: "proj-platform",
    identifier: "platform",
    name: "平台总览",
    description: "组合 AI 项目管理平台与其子项目的根项目，承载跨项目报表和成员管理。",
    createdByUserId: "u-admin",
    parentId: null,
    status: "ACTIVE",
    health: "LOW",
    initialDifficulty: "LOW",
    progress: 35,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    enabledModules: ["overview", "members", "settings"]
  },
  {
    id: "proj-ai-pm",
    identifier: "ai-pm",
    name: "AI 项目管理平台",
    description: "通过对话、动态看板和 AI 管家完成项目任务管理、进度跟进与风险分析。",
    createdByUserId: "u-pm",
    parentId: "proj-platform",
    status: "ACTIVE",
    health: "MEDIUM",
    initialDifficulty: "MEDIUM",
    progress: 42,
    startDate: "2026-01-05T00:00:00.000Z",
    endDate: "2026-06-30T00:00:00.000Z",
    enabledModules: [
      "overview",
      "work_packages",
      "boards",
      "gantt",
      "members",
      "ai_diagnosis",
      "ai_breakdown",
      "settings"
    ]
  },
  {
    id: "proj-ai-pm-mobile",
    identifier: "ai-pm-mobile",
    name: "移动端体验",
    description: "AI 项目管理平台的移动端体验子项目，复用平台核心数据。",
    createdByUserId: "u-pm",
    parentId: "proj-ai-pm",
    status: "ON_HOLD",
    health: "LOW",
    initialDifficulty: "LOW",
    progress: 12,
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-09-30T00:00:00.000Z",
    enabledModules: ["overview", "work_packages", "boards", "members", "settings"]
  }
];

const users = [
  { id: "u-admin", name: "平台管理员", role: "ADMIN", multiRoles: ["ADMIN"], personId: "p1", projectIds: projects.map((p) => p.id), leadProjectIds: projects.map((p) => p.id) },
  { id: "u-pm", name: "项目经理", role: "PROJECT_MANAGER", multiRoles: ["PROJECT_MANAGER"], personId: "p1", projectIds: ["proj-ai-pm", "proj-ai-pm-mobile"], leadProjectIds: ["proj-ai-pm", "proj-ai-pm-mobile"] },
  { id: "u-teamlead", name: "团队负责人", role: "TEAM_LEAD", multiRoles: ["TEAM_LEAD"], personId: "p3", projectIds: ["proj-ai-pm"], leadProjectIds: [] },
  { id: "u-teamlead-cs", name: "团队负责人-cs", role: "TEAM_LEAD", multiRoles: ["TEAM_LEAD"], personId: "p6", projectIds: [], leadProjectIds: [] },
  { id: "u-member", name: "项目参与员", role: "PARTICIPANT", multiRoles: ["PARTICIPANT"], personId: "p2", projectIds: ["proj-ai-pm"], leadProjectIds: [] },
  { id: "u-qa", name: "测试与部署", role: "PARTICIPANT", multiRoles: ["PARTICIPANT"], personId: "p4", projectIds: [], leadProjectIds: [] },
  { id: "u-embedded", name: "嵌入式开发", role: "PARTICIPANT", multiRoles: ["PARTICIPANT"], personId: "p5", projectIds: [], leadProjectIds: [] }
];

const teams = [
  {
    id: "team-domain-control",
    name: "域控软件交付组",
    description: "负责域控软件任务拆解、成员分配与完成核对。",
    leadId: "p3",
    externalId: "od-sw",
    syncedAt: "2026-05-15T02:00:00.000Z"
  },
  {
    id: "team-customer-success",
    name: "客户成功交付组",
    description: "用于验证项目阶段负责人配置流程的客户交付团队。",
    leadId: "p6",
    externalId: "od-cs",
    syncedAt: "2026-05-18T02:00:00.000Z"
  }
];

const teamMemberships = [
  { id: "tm-domain-lead", teamId: "team-domain-control", personId: "p3" },
  { id: "tm-domain-frontend", teamId: "team-domain-control", personId: "p2" },
  { id: "tm-domain-qa", teamId: "team-domain-control", personId: "p4" },
  { id: "tm-domain-embedded", teamId: "team-domain-control", personId: "p5" },
  { id: "tm-cs-lead", teamId: "team-customer-success", personId: "p6" }
];

const workPackages = [
  {
    id: 1,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "MILESTONE",
    subject: "Agent OS 里程碑",
    description: "沉淀产品、需求、开发、测试、部署的无人值守流程基线。",
    assigneeId: "p1",
    startDate: "2026-04-20T00:00:00.000Z",
    status: "achieved",
    priority: "P0",
    percentComplete: 100,
    lastProgressNote: "Agent OS 已交付。",
    dependencies: [],
    requiredSkills: ["产品定义"],
    dueDate: "2026-04-26T00:00:00.000Z",
    verificationStatus: "VERIFIED",
    requiresVerification: true,
    verifiedByUserId: "u-admin"
  },
  {
    id: 2,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "TASK",
    subject: "实现对话式任务拆解",
    description: "用户输入自然语言后，生成 WorkPackage 草稿和风险候选。",
    assigneeId: "p3",
    startDate: "2026-04-26T00:00:00.000Z",
    status: "inProgress",
    priority: "P0",
    estimateHours: 14,
    percentComplete: 65,
    lastProgressNote: "对话拆解可生成草稿，等待接入服务端权限范围。",
    dependencies: [1],
    requiredSkills: ["接口设计", "Agent 编排"],
    dueDate: "2026-05-05T00:00:00.000Z",
    requiresVerification: true,
    verificationStatus: "PENDING"
  },
  {
    id: 3,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "TASK",
    subject: "构建 OpenProject 风格工作项表格与详情面板",
    description: "Primer 风格的 split-screen 工作项视图：表格 + 右侧详情。",
    assigneeId: "p2",
    startDate: "2026-04-24T00:00:00.000Z",
    status: "review",
    priority: "P1",
    estimateHours: 18,
    percentComplete: 80,
    lastProgressNote: "表格与详情面板初版完成，等待 UI 复审。",
    dependencies: [2],
    requiredSkills: ["看板设计", "前端实现"],
    dueDate: "2026-04-30T00:00:00.000Z"
  },
  {
    id: 4,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "TASK",
    subject: "Docker 与 VPS 部署模板",
    description: "构建 Dockerfile、docker-compose、GitHub Actions 与健康检查。",
    assigneeId: "p4",
    startDate: "2026-04-27T00:00:00.000Z",
    status: "blocked",
    priority: "P1",
    estimateHours: 10,
    percentComplete: 25,
    lastProgressNote: "部署模板存在，等待 VPS 凭据。",
    dependencies: [2, 3],
    requiredSkills: ["部署运维", "健康检查"],
    dueDate: "2026-04-29T00:00:00.000Z"
  },
  {
    id: 5,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "RISK",
    subject: "部署凭据未配置",
    description: "无法完成真实 VPS 自动部署，只能交付部署模板。",
    assigneeId: "p4",
    startDate: "2026-04-25T00:00:00.000Z",
    status: "open",
    priority: "P1",
    percentComplete: 0,
    lastProgressNote: "等待运维提供 SSH key。",
    dependencies: [],
    requiredSkills: [],
    riskLevel: "MEDIUM",
    riskImpact: "无法完成真实 VPS 自动部署，只能交付部署模板。",
    riskMitigation: "使用 GitHub Secrets 占位，并在 README 中说明所需变量。"
  },
  {
    id: 6,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "RISK",
    subject: "真实 LLM Provider 未接入",
    description: "AI 分析暂由 Mock Provider 保障演示。",
    assigneeId: "p3",
    startDate: "2026-04-28T00:00:00.000Z",
    status: "mitigating",
    priority: "P2",
    percentComplete: 30,
    lastProgressNote: "OpenAI Provider 接口已就绪，待接入 API Key。",
    dependencies: [],
    requiredSkills: [],
    riskLevel: "LOW",
    riskImpact: "AI 分析暂由 Mock Provider 保障演示。",
    riskMitigation: "保留 OpenAI 兼容 Provider 接口，后续配置 API Key 即可启用。"
  },
  {
    id: 7,
    projectId: "proj-ai-pm-mobile",
    type: "TASK",
    subject: "移动端工作项列表",
    description: "为移动端实现 OpenProject 风格的工作项列表视图。",
    assigneeId: "p2",
    startDate: "2026-05-20T00:00:00.000Z",
    status: "todo",
    priority: "P2",
    estimateHours: 12,
    percentComplete: 0,
    lastProgressNote: "等待移动端原型设计。",
    dependencies: [3],
    requiredSkills: ["前端实现"],
    dueDate: "2026-06-01T00:00:00.000Z"
  },
  {
    id: 8,
    projectId: PERSONAL_PROJECT_ID,
    createdByUserId: "u-member",
    origin: "SELF",
    type: "TASK",
    subject: "整理个人本周待办",
    description: "不绑定项目的个人事项，用于验证我的工作台可见性。",
    assigneeId: "p2",
    status: "todo",
    priority: "P2",
    estimateHours: 2,
    percentComplete: 0,
    lastProgressNote: "等待开始。",
    dependencies: [],
    requiredSkills: ["个人计划"],
    dueDate: "2026-05-03T00:00:00.000Z"
  },
  {
    id: 9,
    projectId: "proj-ai-pm",
    type: "PHASE",
    subject: "Phase 1 核心能力闭环",
    description: "关键问题：需求稳定性、核心页面验收、测试覆盖。",
    assigneeId: "p1",
    status: "active",
    priority: "P0",
    estimateHours: 40,
    percentComplete: 62,
    lastProgressNote: "首屏、个人工作台、总览基础已进入联调。",
    dependencies: [1],
    requiredSkills: ["产品定义", "接口设计"],
    startDate: "2026-04-20T00:00:00.000Z",
    dueDate: "2026-05-15T00:00:00.000Z"
  },
  {
    id: 10,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "MILESTONE",
    subject: "M2 平台总览验收",
    description: "平台总览与启动页进入演示验收。",
    assigneeId: "p1",
    status: "planned",
    priority: "P0",
    estimateHours: 4,
    percentComplete: 0,
    lastProgressNote: "等待 UI 验收。",
    dependencies: [2, 3, 9],
    requiredSkills: ["验收口径"],
    startDate: "2026-05-10T00:00:00.000Z",
    dueDate: "2026-05-15T00:00:00.000Z"
  },
  {
    id: 11,
    projectId: "proj-ai-pm",
    type: "PHASE",
    subject: "Phase 2 AI 工具与大屏治理",
    description: "关键问题：权限收敛、审计闭环、大屏投屏稳定性。",
    assigneeId: "p1",
    status: "planned",
    priority: "P0",
    estimateHours: 48,
    percentComplete: 35,
    lastProgressNote: "Agent Tools 与大屏展示进入集成验证。",
    dependencies: [9, 10],
    requiredSkills: ["Agent 编排", "可视化"],
    startDate: "2026-05-16T00:00:00.000Z",
    dueDate: "2026-06-12T00:00:00.000Z"
  },
  {
    id: 12,
    projectId: "proj-ai-pm",
    parentId: 11,
    type: "TASK",
    subject: "统一 Tool Registry 调用管道",
    description: "内部 SDK 与 REST 共用统一 schema、权限、审计与幂等逻辑。",
    assigneeId: "p3",
    status: "inProgress",
    priority: "P0",
    estimateHours: 18,
    percentComplete: 55,
    lastProgressNote: "核心注册表已完成，继续补齐审计视图。",
    dependencies: [10],
    requiredSkills: ["Agent 编排", "权限设计"],
    startDate: "2026-05-16T00:00:00.000Z",
    dueDate: "2026-05-28T00:00:00.000Z"
  },
  {
    id: 13,
    projectId: "proj-ai-pm",
    parentId: 11,
    type: "TASK",
    subject: "大屏看板投屏优化",
    description: "适配 1920×1080 / 4K，完成自动刷新、全屏入口和关键路径展示。",
    assigneeId: "p2",
    status: "todo",
    priority: "P1",
    estimateHours: 16,
    percentComplete: 20,
    lastProgressNote: "正在重构按日期驱动的甘特布局。",
    dependencies: [10],
    requiredSkills: ["前端实现", "可视化"],
    startDate: "2026-05-24T00:00:00.000Z",
    dueDate: "2026-06-08T00:00:00.000Z"
  },
  {
    id: 14,
    projectId: "proj-ai-pm",
    parentId: 11,
    type: "MILESTONE",
    subject: "M3 Agent Tools 与大屏验收",
    description: "AI 工具管道和展示型大屏完成演示验收。",
    assigneeId: "p1",
    status: "planned",
    priority: "P0",
    estimateHours: 4,
    percentComplete: 0,
    lastProgressNote: "等待 Phase 2 任务完成。",
    dependencies: [12, 13],
    requiredSkills: ["验收口径"],
    startDate: "2026-06-12T00:00:00.000Z",
    dueDate: "2026-06-12T00:00:00.000Z"
  },
  {
    id: 15,
    projectId: "proj-ai-pm",
    type: "PHASE",
    subject: "Phase 3 投产准备与治理",
    description: "关键问题：部署健康检查、生产权限、风险复盘。",
    assigneeId: "p1",
    status: "planned",
    priority: "P1",
    estimateHours: 36,
    percentComplete: 10,
    lastProgressNote: "等待 Phase 2 验收后启动。",
    dependencies: [14],
    requiredSkills: ["部署运维", "治理"],
    startDate: "2026-06-13T00:00:00.000Z",
    dueDate: "2026-06-30T00:00:00.000Z"
  },
  {
    id: 16,
    projectId: "proj-ai-pm",
    parentId: 15,
    type: "TASK",
    subject: "生产部署健康检查",
    description: "完善 Docker、健康检查、回滚说明和上线验收脚本。",
    assigneeId: "p4",
    status: "todo",
    priority: "P1",
    estimateHours: 14,
    percentComplete: 0,
    lastProgressNote: "等待 Agent Tools 验收后开始。",
    dependencies: [14],
    requiredSkills: ["部署运维", "健康检查"],
    startDate: "2026-06-13T00:00:00.000Z",
    dueDate: "2026-06-24T00:00:00.000Z"
  },
  {
    id: 17,
    projectId: "proj-ai-pm",
    parentId: 15,
    type: "TASK",
    subject: "管理员审计与权限复盘",
    description: "检查 API Key、Agent 调用、FeatureFlag 与管理员入口权限。",
    assigneeId: "p1",
    status: "todo",
    priority: "P1",
    estimateHours: 10,
    percentComplete: 0,
    lastProgressNote: "等待投产前统一复核。",
    dependencies: [14],
    requiredSkills: ["权限设计", "审计"],
    startDate: "2026-06-20T00:00:00.000Z",
    dueDate: "2026-06-28T00:00:00.000Z"
  },
  {
    id: 18,
    projectId: "proj-ai-pm",
    parentId: 15,
    type: "MILESTONE",
    subject: "M4 投产准备完成",
    description: "投产健康检查、权限复盘和风险闭环完成。",
    assigneeId: "p1",
    status: "planned",
    priority: "P1",
    estimateHours: 4,
    percentComplete: 0,
    lastProgressNote: "等待 Phase 3 完成。",
    dependencies: [16, 17],
    requiredSkills: ["验收口径"],
    startDate: "2026-06-30T00:00:00.000Z",
    dueDate: "2026-06-30T00:00:00.000Z"
  },
  {
    id: 19,
    projectId: "proj-ai-pm",
    parentId: 2,
    type: "TASK",
    subject: "补充接口联调用例",
    description: "团队负责人拆分给前端开发的成员子任务。",
    assigneeId: "p2",
    status: "inProgress",
    priority: "P1",
    estimateHours: 6,
    percentComplete: 40,
    lastProgressNote: "已完成联调用例草稿，等待后端接口稳定。",
    dependencies: [2],
    requiredSkills: ["前端实现", "测试设计"],
    startDate: "2026-05-02T00:00:00.000Z",
    dueDate: "2026-05-06T00:00:00.000Z",
    requiresVerification: true,
    verificationStatus: "SELF_REPORTED_DONE"
  },
  {
    id: 20,
    projectId: "proj-ai-pm",
    parentId: 2,
    type: "TASK",
    subject: "整理服务端权限边界说明",
    description: "团队负责人拆分给测试与部署的成员子任务。",
    assigneeId: "p4",
    status: "todo",
    priority: "P1",
    estimateHours: 5,
    percentComplete: 10,
    lastProgressNote: "已收集接口清单。",
    dependencies: [2],
    requiredSkills: ["测试设计", "权限设计"],
    startDate: "2026-05-03T00:00:00.000Z",
    dueDate: "2026-05-07T00:00:00.000Z",
    requiresVerification: true,
    verificationStatus: "REJECTED",
    rejectedReason: "需补充团队负责人 API 范围和按钮权限说明。"
  },
  {
    id: 21,
    projectId: "proj-ai-pm",
    parentId: 2,
    type: "TASK",
    subject: "模拟：参与员历史阻塞恢复后继续验证",
    description: "用于验证项目参与员在工作项恢复为进行中后，即使保留历史阻塞和 delay 标签，也可以继续更新进度。",
    assigneeId: "p2",
    status: "inProgress",
    priority: "P1",
    estimateHours: 6,
    percentComplete: 35,
    lastProgressNote: "上游决策已通过，阻塞解除后继续推进联调验证。",
    blockedReason: "等待上一级接口联调决策。",
    blockedStartedAt: "2026-05-08T00:00:00.000Z",
    blockedResolvedAt: "2026-05-15T00:00:00.000Z",
    delayReason: "上游决策等待导致执行窗口延后。",
    delayDays: 3,
    delayStartedAt: "2026-05-10T00:00:00.000Z",
    delayResolvedAt: "2026-05-15T00:00:00.000Z",
    dependencies: [2],
    requiredSkills: ["前端实现", "联调验证"],
    startDate: "2026-05-07T00:00:00.000Z",
    dueDate: "2026-05-10T00:00:00.000Z"
  }
];

const workPackageRequirements = [
  { id: "wpr-1", workPackageId: 10, content: "平台总览页面已完成布局和主要卡片组件", sortOrder: 0 },
  { id: "wpr-2", workPackageId: 10, content: "首屏启动流程打通，可正常进入项目", sortOrder: 1 },
  { id: "wpr-3", workPackageId: 10, content: "平台总览核心指标数据源已接入", sortOrder: 2 },
  { id: "wpr-4", workPackageId: 14, content: "Agent Tools 统一注册表完成 SDK 调用管道", sortOrder: 0 },
  { id: "wpr-5", workPackageId: 14, content: "大屏看板完成 1920×1080 / 4K 适配和自动刷新", sortOrder: 1 },
  { id: "wpr-6", workPackageId: 14, content: "关键路径甘特图完成按日期驱动的布局重构", sortOrder: 2 },
  { id: "wpr-7", workPackageId: 1, content: "对话拆解 Agent 输出结构已沉淀为 schema", sortOrder: 0 },
  { id: "wpr-8", workPackageId: 1, content: "部署模板 Dockerfile + compose + CI 可运行", sortOrder: 1 },
  { id: "wpr-9", workPackageId: 1, content: "健康检查与回滚说明文档已完成", sortOrder: 2 },
  { id: "wpr-10", workPackageId: 19, content: "联调用例覆盖正常、异常、权限拒绝三类路径", sortOrder: 0 },
  { id: "wpr-11", workPackageId: 20, content: "权限边界说明覆盖按钮、API 与项目范围", sortOrder: 0 }
];

const workPackageAssignments = [
  { id: "wpa-member-2-1", workPackageId: 2, personId: "p3", role: "主负责人", responsibility: "服务端拆解接口、权限边界和 Agent 编排", sortOrder: 0 },
  { id: "wpa-member-2-2", workPackageId: 2, personId: "p2", role: "前端联调", responsibility: "对话入口、草稿预览和异常提示联调", sortOrder: 1 },
  { id: "wpa-member-2-3", workPackageId: 2, personId: "p4", role: "验证支持", responsibility: "接口联调用例、权限拒绝和回归检查", sortOrder: 2 },
  { id: "wpa-member-3-1", workPackageId: 3, personId: "p2", role: "主负责人", responsibility: "工作项表格、详情面板和 hover 体验", sortOrder: 0 },
  { id: "wpa-member-3-2", workPackageId: 3, personId: "p3", role: "接口支持", responsibility: "列表查询、详情更新和成员分工 API 支撑", sortOrder: 1 },
  { id: "wpa-member-4-1", workPackageId: 4, personId: "p4", role: "主负责人", responsibility: "Docker、CI 与 VPS 健康检查模板", sortOrder: 0 },
  { id: "wpa-member-4-2", workPackageId: 4, personId: "p5", role: "产线侧验证", responsibility: "补充域控刷写和产线网络约束检查项", sortOrder: 1 },
  { id: "wpa-member-19-1", workPackageId: 19, personId: "p2", role: "主负责人", responsibility: "补充前端联调用例并提交自测证据", sortOrder: 0 },
  { id: "wpa-member-19-2", workPackageId: 19, personId: "p4", role: "测试复核", responsibility: "覆盖正常、异常、权限拒绝三类路径", sortOrder: 1 },
  { id: "wpa-member-20-1", workPackageId: 20, personId: "p4", role: "主负责人", responsibility: "整理权限边界说明和验证记录", sortOrder: 0 },
  { id: "wpa-member-20-2", workPackageId: 20, personId: "p3", role: "评审人", responsibility: "复核团队负责人 API 范围与数据库写入", sortOrder: 1 }
];

const workPackageComments = [
  {
    id: "wpc-1",
    workPackageId: 2,
    authorPersonId: "p3",
    type: "EVIDENCE",
    body: "已完成对话拆解 Mock Provider，下一步需要产品确认真实 LLM 输出字段。",
    mentionsPersonIds: ["p1"],
    source: "PLATFORM",
    createdAt: "2026-04-28T13:00:00.000Z"
  },
  {
    id: "wpc-2",
    workPackageId: 3,
    authorPersonId: "p2",
    type: "DECISION",
    body: "采用 OpenProject 风格的 split-screen 工作项布局，左表右详情。",
    mentionsPersonIds: ["p1"],
    source: "PLATFORM",
    createdAt: "2026-04-28T14:00:00.000Z"
  },
  {
    id: "wpc-3",
    workPackageId: 4,
    authorPersonId: "p4",
    type: "BLOCKER",
    body: "VPS SSH 与 GitHub Secrets 尚未配置，部署只能停留在模板验证。",
    mentionsPersonIds: ["p1", "p3"],
    source: "PLATFORM",
    createdAt: "2026-04-28T15:00:00.000Z"
  },
  {
    id: "wpc-im-1",
    workPackageId: 3,
    authorPersonId: "p2",
    type: "EVIDENCE",
    body: "【飞书回流】#3 已补充表格筛选截图和 hover 效果说明，等待设计复核。",
    mentionsPersonIds: ["p1"],
    source: "FEISHU",
    sourceChannelId: "ch-feishu-core",
    externalMessageId: "om_demo_wp3_001",
    externalThreadId: "thread_wp_review",
    authorDisplayName: "前端开发",
    createdAt: "2026-04-28T18:00:00.000Z"
  }
];

const workPackageApprovals = [
  {
    id: "wpa-1",
    workPackageId: 1,
    reviewerPersonId: "p1",
    status: "APPROVED",
    comment: "Agent OS 里程碑已达成，可关闭。",
    createdAt: "2026-04-28T16:00:00.000Z"
  },
  {
    id: "wpa-2",
    workPackageId: 3,
    reviewerPersonId: "p1",
    status: "PENDING",
    comment: "等待 UI 设计审查后签核。",
    createdAt: "2026-04-28T16:30:00.000Z"
  },
  {
    id: "wpa-3",
    workPackageId: 4,
    reviewerPersonId: "p1",
    status: "CHANGES_REQUESTED",
    comment: "需要补充部署凭据和回滚说明后再批准。",
    createdAt: "2026-04-28T17:00:00.000Z"
  }
];

const notificationChannels = [
  {
    id: "ch-feishu-core",
    name: "项目飞书群（核心）",
    type: "FEISHU",
    target: "https://open.feishu.cn/open-apis/bot/v2/hook/demo-token",
    enabled: true,
    audienceRoles: ["admin", "projectManager", "participant"],
    audiencePersonIds: [],
    note: "AI 管家进展、计划提醒推送到此群"
  },
  {
    id: "ch-wecom-risk",
    name: "风险企业微信群",
    type: "WECOM_BOT",
    target: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo-key",
    enabled: true,
    audienceRoles: ["admin", "projectManager"],
    audiencePersonIds: [],
    note: "中等以上风险预警，仅项目经理与管理员可见"
  }
];

const notificationRules = [
  {
    id: "rule-progress-feishu",
    projectId: "proj-ai-pm",
    name: "项目进展同步",
    eventTypes: ["progress", "planning"],
    minLevel: "LOW",
    audienceRoles: ["admin", "projectManager", "participant"],
    channelIds: ["ch-feishu-core"]
  },
  {
    id: "rule-risk-broadcast",
    projectId: "proj-ai-pm",
    name: "风险预警广播",
    eventTypes: ["risk"],
    minLevel: "MEDIUM",
    audienceRoles: ["admin", "projectManager"],
    channelIds: ["ch-feishu-core", "ch-wecom-risk"]
  }
];

const notificationTemplates = [
  {
    id: "tmpl-comment",
    activityType: "COMMENT",
    name: "项目评论提醒",
    titleTemplate: "{projectName} 有新的项目评论",
    bodyTemplate: "{projectName} 的成员 {actorName} 围绕工作项「{workPackageSubject}」发表了评论：{content}"
  },
  {
    id: "tmpl-decision",
    activityType: "DECISION",
    name: "待决策提醒",
    titleTemplate: "{projectName} 发起待决策事项",
    bodyTemplate: "{projectName} 的成员 {actorName} 发起了一项待决策信息，关联工作项「{workPackageSubject}」。请团队负责人或项目经理确认同意/拒绝后再推进状态流转：{content}"
  },
  {
    id: "tmpl-blocker",
    activityType: "BLOCKER",
    name: "阻塞同步提醒",
    titleTemplate: "{projectName} 出现阻塞信息",
    bodyTemplate: "{projectName} 的成员 {actorName} 反馈工作项「{workPackageSubject}」存在阻塞：{content}"
  },
  {
    id: "tmpl-evidence",
    activityType: "EVIDENCE",
    name: "证据留痕提醒",
    titleTemplate: "{projectName} 新增交付证据",
    bodyTemplate: "{projectName} 的成员 {actorName} 为工作项「{workPackageSubject}」补充了交付证据：{content}"
  },
  {
    id: "tmpl-approval",
    activityType: "APPROVAL",
    name: "决策结果提醒",
    titleTemplate: "{projectName} 决策已完成",
    bodyTemplate: "{projectName} 的 {actorName} 已对工作项「{workPackageSubject}」完成决策：{content}"
  },
  {
    id: "tmpl-progress",
    activityType: "PROGRESS",
    name: "进展提醒",
    titleTemplate: "{projectName} 工作项进展更新",
    bodyTemplate: "{projectName} 的成员 {actorName} 更新了工作项「{workPackageSubject}」的进展：{content}"
  }
];

const notificationMessages = [
  {
    id: "notif-role-demo-pm-comment",
    projectId: "proj-ai-pm",
    workPackageId: 2,
    senderPersonId: "p3",
    recipientPersonId: "p1",
    recipientUserId: "u-pm",
    activityType: "COMMENT",
    title: "AI 项目管理平台 有新的项目评论",
    body: "AI 项目管理平台的成员 后端开发 围绕工作项「实现对话式任务拆解」发表了评论：服务端接口已完成联调，建议项目经理确认下一轮验收窗口。",
    actionRequired: false,
    decisionStatus: "NONE",
    payloadJson: JSON.stringify({ channelType: "feishu", preview: "项目经理评论提醒卡片消息预览" }),
    createdAt: "2026-05-15T07:10:00.000Z"
  },
  {
    id: "notif-role-demo-lead-decision",
    projectId: "proj-ai-pm",
    workPackageId: 4,
    senderPersonId: "p4",
    recipientPersonId: "p3",
    recipientUserId: "u-teamlead",
    activityType: "DECISION",
    title: "AI 项目管理平台 发起待决策事项",
    body: "AI 项目管理平台的成员 测试与部署 发起了一项待决策信息，关联工作项「Docker 与 VPS 部署模板」。请团队负责人或项目经理确认同意/拒绝后再推进状态流转：是否先按模拟凭据完成 CI 验证，再等待正式 VPS 凭据接入？",
    actionRequired: true,
    decisionStatus: "PENDING",
    payloadJson: JSON.stringify({ channelType: "feishu", preview: "团队负责人待决策卡片消息预览" }),
    createdAt: "2026-05-15T07:11:00.000Z"
  },
  {
    id: "notif-role-demo-member-evidence",
    projectId: "proj-ai-pm",
    workPackageId: 3,
    senderPersonId: "p1",
    recipientPersonId: "p2",
    recipientUserId: "u-member",
    activityType: "EVIDENCE",
    title: "AI 项目管理平台 新增交付证据",
    body: "AI 项目管理平台的成员 项目经理 为工作项「构建 OpenProject 风格工作项表格与详情面板」补充了交付证据：UI 复审截图和验收口径已归档，项目参与员可进入工作项查看。",
    actionRequired: false,
    decisionStatus: "NONE",
    payloadJson: JSON.stringify({ channelType: "feishu", preview: "项目参与员证据提醒卡片消息预览" }),
    createdAt: "2026-05-15T07:12:00.000Z"
  },
  {
    id: "notif-demo-decision-pm",
    projectId: "proj-ai-pm",
    workPackageId: 3,
    commentId: "wpc-2",
    senderPersonId: "p2",
    recipientPersonId: "p1",
    recipientUserId: "u-pm",
    activityType: "DECISION",
    title: "AI 项目管理平台发起待决策事项",
    body: "AI 项目管理平台的成员 前端开发 发起了一项待决策信息，关联工作项「构建 OpenProject 风格工作项表格与详情面板」。请团队负责人或项目经理确认同意/拒绝后再推进状态流转：采用 OpenProject 风格的 split-screen 工作项布局，左表右详情。",
    actionRequired: true,
    decisionStatus: "PENDING",
    payloadJson: JSON.stringify({ channelType: "feishu", preview: "待决策卡片消息预览" }),
    createdAt: "2026-04-28T14:00:00.000Z"
  },
  {
    id: "notif-demo-decision-lead",
    projectId: "proj-ai-pm",
    workPackageId: 3,
    commentId: "wpc-2",
    senderPersonId: "p2",
    recipientPersonId: "p3",
    recipientUserId: "u-teamlead",
    activityType: "DECISION",
    title: "AI 项目管理平台发起待决策事项",
    body: "AI 项目管理平台的成员 前端开发 发起了一项待决策信息，关联工作项「构建 OpenProject 风格工作项表格与详情面板」。请团队负责人或项目经理确认同意/拒绝后再推进状态流转：采用 OpenProject 风格的 split-screen 工作项布局，左表右详情。",
    actionRequired: true,
    decisionStatus: "PENDING",
    payloadJson: JSON.stringify({ channelType: "feishu", preview: "待决策卡片消息预览" }),
    createdAt: "2026-04-28T14:00:01.000Z"
  },
  {
    id: "notif-demo-comment-member",
    projectId: "proj-ai-pm",
    workPackageId: 4,
    commentId: "wpc-3",
    senderPersonId: "p4",
    recipientPersonId: "p2",
    recipientUserId: "u-member",
    activityType: "BLOCKER",
    title: "AI 项目管理平台 出现阻塞信息",
    body: "AI 项目管理平台的成员 测试与部署 反馈工作项「Docker 与 VPS 部署模板」存在阻塞：VPS SSH 与 GitHub Secrets 尚未配置，部署只能停留在模板验证。",
    actionRequired: false,
    decisionStatus: "NONE",
    payloadJson: JSON.stringify({ channelType: "feishu", preview: "阻塞提醒卡片消息预览" }),
    createdAt: "2026-04-28T15:00:00.000Z"
  }
];

const stewardMessages = [
  {
    id: "sm1",
    projectId: "proj-ai-pm",
    type: "progress",
    title: "今日进展",
    body: "AI 项目管理平台已切换到 OpenProject 风格架构，工作项与项目层级开始联动。",
    level: "LOW",
    createdAt: "2026-04-28T09:00:00.000Z"
  },
  {
    id: "sm2",
    projectId: "proj-ai-pm",
    type: "risk",
    title: "部署风险",
    body: "VPS 地址和 SSH 密钥尚未配置，真实自动部署会在 CI 模板完成后等待凭据。",
    level: "MEDIUM",
    createdAt: "2026-04-28T10:00:00.000Z"
  }
];

const platformFeatureFlags = [
  {
    key: "launchPage",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制项目启动选择页 /launch 与根路由启动流程。"
  },
  {
    key: "platformOverview",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制平台总览 /overview 入口、页面与 API。"
  },
  {
    key: "personalWorkPackage",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制个人事项快速新建与完整新建入口。"
  },
  {
    key: "personalAgentBreakdown",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制个人 AI 拆解 /my/breakdown 入口。"
  },
  {
    key: "personalNotifications",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制我的工作台个人通知区块。"
  },
  {
    key: "bigScreen",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制平台总览大屏看板 /overview/screen。"
  },
  {
    key: "agentTools",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制 AI 友好工具集 REST / SDK 调用管道。"
  },
  {
    key: "agentMcpServer",
    siteEnabled: false,
    roleOverrides: {},
    description: "控制 MCP 预留端点；本阶段仅保留 501 壳子。"
  }
];

async function main() {
  await prisma.agentToolInvocation.deleteMany();
  await prisma.agentApiKey.deleteMany();
  await prisma.projectQualityMetric.deleteMany();
  await prisma.projectQualitySnapshot.deleteMany();
  await prisma.workPackageImpactEvent.deleteMany();
  await prisma.workPackageProgressEvent.deleteMany();
  await prisma.notificationDelivery.deleteMany();
  await prisma.notificationMessage.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.notificationRuleChannel.deleteMany();
  await prisma.notificationRule.deleteMany();
  await prisma.notificationChannel.deleteMany();
  await prisma.agentBreakdownDraft.deleteMany();
  await prisma.workPackageApproval.deleteMany();
  await prisma.workPackageComment.deleteMany();
  await prisma.stewardMessage.deleteMany();
  await prisma.workPackageAssignment.deleteMany();
  await prisma.workPackageRequirement.deleteMany();
  await prisma.workPackage.deleteMany();
  await prisma.projectMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.project.deleteMany();
  await prisma.externalPerson.deleteMany();
  await prisma.externalDepartment.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.person.deleteMany();
  await prisma.externalSyncRun.deleteMany();
  await prisma.platformFeatureFlag.deleteMany();
  await prisma.permissionOverride.deleteMany();

  await prisma.person.createMany({
    data: people.map((person) => ({
      ...person,
      skills: JSON.stringify(person.skills)
    }))
  });

  await prisma.externalDepartment.createMany({
    data: externalDepartments.map((department) => ({
      ...department,
      rawJson: JSON.stringify({ source: "seed", provider: "feishu" })
    }))
  });

  await prisma.externalPerson.createMany({
    data: externalPersons.map((person) => ({
      ...person,
      rawJson: JSON.stringify({ source: "seed", provider: "feishu" })
    }))
  });

  for (const project of projects) {
    await prisma.project.create({
      data: {
        id: project.id,
        identifier: project.identifier,
        name: project.name,
        description: project.description,
        createdByUserId: project.createdByUserId,
        parentId: project.parentId,
        status: project.status,
        health: project.health,
        initialDifficulty: project.initialDifficulty,
        progress: project.progress,
        startDate: project.startDate ? new Date(project.startDate) : null,
        endDate: project.endDate ? new Date(project.endDate) : null,
        enabledModules: JSON.stringify(project.enabledModules)
      }
    });
  }

  await prisma.user.createMany({
    data: users.map(({ id, name, role, multiRoles, personId }) => ({
      id,
      name,
      role,
      roles: JSON.stringify(multiRoles),
      personId
    }))
  });

  for (const user of users) {
    for (const projectId of user.projectIds) {
      await prisma.projectMembership.create({
        data: {
          userId: user.id,
          projectId,
          isLead: user.leadProjectIds.includes(projectId)
        }
      });
    }
  }

  await prisma.team.createMany({
    data: teams.map((team) => ({
      ...team,
      syncedAt: team.syncedAt ? new Date(team.syncedAt) : null
    }))
  });

  await prisma.teamMembership.createMany({
    data: teamMemberships
  });

  const rootWorkPackages = workPackages.filter((wp) => !wp.parentId);
  const childWorkPackages = workPackages.filter((wp) => wp.parentId);

  for (const workPackage of rootWorkPackages) {
    await prisma.workPackage.create({
      data: {
        id: workPackage.id,
        projectId: workPackage.projectId,
        type: workPackage.type,
        subject: workPackage.subject,
        description: workPackage.description,
        status: workPackage.status,
        priority: workPackage.priority,
        origin: workPackage.origin ?? "MANAGER",
        createdByUserId: workPackage.createdByUserId ?? resolveProjectCreatorUserId(workPackage.projectId),
        assigneeId: workPackage.assigneeId,
        parentId: workPackage.parentId,
        startDate: workPackage.startDate ? new Date(workPackage.startDate) : null,
        estimateHours: workPackage.estimateHours,
        percentComplete: workPackage.percentComplete,
        lastProgressNote: workPackage.lastProgressNote,
        blockedReason: workPackage.blockedReason,
        blockedStartedAt: workPackage.blockedStartedAt ? new Date(workPackage.blockedStartedAt) : null,
        blockedResolvedAt: workPackage.blockedResolvedAt ? new Date(workPackage.blockedResolvedAt) : null,
        delayReason: workPackage.delayReason,
        delayDays: workPackage.delayDays ?? 0,
        delayStartedAt: workPackage.delayStartedAt ? new Date(workPackage.delayStartedAt) : null,
        delayResolvedAt: workPackage.delayResolvedAt ? new Date(workPackage.delayResolvedAt) : null,
        dependencies: JSON.stringify(workPackage.dependencies),
        requiredSkills: JSON.stringify(workPackage.requiredSkills),
        isOnCriticalPath: workPackage.priority === "P0",
        riskLevel: workPackage.riskLevel,
        riskImpact: workPackage.riskImpact,
        riskMitigation: workPackage.riskMitigation,
        verificationStatus: workPackage.verificationStatus,
        requiresVerification: workPackage.requiresVerification ?? false,
        verifiedByUserId: workPackage.verifiedByUserId,
        rejectedReason: workPackage.rejectedReason,
        dueDate: workPackage.dueDate ? new Date(workPackage.dueDate) : null
      }
    });
  }

  for (const workPackage of childWorkPackages) {
    await prisma.workPackage.create({
      data: {
        id: workPackage.id,
        projectId: workPackage.projectId,
        type: workPackage.type,
        subject: workPackage.subject,
        description: workPackage.description,
        status: workPackage.status,
        priority: workPackage.priority,
        origin: workPackage.origin ?? "MANAGER",
        createdByUserId: workPackage.createdByUserId ?? resolveProjectCreatorUserId(workPackage.projectId),
        assigneeId: workPackage.assigneeId,
        parentId: workPackage.parentId,
        startDate: workPackage.startDate ? new Date(workPackage.startDate) : null,
        estimateHours: workPackage.estimateHours,
        percentComplete: workPackage.percentComplete,
        lastProgressNote: workPackage.lastProgressNote,
        blockedReason: workPackage.blockedReason,
        blockedStartedAt: workPackage.blockedStartedAt ? new Date(workPackage.blockedStartedAt) : null,
        blockedResolvedAt: workPackage.blockedResolvedAt ? new Date(workPackage.blockedResolvedAt) : null,
        delayReason: workPackage.delayReason,
        delayDays: workPackage.delayDays ?? 0,
        delayStartedAt: workPackage.delayStartedAt ? new Date(workPackage.delayStartedAt) : null,
        delayResolvedAt: workPackage.delayResolvedAt ? new Date(workPackage.delayResolvedAt) : null,
        dependencies: JSON.stringify(workPackage.dependencies),
        requiredSkills: JSON.stringify(workPackage.requiredSkills),
        isOnCriticalPath: workPackage.priority === "P0",
        riskLevel: workPackage.riskLevel,
        riskImpact: workPackage.riskImpact,
        riskMitigation: workPackage.riskMitigation,
        verificationStatus: workPackage.verificationStatus,
        requiresVerification: workPackage.requiresVerification ?? false,
        verifiedByUserId: workPackage.verifiedByUserId,
        dueDate: workPackage.dueDate ? new Date(workPackage.dueDate) : null
      }
    });
  }

  await prisma.workPackageComment.createMany({
    data: workPackageComments.map((comment) => ({
      id: comment.id,
      workPackageId: comment.workPackageId,
      authorPersonId: comment.authorPersonId,
      type: comment.type,
      body: comment.body,
      mentionsPersonIds: JSON.stringify(comment.mentionsPersonIds),
      source: comment.source,
      sourceChannelId: comment.sourceChannelId ?? null,
      externalMessageId: comment.externalMessageId ?? null,
      externalThreadId: comment.externalThreadId ?? null,
      authorDisplayName: comment.authorDisplayName ?? null,
      createdAt: new Date(comment.createdAt)
    }))
  });

  await prisma.workPackageApproval.createMany({
    data: workPackageApprovals.map((approval) => ({
      ...approval,
      createdAt: new Date(approval.createdAt)
    }))
  });

  await prisma.workPackageRequirement.createMany({
    data: workPackageRequirements.map((req) => ({
      id: req.id,
      workPackageId: req.workPackageId,
      content: req.content,
      sortOrder: req.sortOrder
    }))
  });

  await prisma.workPackageAssignment.createMany({
    data: workPackageAssignments
  });

  await prisma.stewardMessage.createMany({
    data: stewardMessages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt)
    }))
  });

  await prisma.notificationChannel.createMany({
    data: notificationChannels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      target: channel.target,
      enabled: channel.enabled,
      audienceRoles: JSON.stringify(channel.audienceRoles),
      audiencePersonIds: JSON.stringify(channel.audiencePersonIds),
      note: channel.note
    }))
  });

  for (const rule of notificationRules) {
    await prisma.notificationRule.create({
      data: {
        id: rule.id,
        projectId: rule.projectId,
        name: rule.name,
        eventTypes: JSON.stringify(rule.eventTypes),
        minLevel: rule.minLevel,
        audienceRoles: JSON.stringify(rule.audienceRoles),
        channels: {
          create: rule.channelIds.map((channelId) => ({ channelId }))
        }
      }
    });
  }

  await prisma.notificationTemplate.createMany({
    data: notificationTemplates.map((template) => ({
      ...template,
      cardTemplateJson: "{}",
      enabled: true
    }))
  });

  await prisma.notificationMessage.createMany({
    data: notificationMessages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt)
    }))
  });

  await prisma.agentBreakdownDraft.create({
    data: {
      id: "draft-mvp-main-path",
      projectId: "proj-ai-pm",
      createdByUserId: "u-pm",
      prompt: "将平台收束为生产可用的 AI 项目管理 MVP",
      analysisJson: JSON.stringify({
        productDefinition: "围绕项目经理日常同步建立可追溯闭环。",
        tasks: [],
        risks: [],
        progressReport: "待确认后生成正式工作项。",
        nextActions: ["确认 P0 主路径", "落地服务端事实源"]
      }),
      status: "PENDING"
    }
  });

  await prisma.platformFeatureFlag.createMany({
    data: platformFeatureFlags.map((flag) => ({
      ...flag,
      roleOverrides: JSON.stringify(flag.roleOverrides)
    }))
  });
}

function resolveProjectCreatorUserId(projectId) {
  const projectManager = users.find(
    (user) => user.role === "PROJECT_MANAGER" && user.projectIds.includes(projectId)
  );

  return projectManager?.id ?? "u-admin";
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
