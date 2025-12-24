"use client";

import { useReactFlow } from "@xyflow/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Copy,
  Flag,
  Globe,
  Loader2,
  Lock,
  Plus,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Undo2,
} from "lucide-react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { duplicateJourney } from "@/app/api/journey/[journeyId]/duplicate";
import { newJourney } from "@/app/api/journey/new";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useSync } from "@/hooks/use-sync";
import { api } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { getAllLocalJourneys, updateLocalJourney } from "@/lib/local-db";
import { syncAll } from "@/lib/sync-service";
import {
  addNodeAtom,
  allJourneysAtom,
  canRedoAtom,
  canUndoAtom,
  clearJourneyAtom,
  currentJourneyAtom,
  currentJourneyIdAtom,
  deleteEdgeAtom,
  deleteJourneyAtom,
  deleteNodeAtom,
  edgesAtom,
  hasUnsavedChangesAtom,
  isGeneratingAtom,
  isSavingAtom,
  type JourneyEdge,
  type JourneyListItem,
  type JourneyNode,
  type JourneyVisibility,
  nodesAtom,
  propertiesPanelActiveTabAtom,
  redoAtom,
  selectedEdgeAtom,
  selectedNodeAtom,
  showClearDialogAtom,
  showDeleteDialogAtom,
  undoAtom,
  updateCurrentJourneyAtom,
  updateNodeDataAtom,
} from "@/lib/workflow-store";
import { Panel } from "../ai-elements/panel";
import { Logo } from "../logo";
import { Spinner } from "../ui/spinner";
import { UserMenu } from "../workflows/user-menu";
import { PanelInner } from "./node-config-panel";

type WorkflowToolbarProps = {
  workflowId?: string;
};

// Type for broken template reference info
type BrokenTemplateReferenceInfo = {
  nodeId: string;
  nodeLabel: string;
  brokenReferences: Array<{
    fieldKey: string;
    fieldLabel: string;
    referencedNodeId: string;
    displayText: string;
  }>;
};

// Extract template variables from a string and check if they reference existing nodes
function extractTemplateReferences(
  value: unknown
): Array<{ nodeId: string; displayText: string }> {
  if (typeof value !== "string") {
    return [];
  }

  const pattern = /\{\{@([^:]+):([^}]+)\}\}/g;
  const matches = value.matchAll(pattern);

  return Array.from(matches).map((match) => ({
    nodeId: match[1],
    displayText: match[2],
  }));
}

// Recursively extract all template references from a config object
function extractAllTemplateReferences(
  config: Record<string, unknown>,
  prefix = ""
): Array<{ field: string; nodeId: string; displayText: string }> {
  const results: Array<{ field: string; nodeId: string; displayText: string }> =
    [];

  for (const [key, value] of Object.entries(config)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      const refs = extractTemplateReferences(value);
      for (const ref of refs) {
        results.push({ field: fieldPath, ...ref });
      }
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      results.push(
        ...extractAllTemplateReferences(
          value as Record<string, unknown>,
          fieldPath
        )
      );
    }
  }

  return results;
}

// Get broken template references for journey nodes (simplified - no config fields)
function getBrokenTemplateReferences(
  nodes: JourneyNode[]
): BrokenTemplateReferenceInfo[] {
  // Journeys don't use template references, return empty array
  return [];
}

// Type for missing required fields info
type MissingRequiredFieldInfo = {
  nodeId: string;
  nodeLabel: string;
  missingFields: Array<{
    fieldKey: string;
    fieldLabel: string;
  }>;
};

// Check if a field value is effectively empty
function isFieldEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string" && value.trim() === "") {
    return true;
  }
  return false;
}

// Check if a conditional field should be shown based on current config
function shouldShowField(
  field: { showWhen?: { field: string; equals: string } },
  config: Record<string, unknown>
): boolean {
  if (!field.showWhen) {
    return true;
  }
  return config[field.showWhen.field] === field.showWhen.equals;
}

