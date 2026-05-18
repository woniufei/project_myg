"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeDetailDrawer } from "./NodeDetailDrawer";
import { ScenarioApplyDialog } from "./ScenarioApplyDialog";
import { TimelineCanvas, type LinkMode } from "./TimelineCanvas";
import {
  DAY_MS,
  difficultyLabel,
  formatDateLabel,
  buildTimelineWindow,
  type TimelineExpansion,
  type ZoomLevel
} from "./timeline";
import { useScreenPlan } from "./useScreenPlan";
import { useScreenScale } from "./useScreenScale";
import type {
  PlanChangeInput,
  PlanDifficulty,
  PlanModel,
  PlanNode,
  PlanPhase,
  PlanTask,
  PlanRiskLevel,
  ScreenPlanResponse
} from "@/lib/services/big-screen-plan";

type ScreenMode = "planning" | "presentation";

interface AuditChange {
  id: string;
  scenarioId: string;
  changeType: string;
  targetRef: string;
  payload: unknown;
  createdAt: string;
}

interface BigScreenLayoutProps {
  projectId: string;
  initial: ScreenPlanResponse;
  token?: string;
}

type RequirementStatusKind = "idle" | "loading" | "success" | "error";

interface RequirementStatus {
  kind: RequirementStatusKind;
  message: string;
}

interface AgentBreakdownPayload {
  phases: Array<Omit<PlanPhase, "workPackageId" | "ownerPersonId" | "ownerLabel" | "riskCount" | "taskCount"> & {
    id: string;
    riskCount?: number;
    taskCount?: number;
    ownerLabel?: string;
  }>;
  nodes: Array<Omit<PlanNode, "shape" | "isOnCriticalPath" | "tasks" | "workPackageId"> & {
    id: string;
    shape?: PlanNode["shape"];
    isOnCriticalPath?: boolean;
    tasks?: PlanNode["tasks"];
  }>;
  summary?: string;
}

/**
 * Top-level big-screen shell. Hosts the data hook, header, planning canvas,
 * inspector and AI document import dialog.
 */
