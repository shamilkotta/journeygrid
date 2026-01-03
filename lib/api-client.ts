/**
 * API Client for making type-safe API calls to the backend
 * Replaces server actions with API endpoints
 */

import type { JourneyEdge, JourneyNode } from "./workflow-store";

// Journey data types
export type JourneyVisibility = "private" | "public";

export type JourneyData = {
  id: string;
  name: string;
  userId: string;
  description: string | null;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  journalId: string | null;
  visibility: JourneyVisibility;
  createdAt: string;
  updatedAt: string;
};

export type JournalData = {
  id: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
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

// Streaming data type - partial during streaming, cast to full JourneyData at end
type StreamingJourneyData = Partial<JourneyData> & {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
};

type StreamState = {
  buffer: string;
  currentData: StreamingJourneyData;
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
  onUpdate: (data: StreamingJourneyData) => void,
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
  onUpdate: (data: StreamingJourneyData) => void,
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
    onUpdate: (data: StreamingJourneyData) => void,
    existingJourney?: {
      nodes: JourneyNode[];
      edges: JourneyEdge[];
      name?: string;
    }
  ): Promise<StreamingJourneyData> => {
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

// Journal API
export const journalApi = {
  // Get a journal by ID
  getById: (journalId: string) =>
    apiCall<JournalData>(`/api/journal/${journalId}`),

  // Update a journal
  update: (journalId: string, content: string | null) =>
    apiCall<JournalData>(`/api/journal/${journalId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),

  // Delete a journal
  delete: (journalId: string) =>
    apiCall<{ success: boolean }>(`/api/journal/${journalId}`, {
      method: "DELETE",
    }),

  // Bulk sync journals (for authentication/initial sync only)
  sync: (
    journals: Array<{
      id: string;
      content: string | null;
      userId: string;
      createdAt?: string;
      updatedAt?: string;
    }>
  ) =>
    apiCall<{
      journals: JournalData[];
      errors: Array<{ id: string; error: string }>;
    }>("/api/journal/sync", {
      method: "POST",
      body: JSON.stringify({ journals }),
    }),
};

// Journey API
export const journeyApi = {
  // Get all journeys
  getAll: () => apiCall<JourneyData[]>("/api/journey"),

  // Get a specific journey
  getById: (id: string) => apiCall<JourneyData>(`/api/journey/${id}`),

  // Create a new journey (id is optional - if provided, uses that ID)
  create: (journey: JourneyData) =>
    apiCall<JourneyData>("/api/journey", {
      method: "POST",
      body: JSON.stringify(journey),
    }),

  // Update a journey
  update: (id: string, journey: Partial<JourneyData>) =>
    apiCall<JourneyData>(`/api/journey/${id}`, {
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
    apiCall<JourneyData>(`/api/journey/${id}/duplicate`, {
      method: "POST",
    }),

  // Download journey
  download: (id: string) =>
    apiCall<{
      success: boolean;
      files?: Record<string, string>;
      error?: string;
    }>(`/api/journey/${id}/download`),

  // Bulk sync journeys (create or update multiple)
  sync: (journeys: Array<JourneyData>) =>
    apiCall<{
      created: string[];
      updated: string[];
      journeys: JourneyData[];
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
  journal: journalApi,
  journey: journeyApi,
};