// Get missing required fields for journey nodes (simplified - no required fields)
function getMissingRequiredFields(
  nodes: JourneyNode[]
): MissingRequiredFieldInfo[] {
  // Journeys don't have required fields, return empty array
  return [];
}

// Removed - integration system removed
function getMissingIntegrations(
  nodes: JourneyNode[],
  userIntegrations: Array<{ id: string; type: string }>
): Array<{
  integrationType: string;
  integrationLabel: string;
  nodeNames: string[];
}> {
  // No integrations needed for journeys
  return [];
}

// Removed - execution system removed

// Hook for journey handlers
type JourneyHandlerParams = {
  currentJourneyId?: string | null;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  setIsSaving: (value: boolean) => void;
  setHasUnsavedChanges: (value: boolean) => void;
};

function useJourneyHandlers({
  currentJourneyId,
  nodes,
  edges,
  setIsSaving,
  setHasUnsavedChanges,
}: JourneyHandlerParams) {
  const handleSave = async () => {
    if (!currentJourneyId) {
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
      toast.error("Failed to save journey. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    handleSave,
  };
}

// Hook for journey state management
function useJourneyState() {
  const [nodes, setNodes] = useAtom(nodesAtom);
  const [edges, setEdges] = useAtom(edgesAtom);
  const [isGenerating] = useAtom(isGeneratingAtom);
  const clearWorkflow = useSetAtom(clearJourneyAtom);
  const updateNodeData = useSetAtom(updateNodeDataAtom);
  const currentJourneyId = useAtomValue(currentJourneyIdAtom);
  const updateCurrentJourney = useSetAtom(updateCurrentJourneyAtom);

  const router = useRouter();
  const [showClearDialog, setShowClearDialog] = useAtom(showClearDialogAtom);
  const [showDeleteDialog, setShowDeleteDialog] = useAtom(showDeleteDialogAtom);
  const [isSaving, setIsSaving] = useAtom(isSavingAtom);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useAtom(
    hasUnsavedChangesAtom
  );
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const addNode = useSetAtom(addNodeAtom);
  const [canUndo] = useAtom(canUndoAtom);
  const [canRedo] = useAtom(canRedoAtom);
  const { data: session } = useSession();
  const setActiveTab = useSetAtom(propertiesPanelActiveTabAtom);
  const setSelectedNodeId = useSetAtom(selectedNodeAtom);
  const currentJourney = useAtomValue(currentJourneyAtom);
  const deleteJourney = useSetAtom(deleteJourneyAtom);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isDuplicating, startDuplication] = useTransition();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showMakePublicDialog, setShowMakePublicDialog] = useState(false);
  const [allJourneys, setAllJourneys] = useAtom(allJourneysAtom);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  // Load all journeys from local storage on mount
  useEffect(() => {
    const loadAllJourneys = async () => {
      try {
        const allJourneys = await api.journey.getAll();
        if (allJourneys && allJourneys.length > 0) {
          setAllJourneys(allJourneys);
        } else {
          const journeys = await getAllLocalJourneys();
          setAllJourneys(journeys);
        }
      } catch (error) {
        console.error("Failed to load journeys:", error);
      }
    };
    loadAllJourneys();
  }, [setAllJourneys]);

  return {
    nodes,
    edges,
    isGenerating,
    clearWorkflow,
    updateNodeData,
    currentJourneyId,
    currentJourney,
    router,
    showClearDialog,
    setShowClearDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    isSaving,
    setIsSaving,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    undo,
    redo,
    addNode,
    canUndo,
    canRedo,
    session,
    isDownloading,
    setIsDownloading,
    isDuplicating,
    startDuplication,
    showExportDialog,
    setShowExportDialog,
    showMakePublicDialog,
    setShowMakePublicDialog,
    allWorkflows: allJourneys,
    setAllWorkflows: setAllJourneys,
    showRenameDialog,
    setShowRenameDialog,
    setActiveTab,
    setNodes,
    setEdges,
    setSelectedNodeId,
    updateCurrentJourney,
    deleteJourney,
  };
}

