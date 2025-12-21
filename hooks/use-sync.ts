"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import {
  cancelPendingSync,
  debouncedSync,
  forceSync,
  getSyncStatus,
  type SyncResult,
  type SyncStatus,
  setAuthenticatedState,
  subscribeSyncStatus,
  syncAll,
} from "@/lib/sync-service";
import { allJourneysAtom } from "@/lib/workflow-store";
import { useSetAtom } from "jotai";

type UseSyncReturn = {
  // Current sync status
  status: SyncStatus;
  // Whether user is authenticated (sync enabled)
  isAuthenticated: boolean;
  // Trigger a debounced sync for a specific journey
  triggerSync: (journeyId?: string) => void;
  // Force immediate sync
  triggerForceSync: (journeyId?: string) => Promise<boolean>;
  // Perform full sync (download + upload)
  performFullSync: () => Promise<SyncResult>;
  // Whether sync is currently in progress
  isSyncing: boolean;
};

export function useSync(): UseSyncReturn {
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const hasPerformedInitialSync = useRef(false);
  const setAllJourneys = useSetAtom(allJourneysAtom);
  const isAuthenticated = !!session?.user && !isPending;
  const isSyncing = status === "syncing";

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setStatus);
    return () => {
      unsubscribe();
    };
  }, []);

  // Update authentication state in sync service
  useEffect(() => {
    setAuthenticatedState(isAuthenticated);
  }, [isAuthenticated]);

  // Perform initial sync when user logs in
  useEffect(() => {
    if (isAuthenticated && !hasPerformedInitialSync.current) {
      hasPerformedInitialSync.current = true;
      syncAll().then((result) => {
        setAllJourneys(result.journeys);
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

  // Cancel pending syncs on unmount
  useEffect(
    () => () => {
      cancelPendingSync();
    },
    []
  );

  // Trigger debounced sync (only if authenticated)
  const triggerSync = useCallback(
    (journeyId?: string) => {
      if (!isAuthenticated) {
        return;
      }
      debouncedSync(journeyId);
    },
    [isAuthenticated]
  );

  // Force immediate sync (only if authenticated)
  const triggerForceSync = useCallback(
    async (journeyId?: string): Promise<boolean> => {
      if (!isAuthenticated) {
        return false;
      }
      return await forceSync(journeyId);
    },
    [isAuthenticated]
  );

  // Perform full sync (download + upload)
  const performFullSync = useCallback(async (): Promise<SyncResult> => {
    if (!isAuthenticated) {
      return {
        success: false,
        journeys: [],
        errors: ["Not authenticated"],
      };
    }
    return await syncAll();
  }, [isAuthenticated]);

  return {
    status,
    isAuthenticated,
    triggerSync,
    triggerForceSync,
    performFullSync,
    isSyncing,
  };
}
