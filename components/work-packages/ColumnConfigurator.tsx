"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/primer/Button";

export interface ListColumn {
  id: string;
  label: string;
}

interface ColumnPreferenceState {
  order: string[];
  visibleIds: string[];
}

/**
 * Persists table column visibility and order in the current browser.
 */
export function useColumnPreferences<T extends ListColumn>(storageKey: string, columns: T[]) {
  const columnIds = columns.map((column) => column.id).join("|");
  const defaultState = useMemo<ColumnPreferenceState>(
    () => ({
      order: columns.map((column) => column.id),
      visibleIds: columns.map((column) => column.id)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnIds]
  );
  const [state, setState] = useState<ColumnPreferenceState>(() =>
    readStoredColumnState(storageKey, defaultState)
  );
  const normalizedState = useMemo(
    () => normalizeState(state, defaultState),
    [defaultState, state]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedState));
  }, [normalizedState, storageKey]);

  const orderedColumns = useMemo(() => {
    const lookup = new Map(columns.map((column) => [column.id, column]));
    return normalizedState.order
      .map((id) => lookup.get(id))
      .filter((column): column is T => Boolean(column));
  }, [columns, normalizedState.order]);

  const visibleColumns = orderedColumns.filter((column) => normalizedState.visibleIds.includes(column.id));

  function toggleColumn(id: string) {
    setState((current) => {
      const visibleIds = current.visibleIds.includes(id)
        ? current.visibleIds.filter((item) => item !== id)
        : [...current.visibleIds, id];
      return {
        ...current,
        visibleIds: visibleIds.length > 0 ? visibleIds : [id]
      };
    });
  }

  function moveColumn(dragId: string, targetId: string) {
    if (dragId === targetId) {
      return;
    }
    setState((current) => {
      const next = current.order.filter((id) => id !== dragId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, dragId);
      return { ...current, order: next };
    });
  }

  return {
    orderedColumns,
    visibleColumns,
    visibleIds: normalizedState.visibleIds,
    toggleColumn,
    moveColumn
  };
}

interface ColumnConfiguratorProps<T extends ListColumn> {
  columns: T[];
  visibleIds: string[];
  onToggle: (id: string) => void;
  onMove: (dragId: string, targetId: string) => void;
}

/**
 * Column picker with drag-and-drop ordering.
 */
export function ColumnConfigurator<T extends ListColumn>({
  columns,
  visibleIds,
  onToggle,
  onMove
}: ColumnConfiguratorProps<T>) {
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <Button
        size="sm"
        variant="accent"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="配置表格显示列"
      >
        <ColumnsIcon /> 配置列
      </Button>
      {open ? (
        <div
          className="surface fade-in"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: 240,
            padding: 8,
            zIndex: 30,
            boxShadow: "var(--shadow-floating)"
          }}
        >
          <p className="hint" style={{ margin: "0 0 6px", fontSize: 12 }}>
            勾选显示列，拖拽改变顺序。
          </p>
          <div style={{ display: "grid", gap: 4 }}>
            {columns.map((column) => (
              <label
                key={column.id}
                draggable
                onDragStart={() => setDragId(column.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragId) {
                    onMove(dragId, column.id);
                  }
                  setDragId(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  border: "1px solid var(--border-muted)",
                  borderRadius: 6,
                  cursor: "grab",
                  background: "var(--bg-canvas)"
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleIds.includes(column.id)}
                  onChange={() => onToggle(column.id)}
                />
                <span style={{ fontSize: 13 }}>{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColumnsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.5H13M3 8H13M3 12.5H13M5.5 3.5V12.5M10.5 3.5V12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function normalizeState(
  parsed: Partial<ColumnPreferenceState>,
  fallback: ColumnPreferenceState
): ColumnPreferenceState {
  const knownIds = new Set(fallback.order);
  const order = [
    ...(parsed.order ?? []).filter((id) => knownIds.has(id)),
    ...fallback.order.filter((id) => !(parsed.order ?? []).includes(id))
  ];
  const visibleIds = (parsed.visibleIds ?? fallback.visibleIds).filter((id) => knownIds.has(id));
  return {
    order,
    visibleIds: visibleIds.length > 0 ? visibleIds : fallback.visibleIds
  };
}

function readStoredColumnState(
  storageKey: string,
  fallback: ColumnPreferenceState
): ColumnPreferenceState {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }
    return normalizeState(JSON.parse(raw) as Partial<ColumnPreferenceState>, fallback);
  } catch {
    return fallback;
  }
}
