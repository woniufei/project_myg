import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { MyNotificationsPanel } from "@/components/notifications/MyNotificationsPanel";
import { MyWorkbenchTable } from "@/components/work-packages/MyWorkbenchTable";
import { PersonalWorkPackageQuickCreate } from "@/components/work-packages/PersonalWorkPackageQuickCreate";
import { calculateDashboardStats } from "@/lib/analytics";
import { roleLabels } from "@/lib/rbac";
import { isFlagEnabledForUser, listPlatformFeatureFlags } from "@/lib/services/feature-flags";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { Project } from "@/lib/types";
import {
  projectStatusLabel,
  projectStatusTone
} from "@/lib/work-package-presentation";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const flags = await listPlatformFeatureFlags();
  const canUsePersonalWorkPackage = isFlagEnabledForUser(flags, "personalWorkPackage", currentUser);
  const canUsePersonalAgentBreakdown = isFlagEnabledForUser(flags, "personalAgentBreakdown", currentUser);
  const canViewPersonalNotifications = isFlagEnabledForUser(flags, "personalNotifications", currentUser);

  const myProjectIds = currentUser
    ? new Set([...currentUser.managedProjectIds, ...currentUser.participatingProjectIds])
    : new Set<string>();
  const myWorkPackages = currentUser
    ? Array.from(
        new Map(
          snapshot.workPackages
            .filter(
              (wp) =>
                wp.assigneeId === currentUser.personId ||
                wp.assignments?.some((assignment) => assignment.personId === currentUser.personId) ||
                wp.createdByUserId === currentUser.id ||
                (currentUser.role === "teamLead" && wp.type === "phase" && Boolean(wp.projectId && myProjectIds.has(wp.projectId)))
            )
            .map((wp) => [wp.id, wp])
        ).values()
      ).sort((left, right) => (right.lastUpdatedAt ?? "").localeCompare(left.lastUpdatedAt ?? ""))
    : [];
  const personalWorkPackageCount = myWorkPackages.filter((wp) => !wp.projectId).length;
  const myProjects = currentUser
    ? snapshot.projects.filter((project) => myProjectIds.has(project.id))
    : snapshot.projects;
  const stats = calculateDashboardStats({ ...snapshot, workPackages: myWorkPackages });

  return (
    <>
      <Breadcrumb items={[{ label: "我的工作" }]} />

      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">我的工作台</h1>
          <p className="page-subtitle">
            {currentUser
              ? `欢迎回来，${currentUser.name}（${roleLabels[currentUser.role]}）。下面是你今天需要关注的项目和工作项。`
              : "请先在右上角选择一个演示账号。"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {canUsePersonalAgentBreakdown ? (
            <Link href="/my/breakdown" className="btn" data-size="sm" data-variant="accent">
              AI 帮我拆解
            </Link>
          ) : null}
          {canUsePersonalWorkPackage ? (
            <>
              <Link href="/my/work-packages/new" className="btn" data-size="sm">
                完整新建
              </Link>
              <PersonalWorkPackageQuickCreate currentUser={currentUser} projects={myProjects} />
            </>
          ) : null}
        </div>
      </header>

      <div className="stat-grid">
        <StatCard label="我的项目" value={myProjects.length} />
        <StatCard label="我的工作项" value={myWorkPackages.length} />
        <StatCard label="个人事项" value={personalWorkPackageCount} tone="accent" />
        <StatCard
          label="阻塞"
          value={stats.blockedCount}
          tone={stats.blockedCount > 0 ? "danger" : "default"}
        />
        <StatCard label="平均完成率" value={`${stats.averageProgress}%`} tone="success" />
      </div>

      <Surface
        title="我的工作项"
        description="合并展示分配给我和我创建的工作项，个人事项可直接挂载到项目。"
        actions={
          myWorkPackages.length > 0 ? (
            <Link href="/work-packages" className="btn" data-size="sm">
              查看所有工作项
            </Link>
          ) : null
        }
        flush
      >
        {myWorkPackages.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title="当前没有工作项"
              description="可以快速新建个人事项，或让 AI 帮你拆解一段需求。"
              action={
                canUsePersonalWorkPackage ? (
                  <Link href="/my/work-packages/new" className="btn" data-size="sm">
                    新建工作项
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <MyWorkbenchTable
            currentUser={currentUser}
            workPackages={myWorkPackages}
            allWorkPackages={snapshot.workPackages}
            projects={myProjects}
            people={snapshot.people}
            comments={snapshot.workPackageComments}
            approvals={snapshot.workPackageApprovals}
          />
        )}
      </Surface>

      {canViewPersonalNotifications ? (
        <Surface title="我的通知" description="最近与你当前角色相关的通知投递。">
          <MyNotificationsPanel currentUser={currentUser} />
        </Surface>
      ) : null}

      <Surface title="我的项目" description="按层级缩进展示我能看到的项目。" flush>
        {myProjects.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState title="暂无项目" description="管理员可在「管理员区」创建首个项目。" />
          </div>
        ) : (
          <ProjectsList projects={myProjects} />
        )}
      </Surface>
    </>
  );
}

function StatCard({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "success" | "attention" | "accent";
}) {
  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value" data-tone={tone}>
        {value}
      </p>
    </div>
  );
}

function ProjectsList({ projects }: { projects: Project[] }) {
  return (
    <div className="scroll-x">
      <table className="data-table" style={{ minWidth: 600 }}>
        <colgroup>
          <col />
          <col style={{ width: 120 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
        </colgroup>
        <thead>
          <tr>
            <th>项目</th>
            <th>状态</th>
            <th>健康度</th>
            <th>进度</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {project.parentId ? (
                    <span aria-hidden="true" style={{ color: "var(--fg-subtle)" }}>↳</span>
                  ) : null}
                  <Link
                    href={`/projects/${project.identifier}/overview`}
                    style={{ color: "var(--fg-default)", fontWeight: 500 }}
                  >
                    {project.name}
                  </Link>
                </div>
              </td>
              <td>
                <Badge tone={projectStatusTone(project.status)}>
                  {projectStatusLabel(project.status)}
                </Badge>
              </td>
              <td>
                <Badge
                  tone={
                    project.health === "High"
                      ? "danger"
                      : project.health === "Medium"
                        ? "attention"
                        : "success"
                  }
                >
                  {project.health}
                </Badge>
              </td>
              <td className="hint mono">{project.progress}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
