import Link from "next/link";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { UserMenu } from "./UserMenu";
import { canUser } from "@/lib/rbac";
import type { Project, User } from "@/lib/types";

interface AppHeaderProps {
  projects: Project[];
  currentProjectIdentifier?: string;
  currentUser?: User;
}

/**
 * Application top bar. Composition mirrors OpenProject 16.x: brand + project
 * switcher on the left, command/notification/profile cluster on the right.
 */
export function AppHeader({ projects, currentProjectIdentifier, currentUser }: AppHeaderProps) {
  const createHref = resolveCreateHref(currentProjectIdentifier, currentUser);

  return (
    <header className="app-header">
      <Link href="/" className="app-header__brand" aria-label="返回工作台首页">
        <span className="app-header__brand-mark" aria-hidden="true">
          PM
        </span>
        <span>Project Hub</span>
      </Link>
      <span className="app-header__divider" aria-hidden="true" />
      <ProjectSwitcher
        projects={projects}
        currentProjectIdentifier={currentProjectIdentifier}
        currentUser={currentUser}
      />

      <div className="app-header__spacer" />

      <button type="button" className="app-header__search" aria-label="全局搜索">
        <SearchIcon />
        <span style={{ flex: 1, textAlign: "left" }}>搜索工作项、项目、人员</span>
        <span className="kbd">⌘K</span>
      </button>

      <div className="app-header__actions">
        {createHref ? (
          <Link
            href={createHref}
            className="btn"
            data-variant="ghost"
            data-size="sm"
            data-icon-only="true"
            aria-label="新建工作项"
            title="新建工作项"
          >
            <PlusIcon />
          </Link>
        ) : null}
        <Link
          href="/notifications"
          className="btn"
          data-variant="ghost"
          data-size="sm"
          data-icon-only="true"
          aria-label="通知中心"
          title="通知"
        >
          <BellIcon />
        </Link>
        <span className="app-header__divider" aria-hidden="true" style={{ marginLeft: 4, marginRight: 4 }} />
        <UserMenu currentUser={currentUser} />
      </div>
    </header>
  );
}

function resolveCreateHref(currentProjectIdentifier?: string, currentUser?: User) {
  if (!currentUser) {
    return undefined;
  }

  if (currentProjectIdentifier && canUser(currentUser, "assignWorkPackages")) {
    return `/projects/${currentProjectIdentifier}/work-packages/new`;
  }

  if (canUser(currentUser, "createPersonalWorkPackage")) {
    return "/my/work-packages/new";
  }

  return undefined;
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.25 11.25L14 14M12.5 7.5C12.5 10.2614 10.2614 12.5 7.5 12.5C4.73858 12.5 2.5 10.2614 2.5 7.5C2.5 4.73858 4.73858 2.5 7.5 2.5C10.2614 2.5 12.5 4.73858 12.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 11C3.5 10 4 9 4 7.5C4 5.29086 5.79086 3.5 8 3.5C10.2091 3.5 12 5.29086 12 7.5C12 9 12.5 10 12.5 11H3.5ZM6.5 12.5H9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
