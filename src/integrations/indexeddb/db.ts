import { openDB, IDBPDatabase } from 'idb';
import { PendingOperation } from './pendingOperations';

const DB_NAME = 'scanresihg-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-operations';

interface ScanResiHGDB extends IDBPDatabase {
  'pending-operations': {
    key: string;
    value: PendingOperation;
  };
}

// Variabel untuk menyimpan instance database
let dbInstance: IDBPDatabase<ScanResiHGDB> | null = null;

export const initDB = async (): Promise<IDBPDatabase<ScanResiHGDB>> => {
  if (dbInstance) {
    return dbInstance; // Mengembalikan instance yang sudah ada jika sudah diinisialisasi
  }

  dbInstance = await openDB<ScanResiHGDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
  return dbInstance;
};