// Hook for journey actions
function useJourneyActions(state: ReturnType<typeof useJourneyState>) {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session?.user && !isPending;
  const hasPerformedInitialSync = useRef(false);
  const {
    currentJourneyId,
    nodes,
    edges,
    setIsSaving,
    setHasUnsavedChanges,
    setShowClearDialog,
    clearWorkflow,
    setShowDeleteDialog,
    startDuplication,
    setShowMakePublicDialog,
    updateCurrentJourney,
    deleteJourney,
    setAllWorkflows,
    router,
  } = state;

  const { handleSave } = useJourneyHandlers({
    currentJourneyId,
    nodes,
    edges,
    setIsSaving,
    setHasUnsavedChanges,
  });

  const handleClearWorkflow = () => {
    clearWorkflow();
    setShowClearDialog(false);
  };

  const handleDeleteJourney = async () => {
    if (!currentJourneyId) {
      return;
    }

    try {
      // Delete from local IndexedDB
      await deleteJourney(currentJourneyId);
      setShowDeleteDialog(false);
      toast.success("Journey deleted successfully");
      router.replace("/");
    } catch (error) {
      console.error("Failed to delete journey:", error);
      toast.error("Failed to delete journey. Please try again.");
    }
  };

  const handleRenameJourney = async () => {};

  const handleDownload = async () => {
    toast.error("Download feature not available for journeys");
  };

  const handleToggleVisibility = async (newVisibility: JourneyVisibility) => {
    if (!currentJourneyId) {
      return;
    }

    // Show confirmation dialog when making public
    if (newVisibility === "public") {
      setShowMakePublicDialog(true);
      return;
    }

    // Switch to private immediately (no risks)
    try {
      // Update in local IndexedDB
      await updateCurrentJourney({ visibility: newVisibility });
      toast.success("Journey is now private");
    } catch (error) {
      console.error("Failed to update visibility:", error);
      toast.error("Failed to update visibility. Please try again.");
    }
  };

  const handleConfirmMakePublic = async () => {
    if (!currentJourneyId) {
      return;
    }

    try {
      // Update in local IndexedDB
      await updateCurrentJourney({ visibility: "public" });
      setShowMakePublicDialog(false);
      toast.success("Journey is now public");
    } catch (error) {
      console.error("Failed to update visibility:", error);
      toast.error("Failed to update visibility. Please try again.");
    }
  };

  const handleDuplicate = async () => {
    if (!currentJourneyId) {
      return;
    }

    startDuplication(() => {
      duplicateJourney(currentJourneyId);
    });
  };

  // Perform initial sync when user logs in
  useEffect(() => {
    if (isAuthenticated && !hasPerformedInitialSync.current) {
      hasPerformedInitialSync.current = true;
      syncAll().then((result) => {
        setAllWorkflows(result.journeys);
        if (result.success) {
          console.log(
            `[Sync] Initial sync complete: ${result.journeys.length} journeys synced`
          );
        } else {
          console.error("[Sync] Initial sync failed:", result.errors);
        }
      });
    }

    // Reset flag when user logs out
    if (!isAuthenticated) {
      hasPerformedInitialSync.current = false;
    }
  }, [isAuthenticated]);

  return {
    handleSave,
    handleClearWorkflow,
    handleDeleteJourney,
    handleRenameJourney,
    handleDownload,
    handleToggleVisibility,
    handleConfirmMakePublic,
    handleDuplicate,
  };
}

