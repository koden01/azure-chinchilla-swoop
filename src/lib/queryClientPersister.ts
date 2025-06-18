import { get, set, del } from 'idb-keyval';
import { Persister } from '@tanstack/react-query';

// Custom replacer for JSON.stringify to handle Map objects
function replacer(key: string, value: any): any {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  }
  return value;
}

// Custom reviver for JSON.parse to handle Map objects
function reviver(key: string, value: any): any {
  if (typeof value === 'object' && value !== null && value.dataType === 'Map') {
    return new Map(value.value);
  }
  return value;
}

export const persister: Persister = {
  persistClient: async (client) => {
    console.log('Persisting client...');
    // Use custom replacer when stringifying
    await set('scanresihg-query-cache', JSON.stringify(client, replacer));
  },
  restoreClient: async () => {
    console.log('Restoring client...');
    const storedClient = await get('scanresihg-query-cache');
    // Use custom reviver when parsing
    return storedClient ? JSON.parse(storedClient, reviver) : undefined;
  },
  removeClient: async () => {
    console.log('Removing client...');
    await del('scanresihg-query-cache');
  },
};