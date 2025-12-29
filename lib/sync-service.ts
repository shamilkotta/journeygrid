/**
 * Sync Service for local-first journey synchronization
 *
 * Handles bidirectional sync between IndexedDB (local) and PostgreSQL (server).
 * Uses server-priority merge strategy with debounced syncing.
 */

import { type JourneyData, journeyApi } from "./api-client";
import {
  bulkUpsertFromServer,
  deleteJourneysNotInList,
  getAllLocalJourneys,
  getDirtyJourneys,
  getLocalJourney,
  getUnsyncedJourneys,
  type LocalJourney,
  markJourneySynced,
} from "./local-db";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export type SyncResult = {
  success: boolean;
  journeys: JourneyData[];
  errors: string[];
};

// Debounce timer for sync operations
let syncDebounceTimer: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds
let idleTimeout: NodeJS.Timeout | null = null;
const IDLE_TIMEOUT_MS = 60_000; // 1 minute

// Track current sync status
let currentSyncStatus: SyncStatus = "idle";
const syncStatusListeners: Set<(status: SyncStatus) => void> = new Set();

// Track authentication state (set from React layer)
let isUserAuthenticated = false;

// Set authentication state
export function setAuthenticatedState(authenticated: boolean): void {
  isUserAuthenticated = authenticated;
}

// Get authentication state
export function isAuthenticated(): boolean {
  return isUserAuthenticated;
}

// Notify all listeners of status change
function setSyncStatus(status: SyncStatus): void {
  currentSyncStatus = status;
  for (const listener of syncStatusListeners) {
    listener(status);
  }

  if (status == "synced") {
    if (idleTimeout) {
      clearTimeout(idleTimeout);
    }
    idleTimeout = setTimeout(() => {
      setSyncStatus("idle");
    }, IDLE_TIMEOUT_MS);
  }
}