// Toolbar Actions Component - handles add step, undo/redo, save buttons
function ToolbarActions({
  workflowId,
  state,
  actions,
}: {
  workflowId?: string;
  state: ReturnType<typeof useJourneyState>;
  actions: ReturnType<typeof useJourneyActions>;
}) {
  const [showPropertiesSheet, setShowPropertiesSheet] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedNodeId] = useAtom(selectedNodeAtom);
  const [selectedEdgeId] = useAtom(selectedEdgeAtom);
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  const deleteNode = useSetAtom(deleteNodeAtom);
  const deleteEdge = useSetAtom(deleteEdgeAtom);
  const { screenToFlowPosition } = useReactFlow();
  const pathName = usePathname();

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const hasSelection = selectedNode || selectedEdge;

  // For non-owners viewing public journeys, don't show toolbar actions
  // (Duplicate button is now in the main toolbar next to Sign In)
  if (workflowId && !state.currentJourney?.isOwner) {
    return null;
  }

  const handleDelete = () => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
    } else if (selectedEdgeId) {
      deleteEdge(selectedEdgeId);
    }
    setShowDeleteAlert(false);
  };

  const handleAddStep = () => {
    // Get the ReactFlow wrapper (the visible canvas container)
    const flowWrapper = document.querySelector(".react-flow");
    if (!flowWrapper) {
      return;
    }

    const rect = flowWrapper.getBoundingClientRect();
    // Calculate center in absolute screen coordinates
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Convert to flow coordinates
    const position = screenToFlowPosition({ x: centerX, y: centerY });

    // Adjust for node dimensions to center it properly
    // Journey node is 200px wide and 80px tall (w-[200px] h-20 in Tailwind)
    const nodeWidth = 200;
    const nodeHeight = 80;
    position.x -= nodeWidth / 2;
    position.y -= nodeHeight / 2;

    // Check if there's already a node at this position
    const offset = 20; // Offset distance in pixels
    const threshold = 20; // How close nodes need to be to be considered overlapping

    const finalPosition = { ...position };
    let hasOverlap = true;
    let attempts = 0;
    const maxAttempts = 20; // Prevent infinite loop

    while (hasOverlap && attempts < maxAttempts) {
      hasOverlap = state.nodes.some((node) => {
        const dx = Math.abs(node.position.x - finalPosition.x);
        const dy = Math.abs(node.position.y - finalPosition.y);
        return dx < threshold && dy < threshold;
      });

      if (hasOverlap) {
        // Offset diagonally down-right
        finalPosition.x += offset;
        finalPosition.y += offset;
        attempts += 1;
      }
    }

    // Check if there's a milestone node - if not, create milestone first
    const hasMilestone = state.nodes.some(
      (node) => node.data.type === "milestone"
    );

    // Create milestone node if none exists, otherwise create goal node
    const nodeType = hasMilestone ? "goal" : "milestone";
    const newNode: JourneyNode = {
      id: nanoid(),
      type: nodeType,
      position: finalPosition,
      data: {
        label: hasMilestone ? "" : "Start",
        description: "",
        type: nodeType,
        status: "not-started",
      },
    };

    state.addNode(newNode);
    state.setSelectedNodeId(newNode.id);
    state.setActiveTab("properties");
  };

  return (
    <>
      {/* Add Step - Mobile Vertical */}
      <ButtonGroup className="flex lg:hidden" orientation="vertical">
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          disabled={!workflowId || state.isGenerating}
          onClick={handleAddStep}
          size="icon"
          title="Add Step"
          variant="secondary"
        >
          <Plus className="size-4" />
        </Button>
      </ButtonGroup>

      {/* Properties - Mobile Vertical (always visible) */}
      {pathName != "/" && (
        <ButtonGroup className="flex lg:hidden" orientation="vertical">
          <Button
            className="border hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => setShowPropertiesSheet(true)}
            size="icon"
            title="Properties"
            variant="secondary"
          >
            <Settings2 className="size-4" />
          </Button>
          {/* Delete - Show when node or edge is selected */}
          {hasSelection && (
            <Button
              className="border hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => setShowDeleteAlert(true)}
              size="icon"
              title="Delete"
              variant="secondary"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </ButtonGroup>
      )}

      {/* Properties Sheet - Mobile Only */}
      <Sheet onOpenChange={setShowPropertiesSheet} open={showPropertiesSheet}>
        <SheetContent className="w-full p-0 sm:max-w-full" side="bottom">
          <div className="h-[80vh]">
            <PanelInner />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Alert - Mobile Only */}
      <AlertDialog onOpenChange={setShowDeleteAlert} open={showDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedNode ? "Node" : "Connection"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{" "}
              {selectedNode ? "node" : "connection"}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Step - Desktop Horizontal */}
      <ButtonGroup className="hidden lg:flex" orientation="horizontal">
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          disabled={!workflowId || state.isGenerating}
          onClick={handleAddStep}
          size="icon"
          title="Add Step"
          variant="secondary"
        >
          <Plus className="size-4" />
        </Button>
      </ButtonGroup>

      {/* Undo/Redo - Mobile Vertical */}
      <ButtonGroup className="flex lg:hidden" orientation="vertical">
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          disabled={!state.canUndo || state.isGenerating}
          onClick={() => state.undo()}
          size="icon"
          title="Undo"
          variant="secondary"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          disabled={!state.canRedo || state.isGenerating}
          onClick={() => state.redo()}
          size="icon"
          title="Redo"
          variant="secondary"
        >
          <Redo2 className="size-4" />
        </Button>
      </ButtonGroup>

      {/* Undo/Redo - Desktop Horizontal */}
      <ButtonGroup className="hidden lg:flex" orientation="horizontal">
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          disabled={!state.canUndo || state.isGenerating}
          onClick={() => state.undo()}
          size="icon"
          title="Undo"
          variant="secondary"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          disabled={!state.canRedo || state.isGenerating}
          onClick={() => state.redo()}
          size="icon"
          title="Redo"
          variant="secondary"
        >
          <Redo2 className="size-4" />
        </Button>
      </ButtonGroup>

      {/* Save - Mobile Vertical */}
      <ButtonGroup className="flex lg:hidden" orientation="vertical">
        <SaveButton handleSave={actions.handleSave} state={state} />
        <SyncStatusIndicator currentJourneyId={state.currentJourneyId} />
      </ButtonGroup>

      {/* Save - Desktop Horizontal */}
      <ButtonGroup className="hidden lg:flex" orientation="horizontal">
        <SaveButton handleSave={actions.handleSave} state={state} />
        <SyncStatusIndicator currentJourneyId={state.currentJourneyId} />
      </ButtonGroup>

      {/* Visibility Toggle */}
      <VisibilityButton actions={actions} state={state} />
    </>
  );
}

