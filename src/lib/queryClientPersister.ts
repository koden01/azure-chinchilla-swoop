import { Persister, PersistedClient } from '@tanstack/query-persist-client-core'; // Corrected import
import { get, set, del } from 'idb-keyval';

// Custom replacer for JSON.stringify to handle Map objects
function replacer(_key: string, value: any): any { // Added _ to key
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  }
  return value;
}

// Custom reviver for JSON.parse to handle Map objects
function reviver(_key: string, value: any): any { // Added _ to key
  if (typeof value === 'object' && value !== null && value.dataType === 'Map') {
    return new Map(value.value);
  }
  return value;
}

export const persister: Persister = {
  persistClient: async (client: PersistedClient) => { // Added PersistedClient type
    // console.log('Persisting client...'); // Removed
    // Use custom replacer when stringifying
    await set('scanresihg-query-cache', JSON.stringify(client, replacer));
  },
  restoreClient: async () => {
    // console.log('Restoring client...'); // Removed
    const storedClient = await get('scanresihg-query-cache');
    // Use custom reviver when parsing
    return storedClient ? JSON.parse(storedClient, reviver) : undefined;
  },
  removeClient: async () => {
    // console.log('Removing client...'); // Removed
    await del('scanresihg-query-cache');
  },
};