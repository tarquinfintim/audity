import { openDB, type IDBPDatabase } from "idb";

export interface RecentFileEntry {
  id: string;
  name: string;
  lastOpened: number;
  duration: number;
  sampleRate: number;
  channelCount: number;
}

const DB_NAME = "audity";
const DB_VERSION = 1;
const STORE_NAME = "recentFiles";
const MAX_RECENT = 20;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("lastOpened", "lastOpened");
        }
      },
    });
  }
  return dbPromise;
}

export async function addRecentFile(entry: RecentFileEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, entry);

  // Evict old entries
  const all = await db.getAllFromIndex(STORE_NAME, "lastOpened");
  if (all.length > MAX_RECENT) {
    const toDelete = all.slice(0, all.length - MAX_RECENT);
    const tx = db.transaction(STORE_NAME, "readwrite");
    for (const entry of toDelete) {
      await tx.store.delete(entry.id);
    }
    await tx.done;
  }
}

export async function getRecentFiles(): Promise<RecentFileEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_NAME, "lastOpened");
  return all.reverse(); // newest first
}

export async function removeRecentFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