// Save Button Component
function SaveButton({
  state,
  handleSave,
}: {
  state: ReturnType<typeof useJourneyState>;
  handleSave: () => Promise<void>;
}) {
  return (
    <Button
      className="relative border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
      disabled={!state.currentJourneyId || state.isGenerating || state.isSaving}
      onClick={handleSave}
      size="icon"
      title={state.isSaving ? "Saving..." : "Save journey"}
      variant="secondary"
    >
      {state.isSaving ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Save className="size-4" />
      )}
      {state.hasUnsavedChanges && !state.isSaving && (
        <div className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
      )}
    </Button>
  );
}

// Sync Status Indicator Component
function SyncStatusIndicator({
  currentJourneyId,
}: {
  currentJourneyId?: string;
}) {
  const { status, isAuthenticated, triggerForceSync, isSyncing } = useSync();

  // Don't show if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case "syncing":
        return <Spinner className="size-4" />;
      case "synced":
        return <Cloud className="size-4" />;
      case "error":
        return <AlertCircle className="size-4 text-destructive" />;
      case "offline":
        return <CloudOff className="size-4 text-muted-foreground" />;
      default:
        return <Cloud className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case "syncing":
        return "Syncing...";
      case "synced":
        return "Synced to cloud";
      case "error":
        return "Sync failed - click to retry";
      case "offline":
        return "Offline - changes saved locally";
      default:
        return "Cloud sync";
    }
  };

  const handleClick = async () => {
    if (status === "error" || status === "idle") {
      await triggerForceSync();
    }
  };

  return (
    <Button
      className="relative border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
      disabled={!currentJourneyId || isSyncing}
      onClick={handleClick}
      size="icon"
      title={getStatusTitle()}
      variant="secondary"
    >
      {getStatusIcon()}
    </Button>
  );
}

