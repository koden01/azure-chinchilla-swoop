import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'scanresihg-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-operations';

interface ScanResiHGDB extends IDBPDatabase {
  'pending-operations': {
    key: string;
    value: PendingOperation;
  };
}

export const initDB = async (): Promise<IDBPDatabase<ScanResiHGDB>> => {
  return openDB<ScanResiHGDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
};