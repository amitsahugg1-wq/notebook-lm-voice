
import { DialogueLine } from "../types";

export interface SavedAudio {
  id: string;
  name: string;
  blob?: Blob;
  script?: DialogueLine[];
  timestamp: number;
}

const DB_NAME = 'ExamPodDB';
const STORE_NAME = 'audios';
const MAX_SAVED = 5; // Increased slightly for better utility

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // Bumped version for schema update support if needed
    request.onupgradeneeded = (event: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePodcastToDrive(
  name: string, 
  script?: DialogueLine[], 
  blob?: Blob, 
  existingId?: string
): Promise<string> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const id = existingId || crypto.randomUUID();

  // Get all existing audios to check limit
  const allAudios: SavedAudio[] = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  // Sort by timestamp
  allAudios.sort((a, b) => a.timestamp - b.timestamp);

  // If we're adding a NEW record and we're at the limit, delete oldest
  if (!existingId && allAudios.length >= MAX_SAVED) {
    store.delete(allAudios[0].id);
  }

  // Add or Update podcast
  const podcast: SavedAudio = {
    id,
    name,
    script,
    blob,
    timestamp: Date.now(),
  };
  
  store.put(podcast); // put handles both add and update

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedAudios(): Promise<SavedAudio[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const results: SavedAudio[] = req.result;
      results.sort((a, b) => b.timestamp - a.timestamp); // Newest first
      resolve(results);
    };
  });
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
}
