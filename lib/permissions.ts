import type { RolePermission } from "./types";

/**
 * 平台权限矩阵定义。
 * 每个权限项 key 为唯一标识，label 为中文说明，
 * 四个角色列对应：admin / projectManager / teamLead / participant。
 *
 * 与 docs/权限与菜单设计方案.md 保持同步。
 */
export const permissionMatrix: RolePermission[] = [
  {
    key: "overview",
    label: "查看项目工作台",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "manageProjects",
    label: "创建与管理项目",
    admin: true,
    projectManager: true,
    teamLead: false,
    participant: false
  },
  {
    key: "manageProjectModules",
    label: "启用/禁用项目模块",
    admin: true,
    projectManager: true,
    teamLead: false,
    participant: false
  },
  {
    key: "assignWorkPackages",
    label: "分配工作项与调整负责人",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: false
  },
  {
    key: "updateOwnWorkPackages",
    label: "更新本人工作项进展",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "approveWorkPackages",
    label: "对工作项执行签核或待决策处理",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: false
  },
  {
    key: "manageNotifications",
    label: "管理通知模板、通道、路由规则与投递审计",
    admin: true,
    projectManager: false,
    teamLead: false,
    participant: false
  },
  {
    key: "viewNotifications",
    label: "查看个人范围内的智能通知",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "viewIntelligence",
    label: "查看智能调度建议、健康度与催办",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "useAgentBreakdown",
    label: "使用 AI 拆解工作项草稿",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: false
  },
  {
    key: "createPersonalWorkPackage",
    label: "创建个人工作项",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "deleteOwnWorkPackage",
    label: "删除本人创建的工作项",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "usePersonalAgentBreakdown",
    label: "使用个人 AI 拆解",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "deleteAnyWorkPackage",
    label: "删除任意工作项",
    admin: true,
    projectManager: false,
    teamLead: false,
    participant: false
  },
  {
    key: "viewPlatformOverview",
    label: "查看平台总览",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: false
  },
  {
    key: "managePlatformFeatureFlags",
    label: "管理平台模块开关",
    admin: true,
    projectManager: false,
    teamLead: false,
    participant: false
  },
  {
    key: "viewBigScreen",
    label: "查看平台大屏",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: false
  },
  {
    key: "useAgentTool",
    label: "使用 AI 工具",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: true
  },
  {
    key: "manageAgentApiKeys",
    label: "管理 Agent API Key",
    admin: true,
    projectManager: false,
    teamLead: false,
    participant: false
  },
  {
    key: "viewAgentAudit",
    label: "查看 Agent 调用审计",
    admin: true,
    projectManager: true,
    teamLead: false,
    participant: false
  },
  {
    key: "manageTeamMembers",
    label: "管理团队成员",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: false
  },
  {
    key: "manageTeams",
    label: "创建、编辑和删除团队",
    admin: true,
    projectManager: false,
    teamLead: false,
    participant: false
  },
  {
    key: "manageUserRoles",
    label: "配置用户角色",
    admin: true,
    projectManager: true,
    teamLead: true,
    participant: false
  },
  {
    key: "managePermissions",
    label: "配置操作级权限",
    admin: true,
    projectManager: false,
    teamLead: false,
    participant: false
  },
  {
    key: "verifyWorkPackages",
    label: "核对工作项完成情况",
    admin: true,
    projectManager: false,
    teamLead: true,
    participant: false
  }
];
