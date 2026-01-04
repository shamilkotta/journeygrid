import type { Edge, EdgeChange, Node, NodeChange } from "@xyflow/react";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { api } from "./api-client";
import {
  createLocalJournal,
  createLocalJourney,
  deleteLocalJourney,
  getLocalJournal,
  getLocalJourney,
  type LocalJourney,
  updateLocalJournal,
  updateLocalJourney,
} from "./local-db";
import {
  debouncedJournalSync,
  debouncedSync,
  deleteJourney,
} from "./sync-service";

export type JourneyNodeType = "milestone" | "goal" | "task" | "add";

export type JourneyNodeData = {
  label: string;
  description?: string;
  icon?: string; // Icon key (e.g., "target", "flag", "check-circle-2")
  type: JourneyNodeType;
  journalId?: string; // Reference to journal for lazy loading
  onClick?: () => void; // For the "add" node type
};

export type JourneyNode = Node<JourneyNodeData>;
export type JourneyEdge = Edge;

// Journey visibility type
export type JourneyVisibility = "private" | "public";

// Atoms for journey state (now backed by database)
export const nodesAtom = atom<JourneyNode[]>([]);
export const edgesAtom = atom<JourneyEdge[]>([]);
export const selectedNodeAtom = atom<string | null>(null);
export const selectedEdgeAtom = atom<string | null>(null);
export const isLoadingAtom = atom(false);
export const isGeneratingAtom = atom(false);
export const currentJourneyAtom = atom<Omit<
  LocalJourney,
  "nodes" | "edges"
> | null>(null);
export const currentJourneyIdAtom = atom((get) => get(currentJourneyAtom)?.id);
// export const currentJourneyNameAtom = atom<string>("");
// export const currentJourneyVisibilityAtom = atom<JourneyVisibility>("private");
// export const isJourneyOwnerAtom = atom<boolean>(true);

// Journal atoms
export const journalContentAtom = atom<string>("");
export const journalLoadingAtom = atom<boolean>(false);
let autosaveJournalTimeoutId: NodeJS.Timeout | null = null;

// Derived atom: Get the current journal ID based on selection
export const currentJournalIdAtom = atom((get) => {
  const selectedNodeId = get(selectedNodeAtom);
  const nodes = get(nodesAtom);
  const currentJourney = get(currentJourneyAtom);

  if (selectedNodeId) {
    // Node is selected - return node's journalId
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    return selectedNode?.data.journalId || null;
  }
  // No node selected - return journey's journalId
  return currentJourney?.journalId || null;
});

export const createJournalAtom = atom(
  null,
  async (get, set, content: string, journeyId: string, nodeId?: string) => {
    const journal = await api.journal.create(content, journeyId);
    const currentJourney = get(currentJourneyAtom);
    if (!currentJourney) return;
    if (nodeId) {
      const nodes = get(nodesAtom);
      const newNodes = nodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, journalId: journal.id } };
        }
        return n;
      });
      set(nodesAtom, newNodes);
    } else {
      const newJourney = {
        ...currentJourney,
        journalId: journal.id,
      };
      set(currentJourneyAtom, newJourney);
    }
    await createLocalJournal({
      id: journal.id,
      userId: currentJourney.userId,
      content: journal.content,
      createdAt: journal.createdAt,
      updatedAt: journal.updatedAt,
      isDirty: false,
    });
    set(autosaveAtom, { immediate: true });
  }
);

// Atom to fetch and set journal content
export const fetchJournalAtom = atom(null, async (get, set) => {
  const journalId = get(currentJournalIdAtom);

  if (!journalId) {
    set(journalContentAtom, "");
    set(journalLoadingAtom, false);
    return;
  }

  set(journalLoadingAtom, true);
  try {
    // Try local DB first
    const localJournal = await getLocalJournal(journalId);
    if (localJournal) {
      set(journalContentAtom, localJournal.content || "");
      set(journalLoadingAtom, false);
      return;
    }

    // Fallback to server
    const journal = await api.journal.getById(journalId);
    set(journalContentAtom, journal.content || "");

    // Save to local DB
    const currentJourney = get(currentJourneyAtom);
    if (currentJourney?.userId) {
      await createLocalJournal({
        id: journal.id,
        userId: currentJourney.userId,
        content: journal.content,
        createdAt: journal.createdAt,
        updatedAt: journal.updatedAt,
        isDirty: false,
      });
    }
  } catch (error) {
    console.error("Failed to fetch journal:", error);
    set(journalContentAtom, "");
  } finally {
    set(journalLoadingAtom, false);
  }
});

