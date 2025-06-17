import { get, set, del } from 'idb-keyval';
import { Persister } from '@tanstack/react-query';

export const persister: Persister = {
  persistClient: async (client) => {
    // console.log('Persisting client...'); // Removed
    await set('scanresihg-query-cache', JSON.stringify(client));
  },
  restoreClient: async () => {
    // console.log('Restoring client...'); // Removed
    const storedClient = await get('scanresihg-query-cache');
    return storedClient ? JSON.parse(storedClient) : undefined;
  },
  removeClient: async () => {
    // console.log('Removing client...'); // Removed
    await del('scanresihg-query-cache');
  },
};