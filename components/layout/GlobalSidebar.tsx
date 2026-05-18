"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AdminIcon,
  BoardsIcon,
  MembersIcon,
  MyWorkIcon,
  NotificationsIcon,
  OverviewIcon,
  ProjectsIcon,
  SettingsIcon,
  TeamIcon,
  WorkPackagesIcon
} from "./sidebar-icons";
import type { PlatformFeatureFlagDto } from "@/lib/services/feature-flags";
import { getUserRoles, userHasRole } from "@/lib/rbac";
import type { PlatformRole, Project, User } from "@/lib/types";
import type { ReactNode } from "react";

interface GlobalNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  flagKey?: PlatformFeatureFlagDto["key"];
  matches?: (pathname: string) => boolean;
  visibleFor?: PlatformRole[];
}

const items: GlobalNavItem[] = [
  {
    href: "/my/page",
    label: "我的工作",
    icon: <MyWorkIcon />,
    matches: (pathname) => pathname === "/my/page" || pathname.startsWith("/my/work-packages")
  },
  {
    href: "/my/projects",
    label: "我的项目",
    icon: <ProjectsIcon />,
    matches: (pathname) => pathname.startsWith("/my/projects"),
    visibleFor: ["projectManager", "teamLead", "participant"]
  },
  {
    href: "/overview",
    label: "平台总览",
    icon: <OverviewIcon />,
    flagKey: "platformOverview",
    matches: (pathname) => pathname.startsWith("/overview"),
    visibleFor: ["admin"]
  },
  {
    href: "/projects",
    label: "项目",
    icon: <ProjectsIcon />,
    matches: (pathname) => pathname === "/projects" || pathname.startsWith("/projects/new"),
    visibleFor: ["admin"]
  },
  {
    href: "/work-packages",
    label: "工作项",
    icon: <WorkPackagesIcon />,
    matches: (pathname) => pathname.startsWith("/work-packages")
  },
  {
    href: "/team",
    label: "我的团队",
    icon: <TeamIcon />,
    matches: (pathname) => pathname.startsWith("/team"),
    visibleFor: ["admin", "teamLead"]
  },
  {
    href: "/notifications",
    label: "通知中心",
    icon: <NotificationsIcon />,
    matches: (pathname) => pathname.startsWith("/notifications")
  },
  {
    href: "/admin",
    label: "管理员",
    icon: <AdminIcon />,
    matches: (pathname) => pathname.startsWith("/admin"),
    visibleFor: ["admin"]
  }
];

/**
 * Global sidebar shown outside any project context. Mirrors OpenProject's
 * "global modules" menu surfaced from the grid icon.
 */
export function GlobalSidebar({
  flags = [],
  projects = [],
  currentUser,
  contextualProject
}: {
  flags?: PlatformFeatureFlagDto[];
  projects?: Project[];
  currentUser?: User;
  contextualProject?: Project;
}) {
  const pathname = usePathname();
  const currentRoles = getUserRoles(currentUser);
  const roleItems = buildRoleItems(contextualProject ?? resolvePrimaryProject(projects, currentUser), currentUser);
  const visibleItems = [...items, ...roleItems].filter((item) => {
    if (item.flagKey && !isSidebarFlagEnabled(flags, item.flagKey, currentUser)) {
      return false;
    }
    if (item.visibleFor && currentUser) {
      return item.visibleFor.some((role) => currentRoles.includes(role));
    }
    if (item.visibleFor && !currentUser) {
      return false;
    }
    return true;
  });

  return (
    <aside className="app-sidebar" aria-label="全局模块">
      <div className="sidebar-section">
        <p className="sidebar-section-title">工作区</p>
        <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {visibleItems.map((item) => {
            const isActive = item.matches ? item.matches(pathname) : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-link"
                data-active={isActive}
              >
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

function buildRoleItems(project: Project | undefined, user?: User): GlobalNavItem[] {
  if (!project || userHasRole(user, "admin") || userHasRole(user, "participant")) {
    return [];
  }

  const projectItems: GlobalNavItem[] = [
    {
      href: `/projects/${project.identifier}/boards`,
      label: "看板",
      icon: <BoardsIcon />,
      matches: (pathname) => pathname.startsWith(`/projects/${project.identifier}/boards`)
    },
    {
      href: `/projects/${project.identifier}/members`,
      label: "成员",
      icon: <MembersIcon />,
      matches: (pathname) => pathname.startsWith(`/projects/${project.identifier}/members`)
    }
  ];

  if (userHasRole(user, "projectManager")) {
    projectItems.push({
      href: `/projects/${project.identifier}/settings`,
      label: "项目设置",
      icon: <SettingsIcon />,
      matches: (pathname) => pathname.startsWith(`/projects/${project.identifier}/settings`)
    });
  }

  return projectItems;
}

function resolvePrimaryProject(projects: Project[], user?: User): Project | undefined {
  if (!user) {
    return undefined;
  }
  if (userHasRole(user, "projectManager")) {
    return projects.find((project) => user.managedProjectIds.includes(project.id));
  }
  if (userHasRole(user, "teamLead")) {
    return projects.find((project) => user.participatingProjectIds.includes(project.id));
  }
  return undefined;
}

function isSidebarFlagEnabled(
  flags: PlatformFeatureFlagDto[],
  key: PlatformFeatureFlagDto["key"],
  user?: User
) {
  const flag = flags.find((item) => item.key === key);
  if (!flag?.siteEnabled) {
    return false;
  }

  const roles = getUserRoles(user);
  return user ? roles.some((role) => flag.roleOverrides[role] ?? true) : true;
}