// Subscribe to sync status changes
export function subscribeSyncStatus(
  listener: (status: SyncStatus) => void
): () => void {
  syncStatusListeners.add(listener);
  // Immediately call with current status
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

// Get current sync status
export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

/**
 * Convert server journey to local format
 */
function serverToLocal(
  server: JourneyData
): Omit<LocalJourney, "isDirty" | "syncedAt"> {
  return {
    id: server.id,
    name: server.name,
    description: server.description || "",
    nodes: server.nodes,
    edges: server.edges,
    journalId: server.journalId,
    visibility: server.visibility,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    userId: server.userId,
    isOwner: true,
  };
}

/**
 * Download all journeys from server and update local storage
 */
export async function downloadFromServer(): Promise<number> {
  try {
    const serverJourneys = await journeyApi.getAll();

    if (serverJourneys.length === 0) {
      return 0;
    }

    // Convert to local format and bulk upsert
    const localFormat = serverJourneys.map(serverToLocal);
    await bulkUpsertFromServer(localFormat);

    // Remove local journeys that were synced before but no longer exist on server
    const serverIds = serverJourneys.map((r) => r.id);
    await deleteJourneysNotInList(serverIds);

    return serverJourneys.length;
  } catch (error) {
    console.error("[Sync] Failed to download from server:", error);
    throw error;
  }
}

/**
 * Upload new local journeys (never synced) to server
 */
export async function uploadNewToServer(): Promise<number> {
  try {
    const unsyncedJourneys = await getUnsyncedJourneys();

    if (unsyncedJourneys.length === 0) {
      return 0;
    }

    let uploadCount = 0;

    for (const journey of unsyncedJourneys) {
      try {
        // Create on server with same ID
        await journeyApi.create({
          id: journey.id,
          name: journey.name,
          description: journey.description,
          nodes: journey.nodes,
          edges: journey.edges,
          journalId: journey.journalId,
          visibility: journey.visibility,
          createdAt: journey.createdAt,
          updatedAt: journey.updatedAt,
          userId: journey.userId,
        });

        // Mark as synced locally
        await markJourneySynced(journey.id);
        uploadCount += 1;
      } catch (error) {
        console.error(`[Sync] Failed to upload journey ${journey.id}:`, error);
        // Continue with other journeys
      }
    }

    return uploadCount;
  } catch (error) {
    console.error("[Sync] Failed to upload new journeys:", error);
    throw error;
  }
}

/**
 * Upload dirty journeys (already synced but have local changes) to server
 */
export async function uploadDirtyToServer(): Promise<number> {
  try {
    const dirtyJourneys = await getDirtyJourneys();

    // Filter to only those that have been synced before
    const syncedDirtyJourneys = dirtyJourneys.filter((r) => r.syncedAt);

    if (syncedDirtyJourneys.length === 0) {
      return 0;
    }

    let uploadCount = 0;

    for (const journey of syncedDirtyJourneys) {
      try {
        // Update on server
        await journeyApi.update(journey.id, {
          name: journey.name,
          description: journey.description,
          nodes: journey.nodes,
          edges: journey.edges,
          journalId: journey.journalId,
          visibility: journey.visibility,
        });

        // Mark as synced locally
        await markJourneySynced(journey.id);
        uploadCount += 1;
      } catch (error) {
        console.error(`[Sync] Failed to update journey ${journey.id}:`, error);
        // Continue with other journeys
      }
    }

    return uploadCount;
  } catch (error) {
    console.error("[Sync] Failed to upload dirty journeys:", error);
    throw error;
  }
}

/**
 * Sync a single journey to server
 */
export async function syncJourney(id: string): Promise<boolean> {
  try {
    const journey = await getLocalJourney(id);

    if (!journey) {
      return false;
    }

    // // Skip if not dirty
    // if (!journey.isDirty) {
    //   return true;
    // }

    await journeyApi.update(id, {
      userId: journey.userId,
      name: journey.name,
      description: journey.description,
      nodes: journey.nodes,
      edges: journey.edges,
      journalId: journey.journalId,
      visibility: journey.visibility,
      updatedAt: journey.updatedAt,
    });

    // Mark as synced
    await markJourneySynced(id);
    return true;
  } catch (error) {
    console.error(`[Sync] Failed to sync journey ${id}:`, error);
    return false;
  }
}

export async function deleteJourney(id: string): Promise<boolean> {
  try {
    await journeyApi.delete(id);
    return true;
  } catch (error) {
    console.error(`[Sync] Failed to delete journey ${id}:`, error);
    return false;
  }
}

/**
 * Full sync on login - download server data, upload new local data
 */
export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    journeys: [],
    errors: [],
  };

  // Check if online
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncStatus("offline");
    result.errors.push("No internet connection");
    return result;
  }

  setSyncStatus("syncing");

  try {
    // sync local journeys
    const localJourneys = await getAllLocalJourneys();
    const syncResult = await journeyApi.sync(
      localJourneys.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        nodes: r.nodes,
        edges: r.edges,
        visibility: r.visibility,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        userId: r.userId,
      }))
    );

    result.success = true;
    result.journeys = syncResult.journeys;
    setSyncStatus("synced");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown sync error";
    result.errors.push(errorMessage);
    setSyncStatus("error");
  }

  return result;
}

/**
 * Debounced sync - call this after local saves when authenticated
 */
export function debouncedSync(journeyId?: string): void {
  // Skip if not authenticated
  if (!isUserAuthenticated) {
    return;
  }

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    // Double-check authentication (might have changed during debounce)
    if (!isUserAuthenticated) {
      return;
    }

    // Check if online
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("syncing");

    try {
      if (journeyId) {
        // Sync single journey
        await syncJourney(journeyId);
      } else {
        // Sync all dirty journeys
        await uploadDirtyToServer();
        await uploadNewToServer();
      }
      setSyncStatus("synced");
    } catch (error) {
      console.error("[Sync] Debounced sync failed:", error);
      setSyncStatus("error");
    }
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Cancel pending debounced sync
 */
export function cancelPendingSync(): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
}

/**
 * Force immediate sync (bypass debounce)
 */
export async function forceSync(journeyId?: string): Promise<boolean> {
  cancelPendingSync();

  // Check if online
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncStatus("offline");
    return false;
  }

  setSyncStatus("syncing");

  try {
    if (journeyId) {
      await syncJourney(journeyId);
    } else {
      await uploadDirtyToServer();
      await uploadNewToServer();
    }
    setSyncStatus("synced");
    return true;
  } catch (error) {
    console.error("[Sync] Force sync failed:", error);
    setSyncStatus("error");
    return false;
  }
}
