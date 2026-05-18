import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mapUser, type StoredUser } from "@/lib/repositories/workspace-mappers";
import type { User } from "@/lib/types";

export interface AgentAuthContext {
  user: User;
  apiKeyId?: string;
  allowedTools?: string[];
  source: "rest:user" | "rest:api-key" | "internal";
}

export function hashAgentApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateAgentApiKey() {
  const secret = `myg_${randomBytes(24).toString("hex")}`;
  return {
    secret,
    prefix: secret.slice(0, 12),
    hash: hashAgentApiKey(secret)
  };
}

/**
 * Resolves a REST request into a user context, supporting x-user-id or Bearer API key.
 */
export async function resolveAgentAuthFromRequest(request: Request): Promise<AgentAuthContext> {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  if (bearer) {
    const key = await prisma.agentApiKey.findFirst({
      where: {
        keyPrefix: bearer.slice(0, 12),
        hashedKey: hashAgentApiKey(bearer),
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
    if (!key) {
      throw new Error("Agent API Key 无效或已撤销。");
    }

    const user = await prisma.user.findUnique({
      where: { id: key.createdByUserId },
      include: { memberships: true }
    });
    if (!user) {
      throw new Error("Agent API Key 关联用户不存在。");
    }

    return {
      user: mapUser({
        ...user,
        roles: JSON.stringify([user.role])
      } as unknown as StoredUser),
      apiKeyId: key.id,
      allowedTools: parseStringArray(key.allowedTools),
      source: "rest:api-key"
    };
  }

  const userId = request.headers.get("x-user-id") ?? "u-pm";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true }
  });
  if (!user) {
    throw new Error("未找到当前用户，请提供有效的 x-user-id。");
  }

  return {
    user: mapUser({
      ...user,
      roles: JSON.stringify([user.role])
    } as unknown as StoredUser),
    source: "rest:user"
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
