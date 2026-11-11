// Local storage with IndexedDB. Everything stays on the device.

const DB_NAME = 'maliyati';
const DB_VERSION = 1;
const STORE = 'kv';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => { db.close(); resolve(result.value); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function loadValue(key) {
  return withStore('readonly', (store) => {
    const holder = { value: undefined };
    const req = store.get(key);
    req.onsuccess = () => { holder.value = req.result; };
    return holder;
  });
}

export async function saveValue(key, value) {
  await withStore('readwrite', (store) => {
    store.put(value, key);
    return { value: true };
  });
}

export async function deleteValue(key) {
  await withStore('readwrite', (store) => {
    store.delete(key);
    return { value: true };
  });
}

// Every key that starts with a prefix (e.g. "photo:"), with its value.
export async function loadByPrefix(prefix) {
  return withStore('readonly', (store) => {
    const holder = { value: [] };
    const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
    const req = store.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      holder.value.push([cursor.key, cursor.value]);
      cursor.continue();
    };
    return holder;
  });
}

// Removes everything saved on this device.
export async function clearAll() {
  await withStore('readwrite', (store) => {
    store.clear();
    return { value: true };
  });
}