// Atom to update journal content
export const updateJournalAtom = atom(
  null,
  async (get, set, content: string, options?: { immediate?: boolean }) => {
    const journalId = get(currentJournalIdAtom);

    if (!journalId) return;

    const currentContent = get(journalContentAtom);
    if (content == currentContent) return;

    set(journalContentAtom, content);
    set(hasUnsavedChangesAtom, true);
    set(autosaveJournalAtom, options);
  }
);

export const autosaveJournalAtom = atom(
  null,
  async (get, set, options?: { immediate?: boolean }) => {
    const journal = get(journalContentAtom);
    const journalId = get(currentJournalIdAtom);

    if (!journalId) {
      return;
    }

    const saveFunc = async () => {
      try {
        // Save to local IndexedDB
        await updateLocalJournal(journalId, {
          content: journal,
          isDirty: true,
        });
        set(hasUnsavedChangesAtom, false);
        debouncedJournalSync(journalId);
      } catch (error) {
        console.error("Local autosave failed:", error);
      }
    };

    if (options?.immediate) {
      // Save immediately (for add/delete/connect operations)
      await saveFunc();
    } else {
      // Debounce for typing operations
      if (autosaveJournalTimeoutId) {
        clearTimeout(autosaveJournalTimeoutId);
      }
      autosaveJournalTimeoutId = setTimeout(saveFunc, AUTOSAVE_DELAY);
    }
  }
);

// UI state atoms
export const propertiesPanelActiveTabAtom = atom<string>("properties");
export const showMinimapAtom = atom(false);
export const rightPanelWidthAtom = atom<string | null>(null);
export const isPanelAnimatingAtom = atom<boolean>(false);
export const hasSidebarBeenShownAtom = atom<boolean>(false);
export const isSidebarCollapsedAtom = atom<boolean>(false);
export const isTransitioningFromHomepageAtom = atom<boolean>(false);

// Tracks the ID of a newly created node (for auto-focusing)
export const newlyCreatedNodeIdAtom = atom<string | null>(null);

// Autosave functionality - saves to local IndexedDB
let autosaveTimeoutId: NodeJS.Timeout | null = null;
const AUTOSAVE_DELAY = 1000; // 1 second debounce for field typing

export const setCurrentJourneyAtom = atom(
  null,
  async (get, set, journey: LocalJourney) => {
    const existingJourney = await getLocalJourney(journey.id);
    if (!existingJourney) {
      await createLocalJourney(journey);
    }

    let updated = journey;

    if (
      existingJourney &&
      new Date(existingJourney.updatedAt) > new Date(journey.updatedAt)
    ) {
      updated = {
        ...journey,
        ...existingJourney,
      };
    }
    await updateLocalJourney(journey.id, updated);
    debouncedSync(journey.id);
    const { nodes, edges, ...rest } = updated;
    set(nodesAtom, nodes);
    set(edgesAtom, edges);
    set(currentJourneyAtom, rest);
  }
);

export const updateCurrentJourneyAtom = atom(
  null,
  async (
    get,
    set,
    journey: Partial<Omit<LocalJourney, "nodes" | "edges">>,
    options?: { immediate?: boolean }
  ) => {
    const currentJourney = get(currentJourneyAtom);
    if (!currentJourney) {
      return;
    }
    set(currentJourneyAtom, { ...currentJourney, ...journey });
    set(hasUnsavedChangesAtom, true);
    await set(autosaveAtom, options);
  }
);

// Autosave atom that handles saving journey state to local storage
export const autosaveAtom = atom(
  null,
  async (get, set, options?: { immediate?: boolean }) => {
    const currentJourney = get(currentJourneyAtom);
    const nodes = get(nodesAtom);
    const edges = get(edgesAtom);

    // Only autosave if we have a journey ID
    if (!currentJourney?.id) {
      return;
    }

    const saveFunc = async () => {
      try {
        // Save to local IndexedDB
        await updateLocalJourney(currentJourney.id, {
          ...currentJourney,
          nodes,
          edges,
        });
        // Clear the unsaved changes indicator after successful save
        set(hasUnsavedChangesAtom, false);
        // Trigger debounced sync to server (if authenticated)
        debouncedSync(currentJourney.id);
      } catch (error) {
        console.error("Local autosave failed:", error);
      }
    };

    if (options?.immediate) {
      // Save immediately (for add/delete/connect operations)
      await saveFunc();
    } else {
      // Debounce for typing operations
      if (autosaveTimeoutId) {
        clearTimeout(autosaveTimeoutId);
      }
      autosaveTimeoutId = setTimeout(saveFunc, AUTOSAVE_DELAY);
    }
  }
);