export function BigScreenLayout({ projectId, initial, token }: BigScreenLayoutProps) {
  const scale = useScreenScale();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    plan,
    baseline,
    scenarios,
    activeScenario,
    source,
    setLocalPlan,
    refreshing,
    commitDraft,
    applyActive,
    saving
  } = useScreenPlan({
    projectId,
    token,
    initial
  });

  const pendingChangesRef = useRef<PlanChangeInput[]>([]);
  const trackChange = useCallback((change: PlanChangeInput) => {
    pendingChangesRef.current.push(change);
  }, []);

  /**
   * Wraps every plan mutation so task item changes immediately roll up to
   * node, phase and project metrics before the next API save.
   */
  const setPlan = useCallback(
    (next: PlanModel) => setLocalPlan(recomputeDerivedPlanFields(next)),
    [setLocalPlan]
  );

  const [expansion, setExpansion] = useState<TimelineExpansion>({ startOffsetDays: 0, endOffsetDays: 0 });
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [mode, setMode] = useState<ScreenMode>("planning");
  const [selectedId, setSelectedId] = useState<string | undefined>(plan.nodes[0]?.id);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | undefined>(plan.phases[0]?.id);
  const [drawerNodeId, setDrawerNodeId] = useState<string | undefined>();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>("none");
  const [pendingLinkFromId, setPendingLinkFromId] = useState<string | undefined>();
  const [selectedDependencyKey, setSelectedDependencyKey] = useState<string | undefined>();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState("");
  const [requirementStatus, setRequirementStatus] = useState<RequirementStatus>({ kind: "idle", message: "" });
  const [auditChanges, setAuditChanges] = useState<AuditChange[]>([]);
  const [pendingDirty, setPendingDirty] = useState(false);

  const timeline = useMemo(() => buildTimelineWindow(plan, expansion, zoom), [plan, expansion, zoom]);
  const selectedNode = plan.nodes.find((node) => node.id === selectedId);
  const drawerNode = plan.nodes.find((node) => node.id === drawerNodeId);
  const projectDifficulty = plan.projectDifficulty;
  const visibleAuditChanges = activeScenario ? auditChanges : [];

  // Whenever the timeline grows on the left, push scrollLeft right by the same
  // pixel delta so that the visible content stays anchored to the same date.
  const previousStartRef = useRef<number>(timeline.start.getTime());
  useEffect(() => {
    const previous = previousStartRef.current;
    const next = timeline.start.getTime();
    if (next < previous && scrollRef.current) {
      const deltaDays = (previous - next) / DAY_MS;
      const deltaPx = deltaDays * (timeline.canvasWidth / Math.max(timeline.totalDays, 1));
      scrollRef.current.scrollLeft += deltaPx;
    }
    previousStartRef.current = next;
  }, [timeline.canvasWidth, timeline.start, timeline.totalDays]);

  // Maintain the centred date when zoom level changes so the user's focus
  // doesn't get teleported to the start of the canvas.
  const pendingZoomCenterRef = useRef<string | null>(null);
  useEffect(() => {
    const center = pendingZoomCenterRef.current;
    if (!center || !scrollRef.current) return;
    const newPixel = timeline.dateToPixel(center);
    scrollRef.current.scrollLeft = Math.max(0, newPixel - scrollRef.current.clientWidth / 2);
    pendingZoomCenterRef.current = null;
  }, [zoom, timeline]);

  // Initial mount: centre the view on today so users can immediately see
  // the active work without first scrolling past blank padding months.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (didInitialScrollRef.current || !scrollRef.current) return;
    const scroll = scrollRef.current;
    const todayPixel = timeline.dateToPixel(plan.today);
    const id = window.requestAnimationFrame(() => {
      if (!scroll) return;
      scroll.scrollLeft = Math.max(0, todayPixel - scroll.clientWidth / 2);
      didInitialScrollRef.current = true;
    });
    return () => window.cancelAnimationFrame(id);
  }, [plan.today, timeline]);

  const changeZoom = useCallback(
    (next: ZoomLevel) => {
      if (next === zoom) return;
      if (scrollRef.current) {
        const centerPixel = scrollRef.current.scrollLeft + scrollRef.current.clientWidth / 2;
        pendingZoomCenterRef.current = timeline.pixelToDate(centerPixel);
      }
      setZoom(next);
    },
    [timeline, zoom]
  );

  // Keyboard fine-tune for the selected node: ←/→ ±1 day, ↑/↓ swap phase.
  useEffect(() => {
    if (!selectedId) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setPlan(shiftNodeDays(plan, selectedId as string, direction));
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        setPlan(moveNodeBetweenPhases(plan, selectedId as string, direction));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plan, selectedId, setPlan]);

  const extendTimeline = useCallback((direction: "left" | "right", days: number) => {
    setExpansion((current) =>
      direction === "left"
        ? { ...current, startOffsetDays: current.startOffsetDays + days }
        : { ...current, endOffsetDays: current.endOffsetDays + days }
    );
  }, []);

  const handleCommitDrag = useCallback(
    (nodeId: string, dropDate: string, dropPhaseId: string) => {
      const previous = plan.nodes.find((node) => node.id === nodeId);
      setPlan(commitDraggedNode(plan, nodeId, dropDate, dropPhaseId));
      setPendingDirty(true);
      trackChange({
        type: "node.move",
        targetRef: nodeId,
        payload: {
          fromDate: previous?.date,
          toDate: dropDate,
          fromPhaseId: previous?.phaseId,
          toPhaseId: dropPhaseId
        }
      });
    },
    [plan, setPlan, trackChange]
  );

  const handleAddPhase = useCallback(() => {
    setPlan(addPhase(plan));
    trackChange({ type: "phase.add", targetRef: "new", payload: {} });
    setPendingDirty(true);
  }, [plan, setPlan, trackChange]);

  const handleAddNode = useCallback(() => {
    const targetPhaseId = selectedPhaseId ?? plan.phases[0]?.id;
    setPlan(addNode(plan, targetPhaseId));
    trackChange({
      type: "node.add",
      targetRef: "new",
      payload: { phaseId: targetPhaseId, shape: "milestone" }
    });
    setPendingDirty(true);
  }, [plan, selectedPhaseId, setPlan, trackChange]);

  const handleAddTask = useCallback(() => {
    const targetPhaseId = selectedPhaseId ?? plan.phases[0]?.id;
    setPlan(addTask(plan, targetPhaseId));
    trackChange({
      type: "node.add",
      targetRef: "new",
      payload: { phaseId: targetPhaseId, shape: "task" }
    });
    setPendingDirty(true);
  }, [plan, selectedPhaseId, setPlan, trackChange]);

  const handleResizeCommit = useCallback(
    (nodeId: string, startDate: string, endDate: string) => {
      setPlan(resizeNode(plan, nodeId, startDate, endDate));
      trackChange({
        type: "node.update",
        targetRef: nodeId,
        payload: { startDate, endDate, date: endDate }
      });
      setPendingDirty(true);
    },
    [plan, setPlan, trackChange]
  );

  const handleDeletePhase = useCallback(
    (phaseId: string) => {
      setPlan(deletePhase(plan, phaseId));
      trackChange({ type: "phase.delete", targetRef: phaseId, payload: {} });
      setPendingDirty(true);
    },
    [plan, setPlan, trackChange]
  );

  const handleRenamePhase = useCallback(
    (phaseId: string, name: string) => {
      setPlan(renamePhase(plan, phaseId, name));
      trackChange({ type: "phase.update", targetRef: phaseId, payload: { name } });
      setPendingDirty(true);
    },
    [plan, setPlan, trackChange]
  );

  const changeLinkMode = useCallback((next: LinkMode) => {
    setLinkMode((current) => (current === next ? "none" : next));
    setPendingLinkFromId(undefined);
    setSelectedDependencyKey(undefined);
  }, []);

  const handleLinkNode = useCallback(
    (nodeId: string) => {
      if (linkMode === "none") return;
      const node = plan.nodes.find((entry) => entry.id === nodeId);
      if (!node) return;
      setSelectedId(node.id);
      setSelectedPhaseId(node.phaseId);
      if (!pendingLinkFromId) {
        setPendingLinkFromId(nodeId);
        return;
      }
      if (pendingLinkFromId === nodeId) {
        setPendingLinkFromId(undefined);
        return;
      }
      const isCritical = linkMode === "critical";
      const result = updateDependencyConnection(plan, pendingLinkFromId, nodeId, isCritical);
      setPlan(result.plan);
      setSelectedDependencyKey(result.removed ? undefined : `${pendingLinkFromId}->${nodeId}`);
      trackChange({
        type: result.removed ? "dependency.delete" : "dependency.add",
        targetRef: `${pendingLinkFromId}->${nodeId}`,
        payload: { fromNodeId: pendingLinkFromId, toNodeId: nodeId, isCritical }
      });
      setPendingDirty(true);
      setPendingLinkFromId(undefined);
    },
    [linkMode, pendingLinkFromId, plan, setPlan, trackChange]
  );

  const handleDeleteSelectedDependency = useCallback(() => {
    if (!selectedDependencyKey) return;
    const result = removeDependencyConnection(plan, selectedDependencyKey);
    if (!result.removed) return;
    setPlan(result.plan);
    trackChange({
      type: "dependency.delete",
      targetRef: selectedDependencyKey,
      payload: { dependencyKey: selectedDependencyKey }
    });
    setPendingDirty(true);
    setSelectedDependencyKey(undefined);
  }, [plan, selectedDependencyKey, setPlan, trackChange]);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setPlan(deleteNode(plan, nodeId));
      trackChange({ type: "node.delete", targetRef: nodeId, payload: {} });
      setPendingDirty(true);
      setSelectedId(undefined);
    },
    [plan, setPlan, trackChange]
  );

  const handleUpdateNodeDetails = useCallback(
    (nodeId: string, updates: Parameters<typeof updateNodeDetails>[2]) => {
      setPlan(updateNodeDetails(plan, nodeId, updates));
      trackChange({ type: "node.update", targetRef: nodeId, payload: updates });
      setPendingDirty(true);
    },
    [plan, setPlan, trackChange]
  );

  const handleSaveDraft = useCallback(async () => {
    if (!pendingChangesRef.current.length) {
      setRequirementStatus({ kind: "idle", message: "暂无改动可保存。" });
      return;
    }
    try {
      const summary = await commitDraft(pendingChangesRef.current);
      pendingChangesRef.current = [];
      setPendingDirty(false);
      setRequirementStatus({ kind: "success", message: "草稿已保存。" });
      if (summary) {
        // Refreshing audit immediately after commit so the inspector shows the row.
        void fetchAudit(summary.id, setAuditChanges);
      }
    } catch (error) {
      setRequirementStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "保存草稿失败。"
      });
    }
  }, [commitDraft]);

  // Pull audit list whenever the active scenario id changes. We avoid setting
  // state inside the effect when the scenario disappears by routing through the
  // helper which tolerates a missing scenario id.
  const auditScenarioId = activeScenario?.id;
  useEffect(() => {
    if (!auditScenarioId) {
      // The audit list is already cleared by the next render path.
      return;
    }
    void fetchAudit(auditScenarioId, setAuditChanges);
  }, [auditScenarioId]);

  const requestNodeIntoView = useCallback(
    (nodeId: string) => {
      const node = plan.nodes.find((item) => item.id === nodeId);
      if (!node || !scrollRef.current) return;
      const left = timeline.dateToPixel(node.date);
      const viewport = scrollRef.current.clientWidth;
      const target = Math.max(0, left - viewport / 2);
      scrollRef.current.scrollTo({ left: target, behavior: "smooth" });
    },
    [plan.nodes, timeline]
  );

  const handleApplyConfirm = useCallback(async () => {
    const ok = await applyActive();
    if (ok) {
      setApplyDialogOpen(false);
      pendingChangesRef.current = [];
      setPendingDirty(false);
    }
  }, [applyActive]);

  const handleBreakdown = useCallback(
    async (documentText: string, mode: "document" | "natural") => {
      const trimmed = documentText.trim();
      if (!trimmed) return;
      setRequirementStatus({
        kind: "loading",
        message: mode === "natural" ? "AI 正在根据描述生成新节点..." : "AI 正在解析需求文档..."
      });
      try {
        const response = await fetch("/api/overview/screen/breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentText: trimmed,
            projectId,
            projectStartDate: plan.endDate,
            token
          })
        });
        const payload = (await response.json()) as { plan?: AgentBreakdownPayload; error?: string };
        if (!response.ok || !payload.plan) {
          throw new Error(payload.error ?? "AI 拆解失败。");
        }
        setPlan(mergeAgentPlan(plan, payload.plan));
        trackChange({
          type: "ai.merge",
          targetRef: "scenario",
          payload: {
            phasesAdded: payload.plan.phases.length,
            nodesAdded: payload.plan.nodes.length,
            mode
          }
        });
        setPendingDirty(true);
        setRequirementStatus({
          kind: "success",
          message: mode === "natural" ? "AI 已根据描述生成新阶段与节点。" : "AI 已根据文档生成阶段与节点。"
        });
        if (mode === "natural") setNaturalLanguagePrompt("");
        if (mode === "document") setImportDialogOpen(false);
      } catch (error) {
        setRequirementStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "AI 拆解失败。"
        });
      }
    },
    [plan, projectId, setPlan, token, trackChange]
  );

  return (
    <div className="big-screen-viewport" data-theme="big-screen">
      <div className="big-screen-canvas screen-fade-in" style={{ transform: `scale(${scale})` }}>
        <ScreenHeader
          plan={plan}
          projectDifficulty={projectDifficulty}
          scenarioCount={scenarios.length}
        />
        <ControlRow
          zoom={zoom}
          onZoomChange={changeZoom}
          mode={mode}
          onModeChange={setMode}
          source={source}
          activeScenarioName={activeScenario?.name}
          refreshing={refreshing}
          saving={saving}
          dirty={pendingDirty}
          canSave={mode === "planning"}
          canApply={mode === "planning" && !!activeScenario}
          editing={mode === "planning"}
          linkMode={linkMode}
          pendingLinkFromId={pendingLinkFromId}
          selectedDependencyKey={selectedDependencyKey}
          onLinkModeChange={changeLinkMode}
          onDeleteSelectedDependency={handleDeleteSelectedDependency}
          onAddPhase={handleAddPhase}
          onAddNode={handleAddNode}
          onAddTask={handleAddTask}
          onOpenImport={() => {
            setRequirementStatus({ kind: "idle", message: "" });
            setImportDialogOpen(true);
          }}
          onSaveDraft={handleSaveDraft}
          onOpenApply={() => setApplyDialogOpen(true)}
        />
        <div className="screen-workspace" data-dragging={draggingId !== null} data-mode={mode}>
          <main className="screen-timeline">
            <TimelineCanvas
              plan={plan}
              timeline={timeline}
              scrollRef={scrollRef}
              scale={scale}
              selectedId={selectedId}
              selectedPhaseId={selectedPhaseId}
              draggingId={draggingId}
              linkMode={linkMode}
              pendingLinkFromId={pendingLinkFromId}
              selectedDependencyKey={selectedDependencyKey}
              editing={mode === "planning"}
              baselinePlan={source === "scenario" ? baseline : null}
              onSelect={(id) => {
                const node = plan.nodes.find((entry) => entry.id === id);
                setSelectedId(id);
                if (node) setSelectedPhaseId(node.phaseId);
                requestNodeIntoView(id);
              }}
              onSelectPhase={setSelectedPhaseId}
              onOpenDetail={setDrawerNodeId}
              onDeletePhase={handleDeletePhase}
              onRenamePhase={handleRenamePhase}
              onLinkNode={handleLinkNode}
              onSelectDependency={(dependencyKey) => {
                setSelectedDependencyKey((current) => current === dependencyKey ? undefined : dependencyKey);
                setPendingLinkFromId(undefined);
              }}
              onClearSelection={() => {
                setSelectedId(undefined);
                setSelectedPhaseId(undefined);
                setPendingLinkFromId(undefined);
                setSelectedDependencyKey(undefined);
              }}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              onCommitDrag={handleCommitDrag}
              onResizeCommit={handleResizeCommit}
              onExtendTimeline={extendTimeline}
            />
          </main>
          <PlanInspector
            plan={plan}
            selectedNode={selectedNode}
            selectedPhase={plan.phases.find((entry) => entry.id === selectedPhaseId)}
            projectDifficulty={projectDifficulty}
            mode={mode}
            naturalLanguagePrompt={naturalLanguagePrompt}
            onNaturalLanguagePromptChange={setNaturalLanguagePrompt}
            onGenerateFromPrompt={() => handleBreakdown(naturalLanguagePrompt, "natural")}
            requirementStatus={requirementStatus}
            onOpenDetail={setDrawerNodeId}
            onDeleteNode={handleDeleteNode}
            auditChanges={visibleAuditChanges}
            scenarioName={activeScenario?.name}
          />
        </div>
      </div>
      {drawerNode ? (
        <NodeDetailDrawer
          key={drawerNode.id}
          node={drawerNode}
          phaseName={plan.phases.find((phase) => phase.id === drawerNode.phaseId)?.name ?? "—"}
          editing={mode === "planning"}
          onClose={() => setDrawerNodeId(undefined)}
          onSubmit={(updates) => handleUpdateNodeDetails(drawerNode.id, updates)}
        />
      ) : null}
      {applyDialogOpen && activeScenario ? (
        <ScenarioApplyDialog
          scenarioName={activeScenario.name}
          baseline={baseline}
          draft={plan}
          applying={saving}
          onClose={() => setApplyDialogOpen(false)}
          onConfirm={handleApplyConfirm}
        />
      ) : null}
      {importDialogOpen ? (
        <ImportDocumentDialog
          status={requirementStatus}
          onClose={() => setImportDialogOpen(false)}
          onSubmit={(text) => handleBreakdown(text, "document")}
        />
      ) : null}
    </div>
  );
}

