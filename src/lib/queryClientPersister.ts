import { createSyncStoragePersister } from '@tanstack/query-persist-client-core'; // Mengembalikan impor ke named import
import { get, set, del } from 'idb-keyval';

// Custom storage object for IndexedDB using idb-keyval
const indexedDBStorage = {
  getItem: async (key: string) => {
    const value = await get(key);
    console.log(`IndexedDB getItem: key=${key}, value=${value ? 'found' : 'not found'}`);
    return value;
  },
  setItem: async (key: string, value: string) => {
    console.log(`IndexedDB setItem: key=${key}, value length=${value.length}`);
    await set(key, value);
  },
  removeItem: async (key: string) => {
    console.log(`IndexedDB removeItem: key=${key}`);
    await del(key);
  },
};

export const persister = createSyncStoragePersister({
  storage: indexedDBStorage,
  key: 'scanresihg-query-cache', // Unique key for your application's cache
});