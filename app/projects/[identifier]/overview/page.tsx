import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { calculateDashboardStats } from "@/lib/analytics";
import { calculateProjectHealthScores } from "@/lib/intelligence/health";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import {
  getStatusTone,
  projectStatusLabel,
  projectStatusTone,
  riskLevelTone,
  statusLabel,
  typeLabel,
  typeTone
} from "@/lib/work-package-presentation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectOverviewPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }

  const projectWorkPackages = snapshot.workPackages.filter((wp) => wp.projectId === project.id);
  const projectScopedSnapshot = {
    ...snapshot,
    projects: [project],
    workPackages: projectWorkPackages
  };
  const stats = calculateDashboardStats(projectScopedSnapshot);
  const healthScore = calculateProjectHealthScores(projectScopedSnapshot)[0];
  const recentWorkPackages = [...projectWorkPackages]
    .sort((left, right) => (right.lastUpdatedAt ?? "").localeCompare(left.lastUpdatedAt ?? ""))
    .slice(0, 6);
  const risks = projectWorkPackages.filter((wp) => wp.type === "risk");
  const subProjects = snapshot.projects.filter((item) => item.parentId === project.id);
  const personLookup = new Map(snapshot.people.map((person) => [person.id, person]));
  const activeCount = projectWorkPackages.filter((wp) => wp.status !== "done").length;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name }
        ]}
      />

      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">{project.name}</h1>
          {project.description ? (
            <p className="page-subtitle">{project.description}</p>
          ) : null}
          <div className="page-header__chips">
            <Badge tone={projectStatusTone(project.status)}>
              {projectStatusLabel(project.status)}
            </Badge>
            <Badge tone={riskLevelTone(project.health)}>健康度 {project.health}</Badge>
            <span className="hint mono" style={{ fontSize: 11 }}>
              {project.identifier}
            </span>
          </div>
        </div>
        <div className="page-header__actions">
          <Link
            href={`/projects/${project.identifier}/work-packages`}
            className="btn"
            data-size="sm"
          >
            打开工作项
          </Link>
          <Link
            href={`/projects/${project.identifier}/settings`}
            className="btn"
            data-variant="ghost"
            data-size="sm"
          >
            项目设置
          </Link>
        </div>
      </header>

      <div className="stat-grid stat-grid--five">
        <StatCard label="工作项总数" value={projectWorkPackages.length} />
        <StatCard label="活动中" value={activeCount} tone="accent" />
        <StatCard
          label="阻塞"
          value={stats.blockedCount}
          tone={stats.blockedCount > 0 ? "danger" : "default"}
        />
        <StatCard label="风险" value={risks.length} tone={risks.length > 0 ? "attention" : "default"} />
        <StatCard label="平均完成率" value={`${stats.averageProgress}%`} tone="success" />
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)"
        }}
      >
        <Surface
          title="最近更新"
          description="按更新时间排序的工作项。"
          actions={
            <Link
              href={`/projects/${project.identifier}/work-packages`}
              className="btn"
              data-size="sm"
            >
              全部
            </Link>
          }
          flush
        >
          {recentWorkPackages.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState title="项目暂无工作项" description="可在「工作项」模块新建第一项。" />
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {recentWorkPackages.map((wp, index) => (
                <li
                  key={wp.id}
                  style={{
                    padding: "10px 16px",
                    borderTop: index === 0 ? undefined : "1px solid var(--border-muted)",
                    display: "grid",
                    gridTemplateColumns: "auto auto 1fr auto",
                    gap: 10,
                    alignItems: "center"
                  }}
                >
                  <Badge tone={typeTone(wp.type)}>{typeLabel(wp.type)}</Badge>
                  <span className="hint mono" style={{ fontSize: 11 }}>#{wp.id}</span>
                  <Link
                    href={`/projects/${project.identifier}/work-packages/${wp.id}`}
                    style={{
                      color: "var(--fg-default)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {wp.subject}
                  </Link>
                  <Badge tone={getStatusTone(wp.status)}>{statusLabel(wp.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Surface title="健康度" description="按工作项与风险综合计算。">
            {healthScore ? (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 32, fontWeight: 600, color: "var(--fg-default)", letterSpacing: "-0.02em" }}>
                    {healthScore.score}
                  </span>
                  <span className="hint" style={{ fontSize: 12 }}>/ 100</span>
                </div>
                <p className="hint" style={{ marginTop: 4, fontSize: 12 }}>
                  {healthScore.highlight}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 4 }}>
                  {healthScore.contributors.map((contributor) => (
                    <li
                      key={contributor.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0",
                        fontSize: 12
                      }}
                    >
                      <span className="hint">{contributor.label}</span>
                      <span
                        className="mono"
                        style={{
                          color:
                            contributor.impact > 0
                              ? "var(--success-fg)"
                              : contributor.impact < 0
                                ? "var(--danger-fg)"
                                : "var(--fg-muted)",
                          fontWeight: 600
                        }}
                      >
                        {contributor.impact >= 0 ? "+" : ""}
                        {contributor.impact}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState title="尚无健康度数据" />
            )}
          </Surface>

          <Surface title="风险" description={`${risks.length} 项`}>
            {risks.length === 0 ? (
              <EmptyState title="暂无风险" />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {risks.map((risk) => (
                  <li
                    key={risk.id}
                    style={{
                      borderLeft: `3px solid ${
                        risk.riskLevel === "High"
                          ? "var(--danger-fg)"
                          : risk.riskLevel === "Medium"
                            ? "var(--attention-fg)"
                            : "var(--fg-subtle)"
                      }`,
                      paddingLeft: 10
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{risk.subject}</strong>
                      {risk.riskLevel ? (
                        <Badge tone={riskLevelTone(risk.riskLevel)}>{risk.riskLevel}</Badge>
                      ) : null}
                    </div>
                    <p className="hint" style={{ margin: "4px 0 0", fontSize: 12 }}>
                      {risk.riskImpact ?? risk.description}
                    </p>
                    <p className="hint" style={{ margin: "4px 0 0", fontSize: 11 }}>
                      负责人 {risk.assigneeId ? personLookup.get(risk.assigneeId)?.name ?? "未分配" : "未分配"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          {subProjects.length > 0 ? (
            <Surface title={`子项目 (${subProjects.length})`} flush>
              <ul style={{ listStyle: "none", padding: 8, margin: 0, display: "grid", gap: 2 }}>
                {subProjects.map((sub) => (
                  <li key={sub.id}>
                    <Link
                      href={`/projects/${sub.identifier}/overview`}
                      className="sidebar-link"
                    >
                      <span className="sidebar-link__icon" aria-hidden="true">↳</span>
                      <span style={{ flex: 1 }}>{sub.name}</span>
                      <Badge tone={projectStatusTone(sub.status)}>
                        {projectStatusLabel(sub.status)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Surface>
          ) : null}
        </div>
      </div>
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