function ScreenHeader({
  plan,
  projectDifficulty,
  scenarioCount
}: {
  plan: PlanModel;
  projectDifficulty: PlanDifficulty;
  scenarioCount: number;
}) {
  return (
    <header className="screen-banner-gradient">
      <div className="screen-banner-brand">
        <p className="screen-code">{plan.projectCode}</p>
        <h1>
          {plan.projectName}
          <span className={`screen-difficulty-pill ${projectDifficulty}`}>{difficultyLabel(projectDifficulty)}</span>
        </h1>
      </div>
      <div className="screen-banner-right">
        <div className="screen-banner-meta">
          <strong>{plan.statusBadge}</strong>
          <span>
            {formatDateLabel(plan.startDate)} - {formatDateLabel(plan.endDate)}
          </span>
          <span>阶段 {plan.phases.length} · 节点 {plan.nodes.length}</span>
          <span>草稿 {scenarioCount} 个</span>
        </div>
        <LegendBar />
      </div>
    </header>
  );
}

function ControlRow({
  zoom,
  onZoomChange,
  mode,
  onModeChange,
  source,
  activeScenarioName,
  refreshing,
  saving,
  dirty,
  canSave,
  canApply,
  editing,
  linkMode,
  pendingLinkFromId,
  selectedDependencyKey,
  onLinkModeChange,
  onDeleteSelectedDependency,
  onAddPhase,
  onAddNode,
  onAddTask,
  onOpenImport,
  onSaveDraft,
  onOpenApply
}: {
  zoom: ZoomLevel;
  onZoomChange: (next: ZoomLevel) => void;
  mode: ScreenMode;
  onModeChange: (next: ScreenMode) => void;
  source: "scenario" | "baseline";
  activeScenarioName?: string;
  refreshing: boolean;
  saving: boolean;
  dirty: boolean;
  canSave: boolean;
  canApply: boolean;
  editing: boolean;
  linkMode: LinkMode;
  pendingLinkFromId?: string;
  selectedDependencyKey?: string;
  onLinkModeChange: (next: LinkMode) => void;
  onDeleteSelectedDependency: () => void;
  onAddPhase: () => void;
  onAddNode: () => void;
  onAddTask: () => void;
  onOpenImport: () => void;
  onSaveDraft: () => void;
  onOpenApply: () => void;
}) {
  return (
    <div className="screen-control-row">
      <div className="screen-control-cluster">
        <a href="/overview" className="screen-control-link">返回总览</a>
        <button
          type="button"
          className="screen-control-button"
          onClick={() => document.documentElement.requestFullscreen?.()}
        >
          全屏
        </button>
        <span className="screen-source-pill" data-source={source}>
          {source === "scenario" ? `编辑：${activeScenarioName ?? "草稿"}` : "基线视图"}
        </span>
        <span className="screen-refresh-indicator" data-refreshing={refreshing}>
          {refreshing ? "同步中…" : "30s 同步"}
        </span>
        <ZoomToggle zoom={zoom} onZoomChange={onZoomChange} />
        <ModeToggle mode={mode} onModeChange={onModeChange} />
      </div>
      {editing ? (
        <div className="screen-toolbar">
          <div className="screen-link-mode-group" aria-label="节点连线模式">
            <button
              type="button"
              data-active={linkMode === "dependency"}
              onClick={() => onLinkModeChange("dependency")}
            >
              依赖连线
            </button>
            <button
              type="button"
              data-active={linkMode === "critical"}
              onClick={() => onLinkModeChange("critical")}
            >
              关键路径连线
            </button>
            {linkMode !== "none" ? (
              <span className="screen-link-mode-hint">
                {pendingLinkFromId ? "请选择目标节点" : "请选择起点节点"}
              </span>
            ) : null}
          </div>
          {selectedDependencyKey ? (
            <button type="button" className="screen-danger-inline-button" onClick={onDeleteSelectedDependency}>
              删除选中连线
            </button>
          ) : null}
          <button type="button" onClick={onAddPhase}>增加阶段</button>
          <button type="button" onClick={onAddNode}>增加关键节点</button>
          <button type="button" onClick={onAddTask}>增加任务</button>
          <button type="button" onClick={onOpenImport}>AI 导入需求</button>
          {canSave ? (
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={onSaveDraft}
              data-emphasis={dirty ? "true" : undefined}
            >
              {saving ? "保存中..." : dirty ? "保存草稿" : "已同步"}
            </button>
          ) : null}
          {canApply ? (
            <button type="button" onClick={onOpenApply} disabled={saving}>
              应用到基线
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ModeToggle({
  mode,
  onModeChange
}: {
  mode: ScreenMode;
  onModeChange: (next: ScreenMode) => void;
}) {
  return (
    <div className="screen-mode-toggle" role="radiogroup" aria-label="大屏模式">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "planning"}
        data-active={mode === "planning"}
        onClick={() => onModeChange("planning")}
      >
        编辑
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "presentation"}
        data-active={mode === "presentation"}
        onClick={() => onModeChange("presentation")}
      >
        投屏
      </button>
    </div>
  );
}

function ZoomToggle({
  zoom,
  onZoomChange
}: {
  zoom: ZoomLevel;
  onZoomChange: (next: ZoomLevel) => void;
}) {
  const options: Array<{ key: ZoomLevel; label: string }> = [
    { key: "day", label: "日" },
    { key: "week", label: "周" },
    { key: "month", label: "月" },
    { key: "quarter", label: "季" }
  ];
  return (
    <div className="screen-zoom-toggle" role="radiogroup" aria-label="时间轴密度">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={zoom === option.key}
          data-active={zoom === option.key}
          onClick={() => onZoomChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PlanInspector({
  plan,
  selectedNode,
  selectedPhase,
  projectDifficulty,
  mode,
  naturalLanguagePrompt,
  onNaturalLanguagePromptChange,
  onGenerateFromPrompt,
  requirementStatus,
  onOpenDetail,
  onDeleteNode,
  auditChanges,
  scenarioName
}: {
  plan: PlanModel;
  selectedNode?: PlanNode;
  selectedPhase?: PlanPhase;
  projectDifficulty: PlanDifficulty;
  mode: ScreenMode;
  naturalLanguagePrompt: string;
  onNaturalLanguagePromptChange: (value: string) => void;
  onGenerateFromPrompt: () => void;
  requirementStatus: RequirementStatus;
  onOpenDetail: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  auditChanges: AuditChange[];
  scenarioName?: string;
}) {
  const editing = mode === "planning";
  const generating = requirementStatus.kind === "loading";
  const milestoneCount = plan.nodes.filter((node) => node.shape === "milestone").length;
  const taskCount = plan.nodes.length - milestoneCount;

  return (
    <aside className="screen-info-panel">
      <section className={`screen-info-card ${projectDifficulty}`}>
        <h2>项目信息</h2>
        <dl>
          <div><dt>项目编码</dt><dd>{plan.projectCode}</dd></div>
          <div><dt>周期</dt><dd>{formatDateLabel(plan.startDate)} — {formatDateLabel(plan.endDate)}</dd></div>
          <div><dt>整体进度</dt><dd>{plan.progress}%</dd></div>
          <div><dt>阻塞 / Delay</dt><dd>{plan.currentBlockedCount ?? 0} / {plan.currentDelayCount ?? 0}</dd></div>
          <div><dt>最大 Delay</dt><dd>{plan.maxDelayDays ?? 0} 天</dd></div>
          <div><dt>阶段 / 节点</dt><dd>{plan.phases.length} 个 · {plan.nodes.length} 个</dd></div>
          <div><dt>任务 / 里程碑</dt><dd>{taskCount} · {milestoneCount}</dd></div>
          <div><dt>整体难度</dt><dd>{difficultyLabel(projectDifficulty)}</dd></div>
        </dl>
        {selectedPhase ? (
          <div className={`screen-info-phase ${selectedPhase.difficulty}`}>
            <strong>已选阶段：{selectedPhase.name}</strong>
            <small>{formatDateLabel(selectedPhase.startDate)} — {formatDateLabel(selectedPhase.endDate)} · {selectedPhase.progress}%</small>
            <em>阻塞 {selectedPhase.blockedNodeCount ?? 0} · Delay {selectedPhase.delayNodeCount ?? 0} · 受影响 {selectedPhase.propagatedDelayDays ?? 0} 天</em>
          </div>
        ) : null}
      </section>
      <section>
        <h2>当前节点</h2>
        {selectedNode ? (
          <>
            <div className={`screen-node-summary ${selectedNode.difficulty}`}>
              <strong>{selectedNode.label} · {selectedNode.title}</strong>
              <span>{formatDateLabel(selectedNode.date)} · {difficultyLabel(selectedNode.difficulty)}</span>
            </div>
            <ul className="screen-delivery-signal-list">
              {typeof selectedNode.estimateHours === "number" ? <li>预估 {selectedNode.estimateHours}h</li> : null}
              {selectedNode.isOnCriticalPath ? <li className="critical">关键路径</li> : null}
              {selectedNode.riskLevel ? <li className={`risk ${selectedNode.riskLevel}`}>{riskLabel(selectedNode.riskLevel)}</li> : null}
              {selectedNode.isBlocked ? <li className="blocked">存在阻塞</li> : null}
              {(selectedNode.directDelayDays ?? 0) > 0 ? <li className="delay">Delay +{selectedNode.directDelayDays}天</li> : null}
              {(selectedNode.propagatedDelayDays ?? 0) > 0 ? (
                <li className={`delay propagated${selectedNode.absorbedUpstreamDelay ? " absorbed" : ""}`}>
                  受依赖影响 +{selectedNode.propagatedDelayDays}天
                </li>
              ) : null}
              {selectedNode.absorbedUpstreamDelay ? (
                <li className="absorbed" title="本节点按原计划完成，已截断上游 Delay 传播">
                  不受依赖 Delay 影响
                </li>
              ) : null}
              {typeof selectedNode.difficultyScore === "number" ? <li>难度分 {selectedNode.difficultyScore}</li> : null}
            </ul>
            {selectedNode.tasks.length ? (
              <ul className="screen-task-list">
                {selectedNode.tasks.map((task) => (
                  <li key={task.id}>{task.title}<span>{task.ownerLabel}</span></li>
                ))}
              </ul>
            ) : (
              <p className="screen-keyboard-hint">该节点暂无任务条目</p>
            )}
            {editing ? (
              <p className="screen-keyboard-hint">键盘 ←/→ 微调日期 1 天，↑/↓ 切换阶段</p>
            ) : null}
            <p className="screen-keyboard-hint">节点进度和时间由任务项次自动计算，节点难度可在详情中配置。</p>
            <button
              type="button"
              className="screen-control-button"
              onClick={() => onOpenDetail(selectedNode.id)}
            >
              查看 / 编辑详情
            </button>
            {editing ? (
              <button type="button" className="screen-danger-button" onClick={() => onDeleteNode(selectedNode.id)}>
                删除该节点
              </button>
            ) : null}
          </>
        ) : (
          <p className="screen-keyboard-hint">请在左侧或大屏选择一个节点。</p>
        )}
      </section>
      {editing ? (
        <section>
          <h2>自然语言生成节点</h2>
          <textarea
            value={naturalLanguagePrompt}
            onChange={(event) => onNaturalLanguagePromptChange(event.target.value)}
            placeholder="例如：未来 2 周内增加大屏拖拽优化与 AI 拆解联调两个关键节点。"
          />
          <button
            type="button"
            className="screen-control-button screen-generate-button"
            disabled={generating || !naturalLanguagePrompt.trim()}
            onClick={onGenerateFromPrompt}
          >
            {generating ? "AI 生成中..." : "AI 动态生成节点"}
          </button>
          {requirementStatus.message ? (
            <p className={`screen-import-message ${requirementStatus.kind}`}>{requirementStatus.message}</p>
          ) : null}
        </section>
      ) : null}
      <section>
        <h2>变更审计{scenarioName ? ` · ${scenarioName}` : ""}</h2>
        {auditChanges.length === 0 ? (
          <p className="screen-keyboard-hint">尚未提交任何草稿变更。</p>
        ) : (
          <ul className="screen-audit-list">
            {auditChanges.slice(0, 12).map((change) => (
              <li key={change.id}>
                <span className="screen-audit-tag" data-kind={change.changeType}>{auditLabel(change.changeType)}</span>
                <small>{formatDateLabel(change.createdAt)}</small>
                <em>{change.targetRef}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function auditLabel(changeType: string): string {
  return ({
    "node.move": "节点移动",
    "node.add": "新增节点",
    "node.delete": "删除节点",
    "node.update": "更新节点",
    "node.difficulty": "调整难度",
    "phase.add": "新增阶段",
    "phase.delete": "删除阶段",
    "phase.update": "更新阶段",
    "ai.merge": "AI 合并",
    "task.upsert": "任务调整",
    "dependency.add": "新增依赖",
    "dependency.delete": "删除依赖"
  } as Record<string, string>)[changeType] ?? changeType;
}

function riskLabel(value: NonNullable<PlanNode["riskLevel"]>): string {
  if (value === "high") return "高风险";
  if (value === "medium") return "中风险";
  return "低风险";
}

function ImportDocumentDialog({
  status,
  onClose,
  onSubmit
}: {
  status: RequirementStatus;
  onClose: () => void;
  onSubmit: (documentText: string) => void;
}) {
  const [documentText, setDocumentText] = useState("");
  const [fileName, setFileName] = useState("");
  const loading = status.kind === "loading";

  return (
    <div className="screen-modal-backdrop" role="dialog" aria-modal>
      <div className="screen-modal">
        <header>
          <h2>AI 导入需求文档</h2>
          <button type="button" className="screen-modal-close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <p className="screen-modal-hint">
          支持上传 .txt / .md 文档或直接粘贴需求内容，AI Agent 会按功能域、依赖、风险拆分阶段、关键节点和任务项次。
        </p>
        <label className="screen-modal-file">
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            disabled={loading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setDocumentText(text);
              setFileName(file.name);
            }}
          />
          <span>{fileName || "选择文档..."}</span>
        </label>
        <textarea
          value={documentText}
          onChange={(event) => setDocumentText(event.target.value)}
          placeholder="或在此粘贴需求文档原文，至少包含功能描述与目标。"
          disabled={loading}
        />
        {status.message ? <p className={`screen-import-message ${status.kind}`}>{status.message}</p> : null}
        <footer>
          <button type="button" className="screen-control-button" onClick={onClose} disabled={loading}>取消</button>
          <button
            type="button"
            className="screen-control-button screen-generate-button"
            onClick={() => onSubmit(documentText)}
            disabled={loading || !documentText.trim()}
          >
            {loading ? "AI 解析中..." : "上传并拆解"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Compact legend rendered inside the banner (under the status badge).
 * Uses small SVG/CSS glyphs so the meaning of each shape is clearer than a
 * pure text footer.
 */
function LegendBar() {
  return (
    <ul className="screen-legend-strip" aria-label="图例">
      <li>
        <span className="legend-glyph milestone" aria-hidden />
        <em>关键节点</em>
      </li>
      <li>
        <span className="legend-glyph task" aria-hidden />
        <em>任务区间</em>
      </li>
      <li>
        <span className="legend-glyph phase" aria-hidden />
        <em>阶段</em>
      </li>
      <li>
        <span className="legend-glyph today" aria-hidden />
        <em>今日</em>
      </li>
      <li>
        <span className="legend-glyph critical" aria-hidden />
        <em>高风险</em>
      </li>
      <li>
        <span className="legend-glyph dependency" aria-hidden />
        <em>依赖</em>
      </li>
    </ul>
  );
}

/* ------------------------------- mutators ------------------------------- */

async function fetchAudit(scenarioId: string, setAuditChanges: (rows: AuditChange[]) => void) {
  try {
    const response = await fetch(`/api/overview/screen/scenarios/${scenarioId}/changes`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { changes: AuditChange[] };
    setAuditChanges(payload.changes);
  } catch {
    // Audit failures are non-fatal; the panel just remains empty.
  }
}

function updateNodeDetails(
  plan: PlanModel,
  nodeId: string,
  updates: Partial<Pick<PlanNode, "title" | "label" | "ownerLabel" | "date" | "startDate" | "endDate" | "progress" | "estimateHours" | "difficulty" | "riskLevel" | "isBlocked" | "isOnCriticalPath" | "tasks">>
): PlanModel {
  return {
    ...plan,
    nodes: plan.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const next = normalizeNodeInterval({ ...node, ...updates });
      const shouldSyncTaskDates =
        next.shape === "task" &&
        (updates.startDate !== undefined || updates.endDate !== undefined || updates.date !== undefined);
      return shouldSyncTaskDates ? syncTaskItemDatesToNode(next) : next;
    })
  };
}

function updateDependencyConnection(
  plan: PlanModel,
  fromNodeId: string,
  toNodeId: string,
  isCritical: boolean
): { plan: PlanModel; removed: boolean } {
  const index = plan.dependencies.findIndex(
    (dependency) => dependency.fromNodeId === fromNodeId && dependency.toNodeId === toNodeId
  );
  let removed = false;
  const dependencies =
    index >= 0
      ? plan.dependencies.flatMap((dependency, currentIndex) => {
          if (currentIndex !== index) return [dependency];
          if (dependency.isCritical === isCritical) {
            removed = true;
            return [];
          }
          return [{ ...dependency, isCritical }];
        })
      : [...plan.dependencies, { fromNodeId, toNodeId, isCritical }];

  return {
    removed,
    plan: {
      ...plan,
      dependencies,
      nodes: recomputeCriticalPathNodes(plan.nodes, dependencies)
    }
  };
}

function removeDependencyConnection(
  plan: PlanModel,
  dependencyKey: string
): { plan: PlanModel; removed: boolean } {
  const [fromNodeId, toNodeId] = dependencyKey.split("->");
  if (!fromNodeId || !toNodeId) return { plan, removed: false };
  const dependencies = plan.dependencies.filter(
    (dependency) => !(dependency.fromNodeId === fromNodeId && dependency.toNodeId === toNodeId)
  );
  if (dependencies.length === plan.dependencies.length) return { plan, removed: false };
  return {
    removed: true,
    plan: {
      ...plan,
      dependencies,
      nodes: recomputeCriticalPathNodes(plan.nodes, dependencies)
    }
  };
}

function recomputeCriticalPathNodes(
  nodes: PlanNode[],
  dependencies: PlanModel["dependencies"]
): PlanNode[] {
  const criticalNodeIds = new Set<string>();
  for (const dependency of dependencies) {
    if (!dependency.isCritical) continue;
    criticalNodeIds.add(dependency.fromNodeId);
    criticalNodeIds.add(dependency.toNodeId);
  }
  return nodes.map((node) => ({
    ...node,
    isOnCriticalPath: criticalNodeIds.has(node.id)
  }));
}

function commitDraggedNode(plan: PlanModel, nodeId: string, date: string, phaseId: string): PlanModel {
  return {
    ...plan,
    nodes: plan.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      if (node.shape === "milestone") {
        // Milestones are single-point: just snap to the new date.
        return { ...node, date, phaseId, startDate: date, endDate: date };
      }
      // Tasks carry a duration. Translate the entire interval so the
      // user's resize-determined span survives a subsequent drag/click.
      const referenceMs = new Date(node.startDate ?? node.date).getTime();
      const oldEndMs = new Date(node.endDate ?? node.date).getTime();
      const newStartMs = new Date(date).getTime();
      const duration = Math.max(0, oldEndMs - referenceMs);
      const newEndIso = new Date(newStartMs + duration).toISOString();
      const newStartIso = new Date(newStartMs).toISOString();
      return {
        ...node,
        date: newEndIso,
        phaseId,
        startDate: newStartIso,
        endDate: newEndIso,
        tasks: node.tasks.map((task) => ({
          ...task,
          startDate: task.startDate ? shiftIsoByMs(task.startDate, newStartMs - referenceMs) : task.startDate,
          endDate: task.endDate ? shiftIsoByMs(task.endDate, newStartMs - referenceMs) : task.endDate
        }))
      };
    })
  };
}

function shiftNodeDays(plan: PlanModel, nodeId: string, days: number): PlanModel {
  return {
    ...plan,
    nodes: plan.nodes.map((node) =>
      node.id === nodeId
        ? shiftNodeAndTaskItems(node, days)
        : node
    )
  };
}

function moveNodeBetweenPhases(plan: PlanModel, nodeId: string, direction: number): PlanModel {
  const node = plan.nodes.find((item) => item.id === nodeId);
  if (!node) return plan;
  const currentIndex = plan.phases.findIndex((phase) => phase.id === node.phaseId);
  const nextIndex = clamp(currentIndex + direction, 0, plan.phases.length - 1);
  if (nextIndex === currentIndex) return plan;
  return {
    ...plan,
    nodes: plan.nodes.map((item) =>
      item.id === nodeId ? { ...item, phaseId: plan.phases[nextIndex].id } : item
    )
  };
}

function addPhase(plan: PlanModel): PlanModel {
  const lastPhase = plan.phases.at(-1);
  const startDate = lastPhase ? addDays(lastPhase.endDate, 1) : new Date().toISOString();
  const endDate = addDays(startDate, 21);
  const id = `phase-${Date.now()}`;
  return {
    ...plan,
    phases: [
      ...plan.phases,
      {
        id,
        name: `新增阶段 ${plan.phases.length + 1}`,
        startDate,
        endDate,
        progress: 0,
        difficulty: "low",
        summary: "待拆解计划",
        riskCount: 0,
        taskCount: 0
      }
    ],
    nodes: [
      ...plan.nodes,
      {
        id: `node-${Date.now()}`,
        phaseId: id,
        shape: "milestone",
        label: `M${countMilestones(plan) + 1}`,
        title: "新增关键节点",
        date: endDate,
        difficulty: "low",
        progress: 0,
        tasks: [],
        isOnCriticalPath: false
      }
    ],
    endDate: maxIso(plan.endDate, endDate) ?? endDate
  };
}

function addNode(plan: PlanModel, phaseId?: string): PlanModel {
  const phase =
    (phaseId ? plan.phases.find((entry) => entry.id === phaseId) : undefined) ?? plan.phases[0];
  if (!phase) return plan;
  return {
    ...plan,
    nodes: [
      ...plan.nodes,
      {
        id: `node-${Date.now()}`,
        phaseId: phase.id,
        shape: "milestone",
        label: `M${countMilestones(plan) + 1}`,
        title: "新增关键节点",
        date: phase.endDate,
        difficulty: "low",
        progress: 0,
        tasks: [],
        isOnCriticalPath: false
      }
    ]
  };
}

/**
 * Adds a task-shaped node (rectangle + start/end interval) inside the
 * provided phase. Defaults to a 7-day window starting today so the bar is
 * visible immediately on the canvas.
 */
function addTask(plan: PlanModel, phaseId?: string): PlanModel {
  const phase =
    (phaseId ? plan.phases.find((entry) => entry.id === phaseId) : undefined) ?? plan.phases[0];
  if (!phase) return plan;
  const startDate = plan.today;
  const endDate = addDays(startDate, 7);
  return {
    ...plan,
    nodes: [
      ...plan.nodes,
      {
        id: `node-${Date.now()}`,
        phaseId: phase.id,
        shape: "task",
        label: `T${countTasks(plan) + 1}`,
        title: "新增任务",
        date: endDate,
        startDate,
        endDate,
        difficulty: "low",
        progress: 0,
        tasks: [],
        isOnCriticalPath: false
      }
    ]
  };
}

function countMilestones(plan: PlanModel): number {
  return plan.nodes.filter((node) => node.shape === "milestone").length;
}

function countTasks(plan: PlanModel): number {
  return plan.nodes.filter((node) => node.shape === "task").length;
}

/**
 * Mirrors the server-side derived metric rules for optimistic UI updates.
 * Task items drive node progress/date spans; node difficulty stays editable;
 * phase and project difficulties are weighted by child difficulty ratios.
 */
function recomputeDerivedPlanFields(plan: PlanModel): PlanModel {
  const today = new Date(plan.today);
  const nodes = plan.nodes.map((node) => {
    const hasDependencyEdge = hasDependency(plan.dependencies, node.id);
    const tasks = node.tasks.map((task) => {
      const taskProgress = clampProgress(task.progress);
      const systemBlocked = hasDependencyEdge && taskProgress < 100 && isPastDueDate(task.endDate, today);
      return {
        ...task,
        progress: taskProgress,
        difficulty: task.difficulty ?? node.difficulty,
        status: inferTaskStatus(taskProgress),
        isBlocked: Boolean(task.isBlocked || systemBlocked),
        delayDays: calculateTaskDelayDays({ ...task, progress: taskProgress }, today)
      };
    });
    const taskProgressValues = tasks.map((task) => task.progress);
    const startDate = node.shape === "task"
      ? minIso(...tasks.map((task) => task.startDate).filter(Boolean) as string[]) ??
        node.startDate ??
        node.date
      : node.date;
    const endDate = node.shape === "task"
      ? maxIso(...tasks.map((task) => task.endDate ?? task.startDate).filter(Boolean) as string[]) ??
        node.endDate ??
        node.date
      : node.date;
    const nextDate = node.shape === "milestone" ? node.date : endDate;
    const progress = taskProgressValues.length
      ? Math.round(taskProgressValues.reduce((sum, value) => sum + value, 0) / taskProgressValues.length)
      : clampProgress(node.progress);
    const riskLevel = node.riskLevel ?? highestRiskLevel(tasks.map((task) => task.riskLevel));
    const systemBlocked = hasDependencyEdge && progress < 100 && isPastDueDate(endDate, today);
    const isBlocked = Boolean(node.isBlocked || tasks.some((task) => task.isBlocked) || systemBlocked);
    const estimateHours = node.estimateHours ?? sumEstimateHours(tasks);
    const blockedTasks = tasks.filter((task) => task.isBlocked);
    const delayedTasks = tasks.filter((task) => (task.delayDays ?? 0) > 0);
    const directDelayDays = Math.max(
      calculateNodeScheduleDelayDays({ ...node, endDate, date: nextDate, progress }, today),
      ...tasks.map((task) => task.delayDays ?? 0)
    );
    return {
      ...node,
      tasks,
      estimateHours,
      riskLevel,
      isBlocked,
      blockedReason: node.blockedReason ?? blockedTasks[0]?.blockedReason ?? (systemBlocked ? "存在依赖/关键路径且到期未完成" : undefined),
      directDelayDays,
      propagatedDelayDays: node.propagatedDelayDays ?? 0,
      delayDays: directDelayDays,
      delayReason: node.delayReason ?? delayedTasks[0]?.delayReason,
      blockedTaskCount: blockedTasks.length,
      delayTaskCount: delayedTasks.length,
      startDate,
      endDate,
      date: nextDate,
      progress,
      difficultyScore: DIFFICULTY_BASE_SCORE[node.difficulty],
      difficulty: node.difficulty
    };
  });
  const nodesWithImpact = applyPropagatedDelay(nodes, plan.dependencies, today);

  const phases = plan.phases.map((phase) => {
    const phaseNodes = nodesWithImpact.filter((node) => node.phaseId === phase.id);
    if (phaseNodes.length === 0) {
      return { ...phase, difficulty: "low" as PlanDifficulty };
    }
    const progress = Math.round(phaseNodes.reduce((sum, node) => sum + node.progress, 0) / phaseNodes.length);
    const startDate = minIso(...phaseNodes.map((node) => node.startDate ?? node.date)) ?? phase.startDate;
    const endDate = maxIso(...phaseNodes.map((node) => node.endDate ?? node.date)) ?? phase.endDate;
    const score = calculateCompositeDifficulty(
      phaseNodes.map((node) => ({
        difficulty: node.difficulty,
        effortHours: nodeEffortHours(node),
        isCritical: node.isOnCriticalPath,
        riskSeverity: riskSeverity(node.riskLevel),
        isBlocked: node.isBlocked
      })),
      phase.difficulty
    );
    return {
      ...phase,
      difficulty: score.difficulty,
      difficultyScore: score.score,
      effortHours: score.effortHours,
      criticalPathRatio: score.criticalPathRatio,
      riskRatio: score.riskRatio,
      blockedRatio: score.blockedRatio,
      blockedNodeCount: phaseNodes.filter((node) => node.isBlocked).length,
      delayNodeCount: phaseNodes.filter((node) => (node.delayDays ?? 0) > 0).length,
      propagatedDelayDays: Math.max(0, ...phaseNodes.map((node) => node.propagatedDelayDays ?? 0)),
      maxDelayDays: Math.max(0, ...phaseNodes.map((node) => node.delayDays ?? 0)),
      progress,
      startDate,
      endDate,
      taskCount: phaseNodes.length
    };
  });
  const projectScore = calculateCompositeDifficulty(
    phases.map((phase) => ({
      difficulty: phase.difficulty,
      effortHours: phase.effortHours ?? 1,
      isCritical: (phase.criticalPathRatio ?? 0) > 0,
      riskSeverity: phase.riskRatio,
      isBlocked: (phase.blockedRatio ?? 0) > 0
    })),
    plan.projectDifficulty
  );
  const progress = phases.length
    ? Math.round(phases.reduce((sum, phase) => sum + phase.progress, 0) / phases.length)
    : plan.progress;
  return {
    ...plan,
    nodes: nodesWithImpact,
    phases,
    progress,
    projectDifficulty: projectScore.difficulty,
    projectDifficultyScore: projectScore.score,
    currentBlockedCount: nodesWithImpact.filter((node) => node.isBlocked).length,
    currentDelayCount: nodesWithImpact.filter((node) => (node.delayDays ?? 0) > 0).length,
    resolvedBlockedCount: nodesWithImpact.filter((node) => !node.isBlocked && node.blockedResolvedAt).length,
    maxDelayDays: Math.max(0, ...nodesWithImpact.map((node) => node.delayDays ?? 0)),
    startDate: phases.length ? minIso(...phases.map((phase) => phase.startDate)) ?? plan.startDate : plan.startDate,
    endDate: phases.length ? maxIso(...phases.map((phase) => phase.endDate)) ?? plan.endDate : plan.endDate
  };
}

interface CompositeDifficultyInput {
  difficulty: PlanDifficulty;
  effortHours?: number;
  isCritical?: boolean;
  riskSeverity?: number;
  isBlocked?: boolean;
}

interface CompositeDifficultyScore {
  difficulty: PlanDifficulty;
  score: number;
  effortHours: number;
  criticalPathRatio: number;
  riskRatio: number;
  blockedRatio: number;
}

const DIFFICULTY_BASE_SCORE: Record<PlanDifficulty, number> = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100
};

/**
 * Mirrors the server scoring formula for local optimistic updates.
 */
function calculateCompositeDifficulty(
  items: CompositeDifficultyInput[],
  fallback: PlanDifficulty = "medium"
): CompositeDifficultyScore {
  if (!items.length) {
    return {
      difficulty: fallback,
      score: DIFFICULTY_BASE_SCORE[fallback],
      effortHours: 0,
      criticalPathRatio: 0,
      riskRatio: 0,
      blockedRatio: 0
    };
  }

  const normalized = items.map((item) => ({ ...item, effortHours: Math.max(1, item.effortHours ?? 1) }));
  const totalEffort = normalized.reduce((sum, item) => sum + item.effortHours, 0);
  const baseScore = normalized.reduce(
    (sum, item) => sum + DIFFICULTY_BASE_SCORE[item.difficulty] * (item.effortHours / totalEffort),
    0
  );
  const criticalPathRatio = normalized.reduce(
    (sum, item) => sum + (item.isCritical ? item.effortHours : 0),
    0
  ) / totalEffort;
  const riskRatio = normalized.reduce(
    (sum, item) => sum + Math.max(0, Math.min(1, item.riskSeverity ?? 0)) * item.effortHours,
    0
  ) / totalEffort;
  const blockedRatio = normalized.reduce(
    (sum, item) => sum + (item.isBlocked ? item.effortHours : 0),
    0
  ) / totalEffort;
  const score = clampScore(baseScore + criticalPathRatio * 10 + riskRatio * 10 + blockedRatio * 10);

  return {
    difficulty: difficultyFromScore(score),
    score,
    effortHours: totalEffort,
    criticalPathRatio,
    riskRatio,
    blockedRatio
  };
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function inferTaskStatus(progress: number): PlanTask["status"] {
  if (progress >= 100) return "done";
  if (progress > 0) return "in_progress";
  return "todo";
}

function calculateTaskDelayDays(task: PlanTask, today: Date, propagatedDelayDays = 0): number {
  const due = task.endDate ? new Date(task.endDate) : undefined;
  const adjustedDue = due ? addNaturalDays(due, propagatedDelayDays) : undefined;
  const overdue = adjustedDue && task.progress < 100 && today > adjustedDue
    ? naturalDayDelay(adjustedDue, today)
    : 0;
  return Math.max(0, overdue);
}

/**
 * Recomputes a node's own schedule delay from its current deadline.
 */
function calculateNodeScheduleDelayDays(
  node: Pick<PlanNode, "endDate" | "date" | "progress">,
  today: Date,
  propagatedDelayDays = 0
): number {
  const end = new Date(node.endDate ?? node.date);
  if (Number.isNaN(end.getTime()) || node.progress >= 100) return 0;
  return naturalDayDelay(addNaturalDays(end, propagatedDelayDays), today);
}

/**
 * Applies dependency impact as deadline grace, then derives actual Delay after
 * that grace is exhausted.
 */
function applyPropagatedDelay(
  nodes: PlanNode[],
  dependencies: PlanModel["dependencies"],
  today: Date
): PlanNode[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const propagated = new Map<string, { days: number; sources: Set<string> }>();
  const absorbCapacityById = new Map(
    nodes.map((node) => [node.id, calculateAbsorbCapacityDays(node, today)])
  );

  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    const actualDelayById = new Map(
      nodes.map((node) => [
        node.id,
        calculateActualNodeDelayDays(node, today, propagated.get(node.id)?.days ?? 0)
      ])
    );

    for (const dependency of dependencies) {
      const source = nodeById.get(dependency.fromNodeId);
      const target = nodeById.get(dependency.toNodeId);
      if (!source || !target) continue;
      const sourcePropagated = propagated.get(source.id)?.days ?? 0;
      const sourceCapacity = absorbCapacityById.get(source.id) ?? 0;
      // Reduce upstream propagation by however many days this source can
      // genuinely absorb (only completed nodes contribute capacity).
      const reducedUpstream = Math.max(0, sourcePropagated - sourceCapacity);
      const sourceDays = Math.max(actualDelayById.get(source.id) ?? 0, reducedUpstream);
      if (sourceDays <= 0) continue;
      const current = propagated.get(target.id) ?? { days: 0, sources: new Set<string>() };
      if (sourceDays > current.days) {
        current.days = sourceDays;
        changed = true;
      }
      current.sources.add(source.id);
      const upstream = propagated.get(source.id)?.sources;
      if (upstream) {
        for (const id of upstream) current.sources.add(id);
      }
      propagated.set(target.id, current);
    }
    if (!changed) break;
  }

  return nodes.map((node) => {
    const impact = propagated.get(node.id);
    const propagatedDelayDays = impact?.days ?? 0;
    const tasks = node.tasks.map((task) => ({
      ...task,
      delayDays: calculateTaskDelayDays(task, today, propagatedDelayDays)
    }));
    const delayedTasks = tasks.filter((task) => (task.delayDays ?? 0) > 0);
    const directDelayDays = calculateActualNodeDelayDays({ ...node, tasks }, today, propagatedDelayDays);
    const absorbCapacity = absorbCapacityById.get(node.id) ?? 0;
    // Fully absorbed: this node took some upstream delay AND its absorb capacity
    // covers the full incoming amount, so downstream sees zero propagation.
    const absorbedUpstreamDelay =
      propagatedDelayDays > 0 && directDelayDays === 0 && propagatedDelayDays <= absorbCapacity;
    return {
      ...node,
      tasks,
      directDelayDays,
      propagatedDelayDays,
      delayDays: directDelayDays,
      delayReason: node.delayReason ?? delayedTasks[0]?.delayReason,
      delayTaskCount: delayedTasks.length,
      impactSourceNodeIds: impact ? Array.from(impact.sources) : [],
      absorbedUpstreamDelay
    };
  });
}

function calculateActualNodeDelayDays(node: PlanNode, today: Date, propagatedDelayDays: number): number {
  return Math.max(
    calculateNodeScheduleDelayDays(node, today, propagatedDelayDays),
    ...node.tasks.map((task) => calculateTaskDelayDays(task, today, propagatedDelayDays))
  );
}

/**
 * How many days of upstream Delay this node can genuinely absorb. Only nodes
 * that have already finished within their own original deadline contribute
 * capacity; in-flight nodes return 0 because we cannot prove they will land
 * on time yet.
 */
function calculateAbsorbCapacityDays(node: PlanNode, today: Date): number {
  if ((node.progress ?? 0) < 100) return 0;
  const due = new Date(node.endDate ?? node.date);
  if (Number.isNaN(due.getTime())) return 0;
  const reference = node.completedAt ? new Date(node.completedAt) : today;
  if (Number.isNaN(reference.getTime())) return 0;
  return naturalDayDelay(reference, due);
}

function difficultyFromScore(score: number): PlanDifficulty {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function riskSeverity(level?: PlanRiskLevel): number {
  if (level === "high") return 1;
  if (level === "medium") return 0.6;
  if (level === "low") return 0.2;
  return 0;
}

function naturalDayDelay(due: Date, today: Date): number {
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (todayDay <= dueDay) return 0;
  return Math.round((todayDay - dueDay) / DAY_MS);
}

function addNaturalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + Math.max(0, days));
  return next;
}

function isPastDueDate(value: string | undefined, today: Date): boolean {
  if (!value) return false;
  return naturalDayDelay(new Date(value), today) > 0;
}

function hasDependency(dependencies: PlanModel["dependencies"], nodeId: string): boolean {
  return dependencies.some((dependency) => dependency.fromNodeId === nodeId || dependency.toNodeId === nodeId);
}

function highestRiskLevel(values: Array<PlanRiskLevel | undefined>): PlanRiskLevel | undefined {
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  if (values.includes("low")) return "low";
  return undefined;
}

function sumEstimateHours(tasks: PlanTask[]): number | undefined {
  const total = tasks.reduce((sum, task) => sum + (task.estimateHours ?? 0), 0);
  return total > 0 ? total : undefined;
}

function nodeEffortHours(node: PlanNode): number {
  return Math.max(1, node.estimateHours ?? sumEstimateHours(node.tasks) ?? node.tasks.length ?? 1);
}

function resizeNode(plan: PlanModel, nodeId: string, startDate: string, endDate: string): PlanModel {
  return {
    ...plan,
    nodes: plan.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      return syncTaskItemDatesToNode(normalizeNodeInterval({ ...node, startDate, endDate, date: endDate }));
    })
  };
}

function deletePhase(plan: PlanModel, phaseId: string): PlanModel {
  if (plan.phases.length <= 1) return plan;
  return {
    ...plan,
    phases: plan.phases.filter((phase) => phase.id !== phaseId),
    nodes: plan.nodes.filter((node) => node.phaseId !== phaseId)
  };
}

function renamePhase(plan: PlanModel, phaseId: string, name: string): PlanModel {
  return {
    ...plan,
    phases: plan.phases.map((phase) => (phase.id === phaseId ? { ...phase, name } : phase))
  };
}

function deleteNode(plan: PlanModel, nodeId: string): PlanModel {
  return {
    ...plan,
    nodes: plan.nodes.filter((node) => node.id !== nodeId)
  };
}

function mergeAgentPlan(plan: PlanModel, generated: AgentBreakdownPayload): PlanModel {
  const stamp = Date.now();
  const phaseIdMap = new Map<string, string>();
  const newPhases: PlanPhase[] = generated.phases.map((phase, index) => {
    const newId = `ai-phase-${stamp}-${index}`;
    phaseIdMap.set(phase.id, newId);
    return {
      id: newId,
      name: phase.name,
      startDate: phase.startDate,
      endDate: phase.endDate,
      progress: phase.progress ?? 0,
      difficulty: phase.difficulty ?? "medium",
      summary: phase.summary ?? "AI 生成阶段",
      ownerLabel: phase.ownerLabel,
      riskCount: phase.riskCount ?? 0,
      taskCount: phase.taskCount ?? 0
    };
  });

  const newNodes: PlanNode[] = generated.nodes.map((node, index) => ({
    id: `ai-node-${stamp}-${index}`,
    phaseId: phaseIdMap.get(node.phaseId) ?? newPhases[0]?.id ?? node.phaseId,
    shape: node.shape ?? "milestone",
    label: node.label,
    title: node.title,
    date: node.date,
    startDate: node.startDate,
    endDate: node.endDate,
    difficulty: node.difficulty,
    progress: node.progress ?? 0,
    ownerLabel: node.ownerLabel,
    tasks: node.tasks ?? [],
    isOnCriticalPath: node.isOnCriticalPath ?? false
  }));

  const dates = [
    ...newPhases.flatMap((phase) => [phase.startDate, phase.endDate]),
    ...newNodes.map((node) => node.date)
  ];

  return {
    ...plan,
    phases: [...plan.phases, ...newPhases],
    nodes: [...plan.nodes, ...newNodes],
    startDate: minIso(plan.startDate, ...dates) ?? plan.startDate,
    endDate: maxIso(plan.endDate, ...dates) ?? plan.endDate
  };
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function shiftIsoByMs(value: string, deltaMs: number): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(time + deltaMs).toISOString();
}

function normalizeNodeInterval(node: PlanNode): PlanNode {
  if (node.shape === "milestone") {
    return {
      ...node,
      startDate: node.date,
      endDate: node.date
    };
  }

  const startDate = node.startDate ?? node.date;
  const endCandidate = node.endDate ?? node.date ?? startDate;
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endCandidate).getTime();
  const endDate = Number.isFinite(startTime) && Number.isFinite(endTime) && endTime < startTime
    ? startDate
    : endCandidate;
  return {
    ...node,
    startDate,
    endDate,
    date: endDate
  };
}

function syncTaskItemDatesToNode(node: PlanNode): PlanNode {
  if (node.shape !== "task") return node;
  const startDate = node.startDate ?? node.date;
  const endDate = node.endDate ?? node.date;
  return {
    ...node,
    tasks: node.tasks.map((task) => ({
      ...task,
      startDate,
      endDate
    }))
  };
}

function shiftNodeAndTaskItems(node: PlanNode, days: number): PlanNode {
  const shifted = normalizeNodeInterval({
    ...node,
    date: addDays(node.date, days),
    startDate: node.startDate ? addDays(node.startDate, days) : node.startDate,
    endDate: node.endDate ? addDays(node.endDate, days) : node.endDate,
    tasks: node.tasks.map((task) => ({
      ...task,
      startDate: task.startDate ? addDays(task.startDate, days) : task.startDate,
      endDate: task.endDate ? addDays(task.endDate, days) : task.endDate
    }))
  });
  return node.shape === "task" ? syncTaskItemDatesToNode(shifted) : shifted;
}

function minIso(...values: string[]): string | undefined {
  return pickIso(values, Math.min);
}

function maxIso(...values: string[]): string | undefined {
  return pickIso(values, Math.max);
}

function pickIso(values: string[], picker: (...values: number[]) => number): string | undefined {
  const times = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  return times.length ? new Date(picker(...times)).toISOString() : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
