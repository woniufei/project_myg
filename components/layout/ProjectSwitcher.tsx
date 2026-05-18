"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, User } from "@/lib/types";
import { filterProjectsForRole, userHasRole } from "@/lib/rbac";

interface ProjectSwitcherProps {
  projects: Project[];
  currentProjectIdentifier?: string;
  currentUser?: User;
}

interface ProjectNode {
  project: Project;
  depth: number;
}

/**
 * Top-bar project selector with parent/child indentation. Mirrors
 * OpenProject 16.x's project picker behavior. Closes on outside click.
 */
export function ProjectSwitcher({ projects, currentProjectIdentifier, currentUser }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const visibleProjects = useMemo(() => filterProjectsForRole(projects, currentUser), [projects, currentUser]);
  const orderedProjects = useMemo(() => buildHierarchy(visibleProjects), [visibleProjects]);
  const current = visibleProjects.find((project) => project.identifier === currentProjectIdentifier);
  const label = current?.name ?? "选择项目";
  const showAllProjects = userHasRole(currentUser, "admin");

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn"
        data-variant="ghost"
        data-size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          gap: 6,
          maxWidth: 220,
          paddingLeft: 8,
          paddingRight: 6
        }}
      >
        <FolderIcon />
        <span
          style={{
            fontWeight: 600,
            color: "var(--fg-default)",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {label}
        </span>
        <ChevronIcon />
      </button>
      {open ? (
        <div
          role="menu"
          className="fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 280,
            maxHeight: 360,
            overflowY: "auto",
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-medium)",
            boxShadow: "var(--shadow-large)",
            padding: 6,
            zIndex: 40
          }}
        >
          {showAllProjects ? (
            <>
              <Link
                role="menuitem"
                href="/projects"
                className="sidebar-link"
                data-active={!current}
                onClick={() => setOpen(false)}
              >
                <span className="sidebar-link__icon" aria-hidden="true">
                  <GridIcon />
                </span>
                <span>所有项目</span>
              </Link>
              <div className="divider" />
            </>
          ) : null}
          {orderedProjects.map(({ project, depth }) => (
            <Link
              key={project.id}
              role="menuitem"
              className="sidebar-link"
              href={projectLandingHref(project, currentUser)}
              data-active={project.identifier === currentProjectIdentifier}
              onClick={() => setOpen(false)}
              style={{ paddingLeft: 12 + depth * 14 }}
            >
              <span className="sidebar-link__icon" aria-hidden="true">
                <FolderIcon />
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {project.name}
              </span>
              <span className="hint mono" style={{ fontSize: 10 }}>
                {project.identifier}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function projectLandingHref(project: Project, user?: User) {
  if (userHasRole(user, "admin") || userHasRole(user, "projectManager")) {
    return `/projects/${project.identifier}/overview`;
  }
  return `/projects/${project.identifier}/work-packages`;
}

function buildHierarchy(projects: Project[]): ProjectNode[] {
  const childrenByParent = new Map<string | undefined, Project[]>();
  const projectIds = new Set(projects.map((project) => project.id));
  for (const project of projects) {
    const parent = project.parentId && projectIds.has(project.parentId) ? project.parentId : undefined;
    const list = childrenByParent.get(parent) ?? [];
    list.push(project);
    childrenByParent.set(parent, list);
  }

  const order: ProjectNode[] = [];
  /**
   * 防止错误数据中的 parent 环导致栈溢出（开发库损坏或手工改库时）。
   */
  function walk(parentId: string | undefined, depth: number, ancestorIds: Set<string>) {
    const items = (childrenByParent.get(parentId) ?? []).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    for (const project of items) {
      if (ancestorIds.has(project.id)) {
        continue;
      }
      order.push({ project, depth });
      const next = new Set(ancestorIds);
      next.add(project.id);
      walk(project.id, depth + 1, next);
    }
  }
  walk(undefined, 0, new Set());
  return order;
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6L7.5 4.5H12.5C13.3284 4.5 14 5.17157 14 6V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}