// Download Button Component (disabled for journeys)
function DownloadButton({
  state,
}: {
  state: ReturnType<typeof useJourneyState>;
}) {
  return null; // Download not available for journeys
}

// Visibility Button Component
function VisibilityButton({
  state,
  actions,
}: {
  state: ReturnType<typeof useJourneyState>;
  actions: ReturnType<typeof useJourneyActions>;
}) {
  const isPublic = state.currentJourney?.visibility === "public";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="relative border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          disabled={
            !state.currentJourneyId ||
            state.isGenerating ||
            !state.session?.user
          }
          size="icon"
          title={isPublic ? "Public journey" : "Private journey"}
          variant="secondary"
        >
          {isPublic ? (
            <Globe className="size-4" />
          ) : (
            <Lock className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="flex items-center gap-2"
          onClick={() => actions.handleToggleVisibility("private")}
        >
          <Lock className="size-4" />
          Private
          {!isPublic && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2"
          onClick={() => actions.handleToggleVisibility("public")}
        >
          <Globe className="size-4" />
          Public
          {isPublic && <Check className="ml-auto size-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Duplicate Button Component - placed next to Sign In for non-owners
function DuplicateButton({
  isDuplicating,
  onDuplicate,
}: {
  isDuplicating: boolean;
  onDuplicate: () => void;
}) {
  return (
    <Button
      className="h-9 border hover:bg-black/5 dark:hover:bg-white/5"
      disabled={isDuplicating}
      onClick={onDuplicate}
      size="sm"
      title="Duplicate to your workflows"
      variant="secondary"
    >
      {isDuplicating ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Copy className="mr-2 size-4" />
      )}
      Duplicate
    </Button>
  );
}

// Journey Menu Component
function WorkflowMenuComponent({
  workflowId,
  state,
  actions,
}: {
  workflowId?: string;
  state: ReturnType<typeof useJourneyState>;
  actions: ReturnType<typeof useJourneyActions>;
}) {
  const [pending, startTransition] = useTransition();
  const handleNewJourney = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (pending) return;
    startTransition(newJourney);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-9 max-w-[160px] items-center overflow-hidden rounded-md border bg-secondary text-secondary-foreground sm:max-w-none">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-full cursor-pointer items-center gap-2 px-3 font-medium text-sm transition-all hover:bg-black/5 dark:hover:bg-white/5">
            <Flag className="size-4 shrink-0" />
            <p className="truncate font-medium text-sm">
              {workflowId ? (
                state.currentJourney?.name
              ) : (
                <>
                  <span className="sm:hidden">New</span>
                  <span className="hidden sm:inline">New Journey</span>
                </>
              )}
            </p>
            <ChevronDown className="size-3 shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem
              asChild
              className="flex items-center justify-between"
            >
              <Link href="/new" onClick={handleNewJourney}>
                New Journey{" "}
                {pending ? (
                  <Spinner className="size-4 animate-spin" />
                ) : (
                  !workflowId && <Check className="size-4 shrink-0" />
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {state.allWorkflows.length === 0 ? (
              <DropdownMenuItem disabled>No journeys found</DropdownMenuItem>
            ) : (
              state.allWorkflows
                .filter((w: JourneyListItem) => w.name !== "__current__")
                .map((journey: JourneyListItem) => (
                  <DropdownMenuItem
                    className="flex items-center justify-between"
                    key={journey.id}
                    onClick={() => state.router.push(`/j/${journey.id}`)}
                  >
                    <span className="truncate">{journey.name}</span>
                    {journey.id === state.currentJourneyId && (
                      <Check className="size-4 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {workflowId && !state.currentJourney?.isOwner && (
        <span className="text-muted-foreground text-xs uppercase lg:hidden">
          Read-only
        </span>
      )}
    </div>
  );
}

// Journey Issues Dialog Component (simplified - no issues for journeys)
function WorkflowIssuesDialog({
  state,
  actions,
}: {
  state: ReturnType<typeof useJourneyState>;
  actions: ReturnType<typeof useJourneyActions>;
}) {
  return null; // No issues dialog for journeys
}

// Journey Dialogs Component
function WorkflowDialogsComponent({
  state,
  actions,
}: {
  state: ReturnType<typeof useJourneyState>;
  actions: ReturnType<typeof useJourneyActions>;
}) {
  return (
    <>
      <Dialog
        onOpenChange={state.setShowClearDialog}
        open={state.showClearDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Journey</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all nodes and connections? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => state.setShowClearDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={actions.handleClearWorkflow} variant="destructive">
              Clear Journey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={state.setShowRenameDialog}
        open={state.showRenameDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Journey</DialogTitle>
            <DialogDescription>
              Enter a new name for your journey.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              actions.handleRenameJourney();
            }}
          >
            <div className="space-y-2 py-4">
              <Label className="ml-1" htmlFor="journey-name">
                Journey Name
              </Label>
              <Input
                id="journey-name"
                onChange={(e) => {}}
                placeholder="Enter journey name"
                value={""}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => state.setShowRenameDialog(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={!false} type="submit">
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={state.setShowDeleteDialog}
        open={state.showDeleteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Journey</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;
              {state.currentJourney?.name}
              &rdquo;? This will permanently delete the journey. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => state.setShowDeleteDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={actions.handleDeleteJourney} variant="destructive">
              Delete Journey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Make Public Confirmation Dialog */}
      <AlertDialog
        onOpenChange={state.setShowMakePublicDialog}
        open={state.showMakePublicDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Globe className="size-5" />
              Make Journey Public?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Making this journey public means anyone with the link can:
                </p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>View the journey structure and nodes</li>
                  <li>See milestones, goals, and tasks</li>
                  <li>Duplicate the journey to their own account</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={actions.handleConfirmMakePublic}>
              Make Public
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const WorkflowToolbar = ({ workflowId }: WorkflowToolbarProps) => {
  const state = useJourneyState();
  const actions = useJourneyActions(state);

  return (
    <>
      <Panel
        className="flex flex-col gap-2 rounded-none border-none bg-transparent p-0 lg:flex-row lg:items-center"
        position="top-left"
      >
        <div className="flex items-center gap-3">
          <Logo className="shrink-0 text-foreground" />
          <WorkflowMenuComponent
            actions={actions}
            state={state}
            workflowId={workflowId}
          />
          {workflowId && !state.currentJourney?.isOwner && (
            <span className="hidden text-muted-foreground text-xs uppercase lg:inline">
              Read-only
            </span>
          )}
        </div>
      </Panel>

      <div className="pointer-events-auto absolute top-4 right-4 z-10">
        <div className="flex flex-col-reverse items-end gap-2 lg:flex-row lg:items-center">
          <ToolbarActions
            actions={actions}
            state={state}
            workflowId={workflowId}
          />
          <div className="flex items-center gap-2">
            {workflowId && !state.currentJourney?.isOwner && (
              <DuplicateButton
                isDuplicating={state.isDuplicating}
                onDuplicate={actions.handleDuplicate}
              />
            )}
            <UserMenu />
          </div>
        </div>
      </div>

      <WorkflowDialogsComponent actions={actions} state={state} />
    </>
  );
};
