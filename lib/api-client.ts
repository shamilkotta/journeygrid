/**
 * API Client for making type-safe API calls to the backend
 * Replaces server actions with API endpoints
 */

import type {
  Comment,
  JourneyEdge,
  JourneyNode,
  Note,
  Resource,
  Todo,
} from "./workflow-store";

// Journey data types
export type JourneyVisibility = "private" | "public";

export type JourneyData = {
  id?: string;
  name?: string;
  description?: string;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  visibility?: JourneyVisibility;
};

export type SavedJourney = JourneyData & {
  id: string;
  name: string;
  visibility: JourneyVisibility;
  createdAt: string;
  updatedAt: string;
  isOwner?: boolean;
};

// API error class
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Helper function to make API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new ApiError(response.status, error.error || "Request failed");
  }

  return response.json();
}

// AI API

type StreamMessage = {
  type: "operation" | "complete" | "error";
  operation?: {
    op:
      | "setName"
      | "setDescription"
      | "addNode"
      | "addEdge"
      | "removeNode"
      | "removeEdge"
      | "updateNode";
    name?: string;
    description?: string;
    node?: unknown;
    edge?: unknown;
    nodeId?: string;
    edgeId?: string;
    updates?: {
      position?: { x: number; y: number };
      data?: unknown;
    };
  };
  error?: string;
};

type StreamState = {
  buffer: string;
  currentData: JourneyData;
};

type OperationHandler = (
  op: StreamMessage["operation"],
  state: StreamState
) => void;

function handleSetName(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (op?.name) {
    state.currentData.name = op.name;
  }
}

function handleSetDescription(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (op?.description) {
    state.currentData.description = op.description;
  }
}

function handleAddNode(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (op?.node) {
    state.currentData.nodes = [
      ...state.currentData.nodes,
      op.node as JourneyNode,
    ];
  }
}

function handleAddEdge(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (op?.edge) {
    state.currentData.edges = [
      ...state.currentData.edges,
      op.edge as JourneyEdge,
    ];
  }
}

function handleRemoveNode(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (op?.nodeId) {
    state.currentData.nodes = state.currentData.nodes.filter(
      (n) => n.id !== op.nodeId
    );
    state.currentData.edges = state.currentData.edges.filter(
      (e) => e.source !== op.nodeId && e.target !== op.nodeId
    );
  }
}

function handleRemoveEdge(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (op?.edgeId) {
    state.currentData.edges = state.currentData.edges.filter(
      (e) => e.id !== op.edgeId
    );
  }
}

function handleUpdateNode(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (op?.nodeId && op.updates) {
    state.currentData.nodes = state.currentData.nodes.map((n) => {
      if (n.id === op.nodeId) {
        return {
          ...n,
          ...(op.updates?.position ? { position: op.updates.position } : {}),
          ...(op.updates?.data
            ? { data: { ...n.data, ...op.updates.data } }
            : {}),
        };
      }
      return n;
    });
  }
}

const operationHandlers: Record<string, OperationHandler> = {
  setName: handleSetName,
  setDescription: handleSetDescription,
  addNode: handleAddNode,
  addEdge: handleAddEdge,
  removeNode: handleRemoveNode,
  removeEdge: handleRemoveEdge,
  updateNode: handleUpdateNode,
};

function applyOperation(
  op: StreamMessage["operation"],
  state: StreamState
): void {
  if (!op?.op) {
    return;
  }

  const handler = operationHandlers[op.op];
  if (handler) {
    handler(op, state);
  }
}

function processStreamLine(
  line: string,
  onUpdate: (data: JourneyData) => void,
  state: StreamState
): void {
  if (!line.trim()) {
    return;
  }

  try {
    const message = JSON.parse(line) as StreamMessage;

    if (message.type === "operation" && message.operation) {
      applyOperation(message.operation, state);
      onUpdate({ ...state.currentData });
    } else if (message.type === "error") {
      console.error("[API Client] Error:", message.error);
      throw new Error(message.error);
    }
  } catch (error) {
    console.error("[API Client] Failed to parse JSONL line:", error);
  }
}

function processStreamChunk(
  value: Uint8Array,
  decoder: TextDecoder,
  onUpdate: (data: JourneyData) => void,
  state: StreamState
): void {
  state.buffer += decoder.decode(value, { stream: true });

  // Process complete JSONL lines
  const lines = state.buffer.split("\n");
  state.buffer = lines.pop() || "";

  for (const line of lines) {
    processStreamLine(line, onUpdate, state);
  }
}

export const aiApi = {
  generate: (
    prompt: string,
    existingJourney?: {
      nodes: JourneyNode[];
      edges: JourneyEdge[];
      name?: string;
    }
  ) =>
    apiCall<JourneyData>("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, existingWorkflow: existingJourney }),
    }),
  generateStream: async (
    prompt: string,
    onUpdate: (data: JourneyData) => void,
    existingJourney?: {
      nodes: JourneyNode[];
      edges: JourneyEdge[];
      name?: string;
    }
  ): Promise<JourneyData> => {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, existingWorkflow: existingJourney }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: StreamState = {
      buffer: "",
      currentData: existingJourney
        ? {
            nodes: existingJourney.nodes || [],
            edges: existingJourney.edges || [],
            name: existingJourney.name,
          }
        : { nodes: [], edges: [] },
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        processStreamChunk(value, decoder, onUpdate, state);
      }

      return state.currentData;
    } finally {
      reader.releaseLock();
    }
  },
};

