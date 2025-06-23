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
      return new Map(value.value);
    }
    if (value.dataType === 'Set') { // Add Set handling
      return new Set(value.value);
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