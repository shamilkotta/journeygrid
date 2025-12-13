"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NodeConfigPanel } from "@/components/workflow/node-config-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { getLocalJourney, updateLocalJourney } from "@/lib/local-db";
import {
  clearHistoryAtom,
  currentJourneyIdAtom,
  currentJourneyNameAtom,
  currentJourneyVisibilityAtom,
  edgesAtom,
  hasSidebarBeenShownAtom,
  hasUnsavedChangesAtom,
  isGeneratingAtom,
  isJourneyOwnerAtom,
  isPanelAnimatingAtom,
  isSavingAtom,
  isSidebarCollapsedAtom,
  type JourneyNode,
  type JourneyVisibility,
  journeyNotFoundAtom,
  nodesAtom,
  rightPanelWidthAtom,
} from "@/lib/workflow-store";

type JourneyPageProps = {
  params: Promise<{ journeyId: string }>;
};

const JourneyEditor = ({ params }: JourneyPageProps) => {
  const { journeyId } = use(params);
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [isGenerating, setIsGenerating] = useAtom(isGeneratingAtom);
  const [_isSaving, setIsSaving] = useAtom(isSavingAtom);
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  const [currentJourneyId] = useAtom(currentJourneyIdAtom);
  const currentJourneyName = useAtomValue(currentJourneyNameAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setCurrentJourneyId = useSetAtom(currentJourneyIdAtom);
  const setCurrentJourneyName = useSetAtom(currentJourneyNameAtom);
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);
  const [journeyNotFound, setJourneyNotFound] = useAtom(journeyNotFoundAtom);
  const setRightPanelWidth = useSetAtom(rightPanelWidthAtom);
  const setIsPanelAnimating = useSetAtom(isPanelAnimatingAtom);
  const [hasSidebarBeenShown, setHasSidebarBeenShown] = useAtom(
    hasSidebarBeenShownAtom
  );
  const [panelCollapsed, setPanelCollapsed] = useAtom(isSidebarCollapsedAtom);
  const setCurrentJourneyVisibility = useSetAtom(currentJourneyVisibilityAtom);
  const setIsJourneyOwner = useSetAtom(isJourneyOwnerAtom);
  const clearHistory = useSetAtom(clearHistoryAtom);

  // Panel width state for resizing
  const [panelWidth, setPanelWidth] = useState(30); // default percentage
  // Start visible if sidebar has already been shown (switching between journeys)
  const [panelVisible, setPanelVisible] = useState(hasSidebarBeenShown);
  const [isDraggingResize, setIsDraggingResize] = useState(false);
  const isResizing = useRef(false);
  const hasReadCookies = useRef(false);

  // Read sidebar preferences from cookies on mount (after hydration)
  useEffect(() => {
    if (hasReadCookies.current) {
      return;
    }
    hasReadCookies.current = true;

    // Read width
    const widthCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sidebar-width="));
    if (widthCookie) {
      const value = Number.parseFloat(widthCookie.split("=")[1]);
      if (!Number.isNaN(value) && value >= 20 && value <= 50) {
        setPanelWidth(value);
      }
    }

    // Read collapsed state
    const collapsedCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sidebar-collapsed="));
    if (collapsedCookie) {
      setPanelCollapsed(collapsedCookie.split("=")[1] === "true");
    }
  }, [setPanelCollapsed]);

  // Save sidebar width to cookie when it changes (skip initial render)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }
    // biome-ignore lint/suspicious/noDocumentCookie: simple cookie storage for sidebar width
    document.cookie = `sidebar-width=${panelWidth}; path=/; max-age=31536000`; // 1 year
  }, [panelWidth]);

  // Save collapsed state to cookie when it changes
  useEffect(() => {
    if (!hasReadCookies.current) {
      return;
    }
    // biome-ignore lint/suspicious/noDocumentCookie: simple cookie storage for sidebar state
    document.cookie = `sidebar-collapsed=${panelCollapsed}; path=/; max-age=31536000`; // 1 year
  }, [panelCollapsed]);

  // Trigger slide-in animation on mount (only for homepage -> journey transition)
  useEffect(() => {
    // Check if we came from homepage
    const shouldAnimate = sessionStorage.getItem("animate-sidebar") === "true";
    sessionStorage.removeItem("animate-sidebar");

    // Skip animation if sidebar has already been shown (switching between journeys)
    // or if we didn't come from homepage (direct load, refresh)
    if (hasSidebarBeenShown || !shouldAnimate) {
      setPanelVisible(true);
      setHasSidebarBeenShown(true);
      return;
    }

    // Set animating state before starting
    setIsPanelAnimating(true);
    // Delay to ensure the canvas is visible at full width first
    const timer = setTimeout(() => {
      setPanelVisible(true);
      setHasSidebarBeenShown(true);
    }, 100);
    // Clear animating state after animation completes (300ms + buffer)
    const animationTimer = setTimeout(() => setIsPanelAnimating(false), 400);
    return () => {
      clearTimeout(timer);
      clearTimeout(animationTimer);
      setIsPanelAnimating(false);
    };
  }, [hasSidebarBeenShown, setHasSidebarBeenShown, setIsPanelAnimating]);

  // Keyboard shortcut Cmd/Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setIsPanelAnimating(true);
        setPanelCollapsed((prev) => !prev);
        setTimeout(() => setIsPanelAnimating(false), 350);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsPanelAnimating, setPanelCollapsed]);

  // Set right panel width for AI prompt positioning
  // Only set it after the panel is visible (animated in) to coordinate the animation
  useEffect(() => {
    if (!isMobile && panelVisible && !panelCollapsed && !journeyNotFound) {
      setRightPanelWidth(`${panelWidth}%`);
    } else {
      // During initial render or when collapsed, set to null so prompt is centered
      setRightPanelWidth(null);
    }
    return () => {
      setRightPanelWidth(null);
    };
  }, [
    isMobile,
    setRightPanelWidth,
    panelWidth,
    panelVisible,
    journeyNotFound,
    panelCollapsed,
  ]);

  // Handle panel resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    setIsDraggingResize(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) {
        return;
      }
      const newWidth =
        ((window.innerWidth - moveEvent.clientX) / window.innerWidth) * 100;
      // Clamp between 20% and 50%
      setPanelWidth(Math.min(50, Math.max(20, newWidth)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      setIsDraggingResize(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  // Helper function to generate journey from AI
  const generateJourneyFromAI = useCallback(
    async (prompt: string) => {
      setIsGenerating(true);
      setCurrentJourneyId(journeyId);
      setCurrentJourneyName("AI Generated Journey");

      try {
        const journeyData = await api.ai.generate(prompt);

        // Clear selection on all nodes
        const nodesWithoutSelection = (journeyData.nodes || []).map(
          (node: JourneyNode) => ({ ...node, selected: false })
        );
        setNodes(nodesWithoutSelection);
        setEdges(journeyData.edges || []);
        setCurrentJourneyName(journeyData.name || "AI Generated Journey");

        // Save to local storage
        await updateLocalJourney(journeyId, {
          name: journeyData.name,
          description: journeyData.description,
          nodes: journeyData.nodes,
          edges: journeyData.edges,
        });
      } catch (error) {
        console.error("Failed to generate journey:", error);
        toast.error("Failed to generate journey");
      } finally {
        setIsGenerating(false);
      }
    },
    [
      journeyId,
      setIsGenerating,
      setCurrentJourneyId,
      setCurrentJourneyName,
      setNodes,
      setEdges,
    ]
  );

  // Helper function to load existing journey from local storage
  const loadExistingJourney = useCallback(async () => {
    try {
      // Load from local IndexedDB first
      const journey = await getLocalJourney(journeyId);

      if (!journey) {
        setJourneyNotFound(true);
        return;
      }

      // Clear undo/redo history when loading a new journey
      clearHistory();

      // Clear selection when loading
      const nodesWithoutSelection = journey.nodes.map((node: JourneyNode) => ({
        ...node,
        selected: false,
      }));

      setNodes(nodesWithoutSelection);
      setEdges(journey.edges);
      setCurrentJourneyId(journey.id);
      setCurrentJourneyName(journey.name);
      setCurrentJourneyVisibility(
        (journey.visibility as JourneyVisibility) ?? "private"
      );
      setIsJourneyOwner(true); // Local journeys are always owned by current user
      setHasUnsavedChanges(false);
      setJourneyNotFound(false);
    } catch (error) {
      console.error("Failed to load journey:", error);
      toast.error("Failed to load journey");
    }
  }, [
    journeyId,
    clearHistory,
    setNodes,
    setEdges,
    setCurrentJourneyId,
    setCurrentJourneyName,
    setCurrentJourneyVisibility,
    setIsJourneyOwner,
    setHasUnsavedChanges,
    setJourneyNotFound,
  ]);

  useEffect(() => {
    const loadJourneyData = async () => {
      const isGeneratingParam = searchParams?.get("generating") === "true";
      const storedPrompt = sessionStorage.getItem("ai-prompt");
      const storedJourneyId = sessionStorage.getItem("generating-journey-id");

      // Check if state is already loaded for this journey
      // Don't rely on nodes.length - an empty/cleared journey is a valid state
      if (currentJourneyId === journeyId) {
        return;
      }

      // Check if we should generate from AI
      if (isGeneratingParam && storedPrompt && storedJourneyId === journeyId) {
        sessionStorage.removeItem("ai-prompt");
        sessionStorage.removeItem("generating-journey-id");
        await generateJourneyFromAI(storedPrompt);
      } else {
        await loadExistingJourney();
      }
    };

    loadJourneyData();
  }, [
    journeyId,
    searchParams,
    currentJourneyId,
    generateJourneyFromAI,
    loadExistingJourney,
  ]);

  // Update page title when journey name changes
  useEffect(() => {
    if (currentJourneyName) {
      document.title = currentJourneyName;
    }
  }, [currentJourneyName]);

  // Keyboard shortcuts - save to local storage
  const handleSave = useCallback(async () => {
    if (!currentJourneyId || isGenerating) {
      return;
    }
    setIsSaving(true);
    try {
      // Save to local IndexedDB
      await updateLocalJourney(currentJourneyId, { nodes, edges });
      setHasUnsavedChanges(false);
      toast.success("Journey saved");
    } catch (error) {
      console.error("Failed to save journey:", error);
      toast.error("Failed to save journey");
    } finally {
      setIsSaving(false);
    }
  }, [
    currentJourneyId,
    nodes,
    edges,
    isGenerating,
    setIsSaving,
    setHasUnsavedChanges,
  ]);

  // Helper to handle save shortcut
  const handleSaveShortcut = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return true;
      }
      return false;
    },
    [handleSave]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle save shortcut
      if (handleSaveShortcut(e)) {
        return;
      }
    };

    // Use capture phase only to ensure we can intercept before other handlers
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSaveShortcut]);

  const isAnonymous =
    !session?.user ||
    session.user.name === "Anonymous" ||
    session.user.email?.startsWith("temp-");

  if (journeyNotFound) {
    return (
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-black/90">
        <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-lg border bg-background p-8 text-center shadow-lg">
            <h1 className="mb-2 font-semibold text-2xl">Journey Not Found</h1>
            <p className="mx-auto mb-6 max-w-sm text-muted-foreground">
              The journey you're looking for doesn't exist or has been deleted.
            </p>
            <div className="flex justify-center gap-2">
              <Button asChild>
                <Link href="/">New Journey</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      {/* Expand button when panel is collapsed */}
      {!isMobile && panelCollapsed && (
        <button
          className="-translate-y-1/2 pointer-events-auto absolute top-1/2 right-0 z-20 flex size-6 items-center justify-center rounded-l-full border border-r-0 bg-background shadow-sm transition-colors hover:bg-muted"
          onClick={() => {
            setIsPanelAnimating(true);
            setPanelCollapsed(false);
            setTimeout(() => setIsPanelAnimating(false), 350);
          }}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {/* Right panel overlay (desktop only) */}
      {!isMobile && (
        <div
          className="pointer-events-auto absolute inset-y-0 right-0 z-20 border-l bg-background transition-transform duration-300 ease-out"
          style={{
            width: `${panelWidth}%`,
            transform:
              panelVisible && !panelCollapsed
                ? "translateX(0)"
                : "translateX(100%)",
          }}
        >
          {/* Resize handle with collapse button */}
          {/* biome-ignore lint/a11y/useSemanticElements: custom resize handle */}
          <div
            aria-orientation="vertical"
            aria-valuenow={panelWidth}
            className="group absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize"
            onMouseDown={handleResizeStart}
            role="separator"
            tabIndex={0}
          >
            {/* Hover indicator */}
            <div className="absolute inset-y-0 left-0 w-1 bg-transparent transition-colors group-hover:bg-blue-500 group-active:bg-blue-600" />
            {/* Collapse button - hidden while resizing */}
            {!(isDraggingResize || panelCollapsed) && (
              <button
                className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-0 flex size-6 items-center justify-center rounded-full border bg-background opacity-0 shadow-sm transition-opacity hover:bg-muted group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPanelAnimating(true);
                  setPanelCollapsed(true);
                  setTimeout(() => setIsPanelAnimating(false), 350);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                type="button"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
          <NodeConfigPanel />
        </div>
      )}
    </div>
  );
};

const JourneyPage = ({ params }: JourneyPageProps) => (
  <JourneyEditor params={params} />
);

export default JourneyPage;
