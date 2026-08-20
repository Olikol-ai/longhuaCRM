import { OFFLINE_DB_NAME, OFFLINE_DB_VERSION, OFFLINE_STORES } from './constants.js';

/** @typedef {{ get: Function, put: Function, delete: Function, getAll: Function, clear: Function }} OfflineStoreApi */
/** @typedef {{ store: (name: string) => OfflineStoreApi, close?: Function }} OfflineBackend */

let backendPromise = null;
/** @type {OfflineBackend | null} */
let injectedBackend = null;

/**
 * Inject backend (tests / memory). Pass null to restore IndexedDB.
 * @param {OfflineBackend | null} backend
 */
export function setOfflineBackend(backend) {
  injectedBackend = backend;
  backendPromise = backend ? Promise.resolve(backend) : null;
}

export function createMemoryOfflineBackend() {
  /** @type {Map<string, Map<string, unknown>>} */
  const maps = new Map();
  for (const name of OFFLINE_STORES) {
    maps.set(name, new Map());
  }

  return {
    store(name) {
      if (!maps.has(name)) {
        throw new Error(`Unknown offline store: ${name}`);
      }
      const table = maps.get(name);
      return {
        async get(key) {
          return table.has(key) ? table.get(key) : undefined;
        },
        async put(value) {
          const key = value?.key;
          if (!key) throw new Error('offline put requires value.key');
          table.set(String(key), value);
          return String(key);
        },
        async delete(key) {
          table.delete(String(key));
        },
        async getAll() {
          return [...table.values()];
        },
        async clear() {
          table.clear();
        },
      };
    },
    close() {
      /* no-op */
    },
  };
}

function openIndexedDbBackend() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(createMemoryOfflineBackend());
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of OFFLINE_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'key' });
          store.createIndex('by_user', 'userId', { unique: false });
          store.createIndex('by_resource', 'resource', { unique: false });
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      resolve({
        store(name) {
          return {
            get(key) {
              return idbReq(db, name, 'readonly', (s) => s.get(key));
            },
            put(value) {
              return idbReq(db, name, 'readwrite', (s) => s.put(value));
            },
            delete(key) {
              return idbReq(db, name, 'readwrite', (s) => s.delete(key));
            },
            getAll() {
              return idbReq(db, name, 'readonly', (s) => s.getAll());
            },
            clear() {
              return idbReq(db, name, 'readwrite', (s) => s.clear());
            },
          };
        },
        close() {
          db.close();
        },
      });
    };
  });
}

function idbReq(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineBackend() {
  if (injectedBackend) return injectedBackend;
  if (!backendPromise) {
    backendPromise = openIndexedDbBackend().catch((err) => {
      backendPromise = null;
      throw err;
    });
  }
  return backendPromise;
}

/** Reset cached connection (tests). */
export function resetOfflineDbConnection() {
  backendPromise = null;
}
