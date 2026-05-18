"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AIBreakdownIcon,
  AIDiagnosisIcon,
  BoardsIcon,
  GanttIcon,
  MembersIcon,
  OverviewIcon,
  SettingsIcon,
  WorkPackagesIcon
} from "./sidebar-icons";
import type { ReactNode } from "react";
import type { PlatformRole, Project, ProjectModule, User } from "@/lib/types";
import { getUserRoles } from "@/lib/rbac";
import { projectStatusLabel, projectStatusTone } from "@/lib/work-package-presentation";
import { Badge } from "@/components/primer/Badge";

interface ProjectSidebarProps {
  project: Project;
  currentUser?: User;
}

interface ModuleNavItem {
  module: ProjectModule;
  href: (identifier: string) => string;
  label: string;
  icon: ReactNode;
  matches?: (pathname: string, identifier: string) => boolean;
  visibleFor?: PlatformRole[];
}

const moduleItems: ModuleNavItem[] = [
  {
    module: "overview",
    href: (id) => `/projects/${id}/overview`,
    label: "概览",
    icon: <OverviewIcon />,
    visibleFor: ["admin", "projectManager"]
  },
  {
    module: "work_packages",
    href: (id) => `/projects/${id}/work-packages`,
    label: "工作项",
    icon: <WorkPackagesIcon />,
    matches: (pathname, id) => pathname.startsWith(`/projects/${id}/work-packages`)
  },
  {
    module: "boards",
    href: (id) => `/projects/${id}/boards`,
    label: "看板",
    icon: <BoardsIcon />,
    visibleFor: ["admin", "projectManager", "teamLead"]
  },
  {
    module: "gantt",
    href: (id) => `/projects/${id}/gantt`,
    label: "甘特图",
    icon: <GanttIcon />,
    visibleFor: ["admin"]
  },
  {
    module: "members",
    href: (id) => `/projects/${id}/members`,
    label: "成员",
    icon: <MembersIcon />,
    visibleFor: ["admin", "projectManager", "teamLead"]
  },
  {
    module: "ai_diagnosis",
    href: (id) => `/projects/${id}/ai-diagnosis`,
    label: "AI 诊断",
    icon: <AIDiagnosisIcon />,
    visibleFor: ["admin"]
  },
  {
    module: "ai_breakdown",
    href: (id) => `/projects/${id}/ai-breakdown`,
    label: "AI 拆解",
    icon: <AIBreakdownIcon />,
    visibleFor: ["admin"]
  },
  {
    module: "settings",
    href: (id) => `/projects/${id}/settings`,
    label: "项目设置",
    icon: <SettingsIcon />,
    visibleFor: ["admin", "projectManager"]
  }
];

/**
 * Project-context sidebar. Items are filtered by `project.enabledModules`
 * to mirror OpenProject's per-project module toggles, and further filtered
 * by the current user's role.
 */
export function ProjectSidebar({ project, currentUser }: ProjectSidebarProps) {
  const pathname = usePathname();
  const enabled = new Set(project.enabledModules);
  const currentRoles = getUserRoles(currentUser);

  return (
    <aside className="app-sidebar" aria-label={`${project.name} 模块导航`}>
      <div className="sidebar-project-card">
        <span className="sidebar-project-card__label">项目</span>
        <h2 className="sidebar-project-card__name">{project.name}</h2>
        <Badge tone={projectStatusTone(project.status)}>
          {projectStatusLabel(project.status)}
        </Badge>
      </div>
      <hr className="divider" />
      <div className="sidebar-section">
        <p className="sidebar-section-title">模块</p>
        <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {moduleItems.map((item) => {
            if (!enabled.has(item.module)) {
              return null;
            }
            // Role-based visibility filter
            if (item.visibleFor && currentUser) {
              if (!item.visibleFor.some((role) => currentRoles.includes(role))) {
                return null;
              }
            }
            if (item.visibleFor && !currentUser) {
              return null;
            }
            const href = item.href(project.identifier);
            const isActive = item.matches
              ? item.matches(pathname, project.identifier)
              : pathname === href;
            return (
              <Link key={item.module} href={href} className="sidebar-link" data-active={isActive}>
                <span className="sidebar-link__icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}