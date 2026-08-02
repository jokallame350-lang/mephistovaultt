// In-Browser Encrypted Memory Vault using IndexedDB
const DB_NAME = 'MephistoMemoryVault';
const STORE_NAME = 'vault_files';

export interface VaultFileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  addedAt: number;
}

function generateSecureId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return `${hex}-${Date.now()}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveToMemoryVault(blob: Blob, name: string, type: string): Promise<VaultFileItem> {
  const db = await openDB();
  const item: VaultFileItem = {
    id: generateSecureId(),
    name,
    type,
    size: blob.size,
    blob,
    addedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);

    tx.oncomplete = () => {
      db.close();
      resolve(item);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || req.error);
    };
    tx.onabort = () => {
      db.close();
      reject(new Error('Transaction aborted'));
    };
  });
}

export async function getMemoryVaultFiles(): Promise<VaultFileItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      tx.oncomplete = () => {
        db.close();
        resolve(req.result || []);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || req.error);
      };
      tx.onabort = () => {
        db.close();
        reject(new Error('Transaction aborted'));
      };
    });
  } catch {
    return [];
  }
}

export async function deleteFromMemoryVault(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(new Error('Transaction aborted'));
    };
  });
}

export async function purgeMemoryVault(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(new Error('Transaction aborted'));
    };
  });
}

