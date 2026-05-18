import { prisma } from "@/lib/prisma";
import { getUserRoles } from "@/lib/rbac";
import type { PlatformRole, User } from "@/lib/types";
import { assertPermission, ServiceError } from "./auth-context";

export type PlatformFeatureFlagKey =
  | "launchPage"
  | "platformOverview"
  | "personalWorkPackage"
  | "personalAgentBreakdown"
  | "personalNotifications"
  | "bigScreen"
  | "agentTools"
  | "agentMcpServer";

export interface PlatformFeatureFlagDto {
  key: PlatformFeatureFlagKey;
  siteEnabled: boolean;
  roleOverrides: Partial<Record<PlatformRole, boolean>>;
  description: string;
}

export interface FeatureFlagPatchInput {
  key: PlatformFeatureFlagKey;
  siteEnabled?: boolean;
  roleOverrides?: Partial<Record<PlatformRole, boolean>>;
}

export const DEFAULT_PLATFORM_FEATURE_FLAGS: PlatformFeatureFlagDto[] = [
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

/**
 * Lists persisted feature flags, creating default rows when the table is empty.
 */
export async function listPlatformFeatureFlags(): Promise<PlatformFeatureFlagDto[]> {
  await ensureDefaultPlatformFeatureFlags();
  const rows = await prisma.platformFeatureFlag.findMany({ orderBy: { key: "asc" } });
  const order = new Map(DEFAULT_PLATFORM_FEATURE_FLAGS.map((flag, index) => [flag.key, index]));

  return rows
    .map((row) => ({
      key: row.key as PlatformFeatureFlagKey,
      siteEnabled: row.siteEnabled,
      roleOverrides: parseRoleOverrides(row.roleOverrides),
      description: row.description
    }))
    .sort((left, right) => (order.get(left.key) ?? 99) - (order.get(right.key) ?? 99));
}

/**
 * Updates a feature flag after admin permission validation.
 */
export async function updatePlatformFeatureFlag(
  input: FeatureFlagPatchInput,
  user: User
): Promise<PlatformFeatureFlagDto> {
  assertPermission(user.role, "managePlatformFeatureFlags");
  if (!DEFAULT_PLATFORM_FEATURE_FLAGS.some((flag) => flag.key === input.key)) {
    throw new ServiceError("未知的平台模块开关。", 404);
  }

  await ensureDefaultPlatformFeatureFlags();
  const current = await prisma.platformFeatureFlag.findUnique({ where: { key: input.key } });
  const nextOverrides =
    input.roleOverrides === undefined
      ? current?.roleOverrides ?? "{}"
      : JSON.stringify(normalizeRoleOverrides(input.roleOverrides));

  const updated = await prisma.platformFeatureFlag.update({
    where: { key: input.key },
    data: {
      siteEnabled: input.siteEnabled,
      roleOverrides: nextOverrides
    }
  });

  return {
    key: updated.key as PlatformFeatureFlagKey,
    siteEnabled: updated.siteEnabled,
    roleOverrides: parseRoleOverrides(updated.roleOverrides),
    description: updated.description
  };
}

/**
 * Evaluates whether the module is enabled for the current user role.
 */
export async function isModuleEnabledForUser(
  key: PlatformFeatureFlagKey,
  user?: User
): Promise<boolean> {
  const flags = await listPlatformFeatureFlags();
  const flag = flags.find((item) => item.key === key);
  if (!flag?.siteEnabled) {
    return false;
  }

  if (!user) {
    return true;
  }

  return getUserRoles(user).some((role) => flag.roleOverrides[role] ?? true);
}

export function isFlagEnabledForUser(
  flags: PlatformFeatureFlagDto[],
  key: PlatformFeatureFlagKey,
  user?: User
): boolean {
  const flag = flags.find((item) => item.key === key);
  if (!flag?.siteEnabled) {
    return false;
  }

  return user ? getUserRoles(user).some((role) => flag.roleOverrides[role] ?? true) : true;
}

async function ensureDefaultPlatformFeatureFlags() {
  for (const flag of DEFAULT_PLATFORM_FEATURE_FLAGS) {
    await prisma.platformFeatureFlag.upsert({
      where: { key: flag.key },
      create: {
        key: flag.key,
        siteEnabled: flag.siteEnabled,
        roleOverrides: JSON.stringify(flag.roleOverrides),
        description: flag.description
      },
      update: {
        description: flag.description
      }
    });
  }
}

function parseRoleOverrides(value: string): Partial<Record<PlatformRole, boolean>> {
  try {
    return normalizeRoleOverrides(JSON.parse(value) as Partial<Record<PlatformRole, boolean>>);
  } catch {
    return {};
  }
}

function normalizeRoleOverrides(
  value: Partial<Record<PlatformRole, boolean>>
): Partial<Record<PlatformRole, boolean>> {
  const normalized: Partial<Record<PlatformRole, boolean>> = {};
  for (const role of ["admin", "projectManager", "teamLead", "participant"] satisfies PlatformRole[]) {
    if (typeof value[role] === "boolean") {
      normalized[role] = value[role];
    }
  }

  return normalized;
}
