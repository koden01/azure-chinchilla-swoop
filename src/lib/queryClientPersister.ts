import { get, set, del } from 'idb-keyval';
import { Persister } from '@tanstack/react-query'; // Import Persister type dari @tanstack/react-query

// Implementasi persister kustom yang sesuai dengan interface Persister
export const persister: Persister = {
  persistClient: async (client) => {
    console.log('Persisting client...');
    await set('scanresihg-query-cache', JSON.stringify(client));
  },
  restoreClient: async () => {
    console.log('Restoring client...');
    const storedClient = await get('scanresihg-query-cache');
    return storedClient ? JSON.parse(storedClient) : undefined;
  },
  removeClient: async () => {
    console.log('Removing client...');
    await del('scanresihg-query-cache');
  },
};