// User API
export const userApi = {
  get: () =>
    apiCall<{
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      isAnonymous: boolean | null;
      providerId: string | null;
    }>("/api/user"),

  update: (data: { name?: string; email?: string }) =>
    apiCall<{ success: boolean }>("/api/user", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Journey API
export const journeyApi = {
  // Get all journeys
  getAll: () => apiCall<SavedJourney[]>("/api/journey"),

  // Get a specific journey
  getById: (id: string) => apiCall<SavedJourney>(`/api/journey/${id}`),

  // Create a new journey (id is optional - if provided, uses that ID)
  create: (journey: JourneyData) =>
    apiCall<SavedJourney>("/api/journey/create", {
      method: "POST",
      body: JSON.stringify(journey),
    }),

  // Update a journey
  update: (id: string, journey: Partial<JourneyData>) =>
    apiCall<SavedJourney>(`/api/journey/${id}`, {
      method: "PATCH",
      body: JSON.stringify(journey),
    }),

  // Delete a journey
  delete: (id: string) =>
    apiCall<{ success: boolean }>(`/api/journey/${id}`, {
      method: "DELETE",
    }),

  // Duplicate a journey
  duplicate: (id: string) =>
    apiCall<SavedJourney>(`/api/journey/${id}/duplicate`, {
      method: "POST",
    }),

  // Get current journey state
  getCurrent: () => apiCall<JourneyData>("/api/journey/current"),

  // Save current journey state
  saveCurrent: (nodes: JourneyNode[], edges: JourneyEdge[]) =>
    apiCall<JourneyData>("/api/journey/current", {
      method: "POST",
      body: JSON.stringify({ nodes, edges }),
    }),

  // Download journey
  download: (id: string) =>
    apiCall<{
      success: boolean;
      files?: Record<string, string>;
      error?: string;
    }>(`/api/journey/${id}/download`),

  // Get node data (todos, resources, notes, comments, dates)
  getNodeData: (journeyId: string, nodeId: string) =>
    apiCall<{
      todos?: Todo[];
      resources?: Resource[];
      notes?: Note[];
      comments?: Comment[];
      milestoneDate?: string;
      deadline?: string;
      startDate?: string;
    }>(`/api/journey/${journeyId}/nodes/${nodeId}`),

  // Update node data
  updateNodeData: (
    journeyId: string,
    nodeId: string,
    data: {
      todos?: Todo[];
      resources?: Resource[];
      notes?: Note[];
      comments?: Comment[];
      milestoneDate?: string;
      deadline?: string;
      startDate?: string;
    }
  ) =>
    apiCall<{ success: boolean }>(`/api/journey/${journeyId}/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Update node todos
  updateNodeTodos: (journeyId: string, nodeId: string, todos: Todo[]) =>
    apiCall<{ success: boolean }>(
      `/api/journey/${journeyId}/nodes/${nodeId}/todos`,
      {
        method: "PATCH",
        body: JSON.stringify({ todos }),
      }
    ),

  // Update node resources
  updateNodeResources: (
    journeyId: string,
    nodeId: string,
    resources: Resource[]
  ) =>
    apiCall<{ success: boolean }>(
      `/api/journey/${journeyId}/nodes/${nodeId}/resources`,
      {
        method: "PATCH",
        body: JSON.stringify({ resources }),
      }
    ),

  // Add note
  addNote: (journeyId: string, nodeId: string, note: Note) =>
    apiCall<{ success: boolean }>(
      `/api/journey/${journeyId}/nodes/${nodeId}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ note }),
      }
    ),

  // Add comment
  addComment: (journeyId: string, nodeId: string, comment: Comment) =>
    apiCall<{ success: boolean }>(
      `/api/journey/${journeyId}/nodes/${nodeId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ comment }),
      }
    ),

  // Update node dates
  updateNodeDates: (
    journeyId: string,
    nodeId: string,
    dates: {
      milestoneDate?: string;
      deadline?: string;
      startDate?: string;
    }
  ) =>
    apiCall<{ success: boolean }>(
      `/api/journey/${journeyId}/nodes/${nodeId}/dates`,
      {
        method: "PATCH",
        body: JSON.stringify(dates),
      }
    ),

  // Bulk sync journeys (create or update multiple)
  sync: (
    journeys: Array<{
      id: string;
      name: string;
      description?: string;
      nodes: JourneyNode[];
      edges: JourneyEdge[];
      visibility?: JourneyVisibility;
    }>
  ) =>
    apiCall<{
      created: string[];
      updated: string[];
      errors: Array<{ id: string; error: string }>;
    }>("/api/journey/sync", {
      method: "POST",
      body: JSON.stringify({ journeys }),
    }),
};

// Export all APIs as a single object
export const api = {
  ai: aiApi,
  user: userApi,
  journey: journeyApi,
};
