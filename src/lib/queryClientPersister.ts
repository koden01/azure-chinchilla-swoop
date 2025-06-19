import { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import { get, set, del } from 'idb-keyval';

// Custom replacer for JSON.stringify to handle Map objects
function replacer(_key: string, value: any): any {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  }
  return value;
}

// Custom reviver for JSON.parse to handle Map objects
function reviver(_key: string, value: any): any {
  if (typeof value === 'object' && value !== null && value.dataType === 'Map') {
    return new Map(value.value);
  }
  return value;
}

export const persister: Persister = {
  persistClient: async (client: PersistedClient) => {
    console.log('Persisting client...');
    // Use custom replacer when stringifying
    await set('scanresihg-query-cache', JSON.stringify(client, replacer));
    console.log('Client persisted successfully.');
  },
  restoreClient: async () => {
    console.log('Restoring client...');
    const storedClient = await get('scanresihg-query-cache');
    console.log('Raw stored client from IndexedDB:', storedClient ? 'Data exists' : 'No data');
    if (storedClient) {
      try {
        const parsedClient = JSON.parse(storedClient, reviver);
        console.log('Parsed client:', parsedClient);
        return parsedClient;
      } catch (e) {
        console.error('Error parsing stored client:', e);
        // If parsing fails, remove the corrupted cache to prevent future errors
        await del('scanresihg-query-cache');
        console.log('Corrupted cache removed from IndexedDB.');
        return undefined; // Return undefined to indicate no valid client was restored
      }
    }
    return undefined;
  },
  removeClient: async () => {
    console.log('Removing client...');
    await del('scanresihg-query-cache');
    console.log('Client removed successfully.');
  },
};