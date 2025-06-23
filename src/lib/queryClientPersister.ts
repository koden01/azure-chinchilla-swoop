import { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import { get, set, del } from 'idb-keyval';

// Custom replacer for JSON.stringify to handle Map and Set objects
function replacer(_key: string, value: any): any {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  }
  if (value instanceof Set) { // Add Set handling
    return {
      dataType: 'Set',
      value: Array.from(value.values()),
    };
  }
  return value;
}

// Custom reviver for JSON.parse to handle Map and Set objects
function reviver(_key: string, value: any): any {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      // Ensure value.value is an array before passing to Map constructor
      if (Array.isArray(value.value)) {
        return new Map(value.value);
      } else {
        console.error("Attempted to revive Map, but value.value is not an array:", value.value);
        return new Map(); // Return empty Map to prevent error
      }
    }
    if (value.dataType === 'Set') { // Add Set handling
      // Ensure value.value is an array before passing to Set constructor
      if (Array.isArray(value.value)) {
        return new Set(value.value);
      } else {
        console.error("Attempted to revive Set, but value.value is not an array:", value.value);
        return new Set(); // Return empty Set to prevent error
      }
    }
  }
  return value;
}

export const persister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await set('scanresihg-query-cache', JSON.stringify(client, replacer));
  },
  restoreClient: async () => {
    const storedClient = await get('scanresihg-query-cache');
    return storedClient ? JSON.parse(storedClient, reviver) : undefined;
  },
  removeClient: async () => {
    await del('scanresihg-query-cache');
  },
};