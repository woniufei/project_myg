import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Surface } from "@/components/primer/Surface";
import { MyTeamWorkInbox } from "@/components/team-lead/MyTeamWorkInbox";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { getTeamLeadDashboard } from "@/lib/services/team-workflow";

export const dynamic = "force-dynamic";

export default async function TeamLeadPage() {
  const { snapshot, currentUser } = await getShellRequestContext();

  // 非团队负责人无权限访问
  if (!currentUser || currentUser.role !== "teamLead") {
    redirect("/");
  }

  // 获取团队工作台数据
  const dashboard = await getTeamLeadDashboard(currentUser);

  // 无团队时显示空状态提示
  if (!dashboard.team) {
    return (
      <>
        <Breadcrumb items={[{ label: "我的团队" }]} />

        <header className="page-header">
          <div className="page-header__meta">
            <h1 className="page-title">我的团队</h1>
            <p className="page-subtitle">团队负责人工作台。</p>
          </div>
        </header>

        <Surface title="暂无团队信息" description="您尚未被分配到任何团队，请等待管理员为您配置。">
          <p className="hint" style={{ margin: 0, padding: 16, textAlign: "center" }}>
            如果您是团队负责人，请联系管理员将您添加到团队并设置为团队负责人。
          </p>
        </Surface>
      </>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "我的团队" }]} />

      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">{dashboard.team.name}</h1>
          <p className="page-subtitle">
            {dashboard.team.description ?? "团队负责人工作台"}
          </p>
        </div>
      </header>

      <MyTeamWorkInbox
        pendingVerification={dashboard.pendingVerification}
        rejectedWorkPackages={dashboard.rejectedWorkPackages}
        teamMemberWorkPackages={dashboard.teamMemberWorkPackages}
        currentUser={currentUser}
        projects={snapshot.projects}
      />
    </>
  );
}