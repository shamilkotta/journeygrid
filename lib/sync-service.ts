/**
 * Sync Service for local-first journey synchronization
 *
 * Handles bidirectional sync between IndexedDB (local) and PostgreSQL (server).
 * Uses server-priority merge strategy with debounced syncing.
 */

import { journeyApi, type SavedJourney } from "./api-client";
import {
  bulkUpsertFromServer,
  deleteJourneysNotInList,
  getDirtyJourneys,
  getLocalJourney,
  getUnsyncedJourneys,
  type LocalJourney,
  markJourneySynced,
} from "./local-db";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export type SyncResult = {
  success: boolean;
  uploaded: number;
  downloaded: number;
  errors: string[];
};

// Debounce timer for sync operations
let syncDebounceTimer: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

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
  server: SavedJourney
): Omit<LocalJourney, "isDirty" | "syncedAt"> {
  return {
    id: server.id,
    name: server.name,
    description: server.description || "",
    nodes: server.nodes,
    edges: server.edges,
    visibility: server.visibility,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
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
          visibility: journey.visibility,
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

    // Skip if not dirty
    if (!journey.isDirty) {
      return true;
    }

    if (journey.syncedAt) {
      // Already exists on server, update it
      await journeyApi.update(id, {
        name: journey.name,
        description: journey.description,
        nodes: journey.nodes,
        edges: journey.edges,
        visibility: journey.visibility,
      });
    } else {
      // New journey, create on server
      await journeyApi.create({
        id: journey.id,
        name: journey.name,
        description: journey.description,
        nodes: journey.nodes,
        edges: journey.edges,
        visibility: journey.visibility,
      });
    }

    // Mark as synced
    await markJourneySynced(id);
    return true;
  } catch (error) {
    console.error(`[Sync] Failed to sync journey ${id}:`, error);
    return false;
  }
}

/**
 * Full sync on login - download server data, upload new local data
 */
export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    uploaded: 0,
    downloaded: 0,
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
    // Step 1: Download all server journeys (server takes priority)
    result.downloaded = await downloadFromServer();

    // Step 2: Upload new local journeys (never synced before)
    result.uploaded = await uploadNewToServer();

    // Step 3: Upload dirty journeys (local changes to synced items)
    result.uploaded += await uploadDirtyToServer();

    result.success = true;
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