export const journeyAtomFamily = atomFamily((journeyId: string) =>
  atom(async () => {
    const journey = await getLocalJourney(journeyId);
    return journey;
  })
);

// Derived atoms for node/edge operations
export const onNodesChangeAtom = atom(
  null,
  (get, set, changes: NodeChange[]) => {
    const currentNodes = get(nodesAtom);

    // Filter out deletion attempts on milestone nodes
    const filteredChanges = changes.filter((change) => {
      if (change.type === "remove") {
        const nodeToRemove = currentNodes.find((n) => n.id === change.id);
        // Prevent deletion of milestone nodes
        return nodeToRemove?.data.type !== "milestone";
      }
      return true;
    });

    const newNodes = applyNodeChanges(
      filteredChanges,
      currentNodes
    ) as JourneyNode[];
    set(nodesAtom, newNodes);

    // Sync selection state with selectedNodeAtom
    const selectedNode = newNodes.find((n) => n.selected);
    if (selectedNode) {
      set(selectedNodeAtom, selectedNode.id);
      // Clear edge selection when a node is selected
      set(selectedEdgeAtom, null);
      // Clear newly created node tracking if a different node is selected
      const newlyCreatedId = get(newlyCreatedNodeIdAtom);
      if (newlyCreatedId && newlyCreatedId !== selectedNode.id) {
        set(newlyCreatedNodeIdAtom, null);
      }
    } else if (get(selectedNodeAtom)) {
      // If no node is selected in ReactFlow but we have a selection, clear it
      const currentSelection = get(selectedNodeAtom);
      const stillExists = newNodes.find((n) => n.id === currentSelection);
      if (!stillExists) {
        set(selectedNodeAtom, null);
      }
      // Clear newly created node tracking when no node is selected
      set(newlyCreatedNodeIdAtom, null);
    }

    // Check if there were any deletions to trigger immediate save
    const hadDeletions = filteredChanges.some(
      (change) => change.type === "remove"
    );
    if (hadDeletions) {
      set(autosaveAtom, { immediate: true });
      return;
    }

    const noChanges = filteredChanges.every(
      (changes) =>
        changes.type !== "add" &&
        currentNodes.find((n) => n.id === changes.id)?.data.type == "add"
    );

    if (noChanges) return;

    // Check if there were any position changes (node moved) to trigger debounced save
    const hadPositionChanges = filteredChanges.some(
      (change) => change.type === "position" && change.dragging === false
    );
    if (hadPositionChanges) {
      set(hasUnsavedChangesAtom, true);
      set(autosaveAtom); // Debounced save
    }

    // Check if there were dimensions changes (resize) to trigger save
    const hadDimensionChanges = filteredChanges.some(
      (change) => change.type === "dimensions"
    );
    if (hadDimensionChanges) {
      set(hasUnsavedChangesAtom, true);
      set(autosaveAtom);
    }
  }
);

export const onEdgesChangeAtom = atom(
  null,
  (get, set, changes: EdgeChange[]) => {
    const currentEdges = get(edgesAtom);
    const newEdges = applyEdgeChanges(changes, currentEdges) as JourneyEdge[];
    set(edgesAtom, newEdges);

    // Sync selection state with selectedEdgeAtom
    const selectedEdge = newEdges.find((e) => e.selected);
    if (selectedEdge) {
      set(selectedEdgeAtom, selectedEdge.id);
      // Clear node selection when an edge is selected
      set(selectedNodeAtom, null);
    } else if (get(selectedEdgeAtom)) {
      // If no edge is selected in ReactFlow but we have a selection, clear it
      const currentSelection = get(selectedEdgeAtom);
      const stillExists = newEdges.find((e) => e.id === currentSelection);
      if (!stillExists) {
        set(selectedEdgeAtom, null);
      }
    }

    // Check if there were any deletions to trigger immediate save
    const hadDeletions = changes.some((change) => change.type === "remove");
    if (hadDeletions) {
      set(hasUnsavedChangesAtom, true);
      set(autosaveAtom, { immediate: hadDeletions });
    }
  }
);

export const addNodeAtom = atom(null, (get, set, node: JourneyNode) => {
  // Save current state to history before making changes
  const currentNodes = get(nodesAtom);
  const currentEdges = get(edgesAtom);
  const history = get(historyAtom);
  set(historyAtom, [...history, { nodes: currentNodes, edges: currentEdges }]);
  set(futureAtom, []);

  // Deselect all existing nodes and add new node as selected
  const updatedNodes = currentNodes.map((n) => ({ ...n, selected: false }));
  const newNode = { ...node, selected: true };
  const newNodes = [...updatedNodes, newNode];
  set(nodesAtom, newNodes);

  // Auto-select the newly added node
  set(selectedNodeAtom, node.id);

  // Track newly created nodes (for auto-focusing)
  if (node.data.type === "goal" || node.data.type === "task") {
    set(newlyCreatedNodeIdAtom, node.id);
  }

  // Mark as having unsaved changes
  set(hasUnsavedChangesAtom, true);

  // Trigger immediate autosave
  set(autosaveAtom, { immediate: true });
});

