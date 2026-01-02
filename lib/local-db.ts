/**
 * Local-first database using IndexedDB
 * Stores journeys locally for offline-first experience
 * Sync with cloud can be implemented later
 */

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { nanoid } from "nanoid";
import type { JourneyEdge, JourneyNode } from "./workflow-store";

// Database schema
interface JourneyDBSchema extends DBSchema {
  journals: {
    key: string;
    value: LocalJournal;
    indexes: {
      "by-updated": string;
    };
  };
  journeys: {
    key: string;
    value: LocalJourney;
    indexes: {
      "by-updated": string;
      "by-name": string;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

type JourneyVisibility = "private" | "public";

export type LocalJournal = {
  id: string;
  userId: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  isDirty?: boolean;
  syncedAt?: string;
};

// Local journey type
export type LocalJourney = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  journalId: string | null;
  visibility: JourneyVisibility;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  syncedAt?: string;
  isDirty?: boolean;
};

const DB_NAME = "journey-builder";
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<JourneyDBSchema> | null = null;

// Initialize database
async function getDB(): Promise<IDBPDatabase<JourneyDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<JourneyDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create journeys store
      if (!db.objectStoreNames.contains("journeys")) {
        const journeyStore = db.createObjectStore("journeys", {
          keyPath: "id",
        });
        journeyStore.createIndex("by-updated", "updatedAt");
        journeyStore.createIndex("by-name", "name");
      }

      // Create journals store
      if (!db.objectStoreNames.contains("journals")) {
        const journalStore = db.createObjectStore("journals", {
          keyPath: "id",
        });
        journalStore.createIndex("by-updated", "updatedAt");
      }

      // Create settings store for app preferences
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
    },
  });

  return dbInstance;
}

// Create a new journey
export async function createLocalJourney(
  data: LocalJourney
): Promise<LocalJourney> {
  const db = await getDB();
  const now = new Date().toISOString();

  const journey: LocalJourney = {
    id: data.id || nanoid(),
    userId: data.userId,
    name: data.name,
    description: data.description || "",
    nodes: data.nodes || [],
    edges: data.edges || [],
    journalId: data.journalId || null,
    visibility: data.visibility || "private",
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    isOwner: data.isOwner ?? true,
    isDirty: true,
  };

  await db.put("journeys", journey);
  return journey;
}

// Get a journey by ID
export async function getLocalJourney(
  id: string
): Promise<LocalJourney | undefined> {
  const db = await getDB();
  return db.get("journeys", id);
}

// Get all journeys
export async function getAllLocalJourneys(): Promise<LocalJourney[]> {
  const db = await getDB();
  const journeys = await db.getAllFromIndex("journeys", "by-updated");
  // Return in reverse order (most recent first)
  return journeys.reverse();
}

// Update a journey
export async function updateLocalJourney(
  id: string,
  data: Partial<LocalJourney>
): Promise<LocalJourney | undefined> {
  const db = await getDB();
  const existing = await db.get("journeys", id);

  if (!existing) {
    return;
  }

  const updated: LocalJourney = {
    ...existing,
    ...data,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString(),
    isDirty: true,
  };

  await db.put("journeys", updated);
  return updated;
}

// Delete a journey
export async function deleteLocalJourney(id: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get("journeys", id);

  if (!existing) {
    return false;
  }

  await db.delete("journeys", id);
  return true;
}

// Get the most recent journey
export async function getMostRecentLocalJourney(): Promise<
  LocalJourney | undefined
> {
  const journeys = await getAllLocalJourneys();
  return journeys[0];
}

// Settings helpers
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get("settings", key) as Promise<T | undefined>;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put("settings", value, key);
}

// Current journey ID tracking
const CURRENT_JOURNEY_KEY = "current-journey-id";

export async function getCurrentJourneyId(): Promise<string | undefined> {
  return getSetting<string>(CURRENT_JOURNEY_KEY);
}

export async function setCurrentJourneyId(id: string | null): Promise<void> {
  if (id) {
    await setSetting(CURRENT_JOURNEY_KEY, id);
  } else {
    const db = await getDB();
    await db.delete("settings", CURRENT_JOURNEY_KEY);
  }
}

// Check if we have any journeys
export async function hasAnyJourneys(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count("journeys");
  return count > 0;
}

// Clear all data (for testing/reset)
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear("journeys");
  await db.clear("settings");
}

// ============================================
// Sync Helper Functions
// ============================================

// Get all journeys that have unsynced local changes
export async function getDirtyJourneys(): Promise<LocalJourney[]> {
  const db = await getDB();
  const allJourneys = await db.getAll("journeys");
  return allJourneys.filter((r) => r.isDirty === true);
}

// Get all journeys that have never been synced to server
export async function getUnsyncedJourneys(): Promise<LocalJourney[]> {
  const db = await getDB();
  const allJourneys = await db.getAll("journeys");
  return allJourneys.filter((r) => !r.syncedAt);
}

// Mark a journey as synced (clear dirty flag, set syncedAt)
export async function markJourneySynced(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("journeys", id);

  if (!existing) {
    return;
  }

  const updated: LocalJourney = {
    ...existing,
    isDirty: false,
    syncedAt: new Date().toISOString(),
  };

  await db.put("journeys", updated);
}

// Get all local journey IDs
export async function getAllLocalJourneyIds(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys("journeys");
}

// ============================================
// Journal CRUD Functions
// ============================================

// Create or update a journal (upsert)
export async function createLocalJournal(
  data: LocalJournal
): Promise<LocalJournal> {
  const db = await getDB();
  const now = new Date().toISOString();

  const journal: LocalJournal = {
    id: data.id || nanoid(),
    userId: data.userId,
    content: data.content ?? null,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    isDirty: data.isDirty ?? true,
    syncedAt: data.syncedAt,
  };

  await db.put("journals", journal);
  return journal;
}

// Get a journal by ID
export async function getLocalJournal(
  id: string
): Promise<LocalJournal | undefined> {
  const db = await getDB();
  return db.get("journals", id);
}

// Get all journals
export async function getAllLocalJournals(): Promise<LocalJournal[]> {
  const db = await getDB();
  const journals = await db.getAllFromIndex("journals", "by-updated");
  return journals.reverse();
}

// Update a journal
export async function updateLocalJournal(
  id: string,
  data: Partial<LocalJournal>
): Promise<LocalJournal | undefined> {
  const db = await getDB();
  const existing = await db.get("journals", id);

  if (!existing) {
    return;
  }

  const updated: LocalJournal = {
    ...existing,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
    isDirty: data.isDirty ?? true,
  };

  await db.put("journals", updated);
  return updated;
}

// Delete a journal
export async function deleteLocalJournal(id: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get("journals", id);

  if (!existing) {
    return false;
  }

  await db.delete("journals", id);
  return true;
}

// Get all journals that have unsynced local changes
export async function getDirtyJournals(): Promise<LocalJournal[]> {
  const db = await getDB();
  const allJournals = await db.getAll("journals");
  return allJournals.filter((j) => j.isDirty === true);
}

// Mark a journal as synced (clear dirty flag, set syncedAt)
export async function markJournalSynced(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("journals", id);

  if (!existing) {
    return;
  }

  const updated: LocalJournal = {
    ...existing,
    isDirty: false,
    syncedAt: new Date().toISOString(),
  };

  await db.put("journals", updated);
}
