import { type JourneyData, journalApi, journeyApi } from "./api-client";
import {
  getAllLocalJournals,
  getAllLocalJourneys,
  getLocalJournal,
  getLocalJourney,
  type LocalJournal,
  markJournalSynced,
  markJourneySynced,
  markJourneyUnsynced,
  markJournalUnsynced,
} from "./local-db";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export type SyncResult = {
  success: boolean;
  journeys: JourneyData[];
  errors: string[];
};

// Debounce timer for sync operations
let syncDebounceTimer: NodeJS.Timeout | null = null;
let journalSyncDebounceTimer: NodeJS.Timeout | null = null;
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
 * Sync a single journey to server
 */
export async function syncJourney(id: string): Promise<boolean> {
  try {
    const journey = await getLocalJourney(id);

    if (!journey) {
      return false;
    }

    // // Skip if not dirty
    if (!journey.isDirty) {
      return true;
    }
    // Mark as synced
    await markJourneySynced(id);

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
    return true;
  } catch (error) {
    console.error(`[Sync] Failed to sync journey ${id}:`, error);
    await markJourneyUnsynced(id);
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

// ============================================
// Journal Sync Functions
// ============================================

/**
 * Sync a single journal to server using journalApi.update()
 */
export async function syncJournal(id: string): Promise<boolean> {
  try {
    const journal = await getLocalJournal(id);

    if (!journal) {
      return false;
    }

    // Skip if not dirty
    if (!journal.isDirty) {
      return true;
    }

    // Mark as synced
    await markJournalSynced(id);

    await journalApi.update(id, journal.content);

    return true;
  } catch (error) {
    console.error(`[Sync] Failed to sync journal ${id}:`, error);
    await markJournalUnsynced(id);
    return false;
  }
}

/**
 * Debounced sync for journal changes
 */
export function debouncedJournalSync(journalId: string): void {
  // Skip if not authenticated
  if (!isUserAuthenticated) {
    return;
  }

  if (journalSyncDebounceTimer) {
    clearTimeout(journalSyncDebounceTimer);
  }

  journalSyncDebounceTimer = setTimeout(async () => {
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
      await syncJournal(journalId);
      setSyncStatus("synced");
    } catch (error) {
      console.error("[Sync] Debounced journal sync failed:", error);
      setSyncStatus("error");
    }
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Cancel pending debounced journal sync
 */
export function cancelPendingJournalSync(): void {
  if (journalSyncDebounceTimer) {
    clearTimeout(journalSyncDebounceTimer);
    journalSyncDebounceTimer = null;
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
    const localJournals = await getAllLocalJournals();
    const [journeySyncResult, journalSyncResult] = await Promise.allSettled([
      journeyApi.sync(
        localJourneys.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          nodes: r.nodes,
          edges: r.edges,
          journalId: r.journalId,
          visibility: r.visibility,
          updatedAt: r.updatedAt,
          createdAt: r.createdAt,
          userId: r.userId,
        }))
      ),
      journalApi.sync(
        localJournals.map((j: LocalJournal) => ({
          id: j.id,
          content: j.content,
          userId: j.userId,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
        }))
      ),
    ]);

    if (journeySyncResult.status === "fulfilled") {
      for (const journey of journeySyncResult.value.journeys) {
        await markJourneySynced(journey.id);
      }
      result.journeys = journeySyncResult.value.journeys;
      result.errors.push(...journeySyncResult.value.errors.map((e) => e.error));
    } else {
      result.errors.push(
        "[Sync] Failed to sync journeys: " +
          (journeySyncResult.reason?.message || "Unknown error")
      );
    }

    if (journalSyncResult.status === "fulfilled") {
      for (const journal of journalSyncResult.value.journals) {
        await markJournalSynced(journal.id);
      }
      result.errors.push(...journalSyncResult.value.errors.map((e) => e.error));
    } else {
      result.errors.push(
        "[Sync] Failed to sync journals: " +
          (journalSyncResult.reason?.message || "Unknown error")
      );
    }

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
export function debouncedSync(journeyId: string): void {
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
      await syncJourney(journeyId);
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
export async function forceSync(journeyId: string): Promise<boolean> {
  cancelPendingSync();

  // Check if online
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncStatus("offline");
    return false;
  }

  setSyncStatus("syncing");

  try {
    await syncJourney(journeyId);
    setSyncStatus("synced");
    return true;
  } catch (error) {
    console.error("[Sync] Force sync failed:", error);
    setSyncStatus("error");
    return false;
  }
}