export const updateNodeDataAtom = atom(
  null,
  (get, set, { id, data }: { id: string; data: Partial<JourneyNodeData> }) => {
    const currentNodes = get(nodesAtom);

    // Check if label is being updated
    const oldNode = currentNodes.find((node) => node.id === id);
    const isLabelChange = data.label && oldNode?.data.label !== data.label;
    const isDescriptionChange =
      data.description && oldNode?.data.description !== data.description;
    const isIconChange = data.icon && oldNode?.data.icon !== data.icon;

    if (!isLabelChange && !isDescriptionChange && !isIconChange) {
      return;
    }

    const newNodes = currentNodes.map((node) => {
      if (node.id === id) {
        // Update the node itself
        return { ...node, data: { ...node.data, ...data } };
      }

      // Journeys don't use template references, so no need to update other nodes
      return node;
    });

    set(nodesAtom, newNodes);

    // Mark as having unsaved changes
    set(hasUnsavedChangesAtom, true);
    // Trigger debounced autosave (for typing)
    set(autosaveAtom);
  }
);

export const resizeNodeAtom = atom(
  null,
  (get, set, { id, style }: { id: string; style: React.CSSProperties }) => {
    const currentNodes = get(nodesAtom);
    const newNodes = currentNodes.map((node) => {
      if (node.id === id) {
        return { ...node, style: { ...node.style, ...style } };
      }
      return node;
    });

    set(nodesAtom, newNodes);
    set(hasUnsavedChangesAtom, true);
    set(autosaveAtom); // Debounced save is fine for resizing
  }
);

export const deleteNodeAtom = atom(null, (get, set, nodeId: string) => {
  const currentNodes = get(nodesAtom);

  // Prevent deletion of milestone nodes
  const nodeToDelete = currentNodes.find((node) => node.id === nodeId);
  if (nodeToDelete?.data.type === "milestone") {
    return;
  }

  // Save current state to history before making changes
  const currentEdges = get(edgesAtom);
  const history = get(historyAtom);
  set(historyAtom, [...history, { nodes: currentNodes, edges: currentEdges }]);
  set(futureAtom, []);

  const newNodes = currentNodes.filter((node) => node.id !== nodeId);
  const newEdges = currentEdges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  );

  set(nodesAtom, newNodes);
  set(edgesAtom, newEdges);

  if (get(selectedNodeAtom) === nodeId) {
    set(selectedNodeAtom, null);
  }

  // Mark as having unsaved changes
  set(hasUnsavedChangesAtom, true);

  // Trigger immediate autosave
  set(autosaveAtom, { immediate: true });
});

export const deleteEdgeAtom = atom(null, (get, set, edgeId: string) => {
  // Save current state to history before making changes
  const currentNodes = get(nodesAtom);
  const currentEdges = get(edgesAtom);
  const history = get(historyAtom);
  set(historyAtom, [...history, { nodes: currentNodes, edges: currentEdges }]);
  set(futureAtom, []);

  const newEdges = currentEdges.filter((edge) => edge.id !== edgeId);
  set(edgesAtom, newEdges);

  if (get(selectedEdgeAtom) === edgeId) {
    set(selectedEdgeAtom, null);
  }

  // Mark as having unsaved changes
  set(hasUnsavedChangesAtom, true);

  // Trigger immediate autosave
  set(autosaveAtom, { immediate: true });
});

export const deleteSelectedItemsAtom = atom(null, (get, set) => {
  // Save current state to history before making changes
  const currentNodes = get(nodesAtom);
  const currentEdges = get(edgesAtom);
  const history = get(historyAtom);
  set(historyAtom, [...history, { nodes: currentNodes, edges: currentEdges }]);
  set(futureAtom, []);

  // Get all selected nodes, excluding milestone nodes
  const selectedNodeIds = currentNodes
    .filter((node) => node.selected && node.data.type !== "milestone")
    .map((node) => node.id);

  // Delete selected nodes (excluding milestone nodes) and their connected edges
  const newNodes = currentNodes.filter((node) => {
    // Keep milestone nodes even if selected
    if (node.data.type === "milestone") {
      return true;
    }
    // Remove other selected nodes
    return !node.selected;
  });

  const newEdges = currentEdges.filter(
    (edge) =>
      !(
        edge.selected ||
        selectedNodeIds.includes(edge.source) ||
        selectedNodeIds.includes(edge.target)
      )
  );

  set(nodesAtom, newNodes);
  set(edgesAtom, newEdges);
  set(selectedNodeAtom, null);
  set(selectedEdgeAtom, null);

  // Mark as having unsaved changes
  set(hasUnsavedChangesAtom, true);

  // Trigger immediate autosave
  set(autosaveAtom, { immediate: true });
});

export const clearJourneyAtom = atom(null, (get, set) => {
  // Save current state to history before making changes
  const currentNodes = get(nodesAtom);
  const currentEdges = get(edgesAtom);
  const history = get(historyAtom);
  set(historyAtom, [...history, { nodes: currentNodes, edges: currentEdges }]);
  set(futureAtom, []);

  set(nodesAtom, []);
  set(edgesAtom, []);
  set(selectedNodeAtom, null);
  set(selectedEdgeAtom, null);

  // Save immediately to local storage
  set(autosaveAtom, { immediate: true });
});

export const deleteJourneyAtom = atom(
  null,
  async (get, set, journeyId: string) => {
    await deleteLocalJourney(journeyId);
    set(
      allJourneysAtom,
      get(allJourneysAtom).filter((journey) => journey.id !== journeyId)
    );
    set(currentJourneyAtom, null);
    set(nodesAtom, []);
    set(edgesAtom, []);
    set(selectedNodeAtom, null);
    set(selectedEdgeAtom, null);
    deleteJourney(journeyId).then(() => {});
  }
);

// Load journey from local storage
export const loadJourneyAtom = atom(null, async (_get, set) => {
  try {
    set(isLoadingAtom, true);
    // Local journeys are loaded directly from the journey page
    // This atom is kept for compatibility but not used in local-first mode
  } catch (error) {
    console.error("Failed to load journey:", error);
  } finally {
    set(isLoadingAtom, false);
  }
});

// Journey toolbar UI state atoms
export const showClearDialogAtom = atom(false);
export const showDeleteDialogAtom = atom(false);
export const isSavingAtom = atom(false);
export const hasUnsavedChangesAtom = atom(false);
export const journeyNotFoundAtom = atom(false);

// Shared atom for all journeys list (used by dropdown)
export type JourneyListItem = {
  id: string;
  name: string;
  updatedAt: string;
};
export const allJourneysAtom = atom<JourneyListItem[]>([]);

// Undo/Redo state - scoped per journey
type HistoryState = {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
};

const historyAtom = atom<HistoryState[]>([]);
const futureAtom = atom<HistoryState[]>([]);

// Clear history when switching journeys
export const clearHistoryAtom = atom(null, (_get, set) => {
  set(historyAtom, []);
  set(futureAtom, []);
});

// Undo atom
export const undoAtom = atom(null, (get, set) => {
  const history = get(historyAtom);
  if (history.length === 0) {
    return;
  }

  const currentNodes = get(nodesAtom);
  const currentEdges = get(edgesAtom);
  const future = get(futureAtom);

  // Save current state to future
  set(futureAtom, [...future, { nodes: currentNodes, edges: currentEdges }]);

  // Pop from history and set as current
  const newHistory = [...history];
  const previousState = newHistory.pop();
  if (!previousState) {
    return; // No history to undo
  }
  set(historyAtom, newHistory);
  set(nodesAtom, previousState.nodes);
  set(edgesAtom, previousState.edges);

  // Save the undone state immediately
  set(autosaveAtom, { immediate: true });
});

// Redo atom
export const redoAtom = atom(null, (get, set) => {
  const future = get(futureAtom);
  if (future.length === 0) {
    return;
  }

  const currentNodes = get(nodesAtom);
  const currentEdges = get(edgesAtom);
  const history = get(historyAtom);

  // Save current state to history
  set(historyAtom, [...history, { nodes: currentNodes, edges: currentEdges }]);

  // Pop from future and set as current
  const newFuture = [...future];
  const nextState = newFuture.pop();
  if (!nextState) {
    return; // No future to redo
  }
  set(futureAtom, newFuture);
  set(nodesAtom, nextState.nodes);
  set(edgesAtom, nextState.edges);

  // Save the redone state immediately
  set(autosaveAtom, { immediate: true });
});

// Can undo/redo atoms
export const canUndoAtom = atom((get) => get(historyAtom).length > 0);
export const canRedoAtom = atom((get) => get(futureAtom).length > 0);
