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

let dbInstance: IDBPDatabase<ScanResiHGDB> | null = null;

export const initDB = async (): Promise<IDBPDatabase<ScanResiHGDB>> => {
  if (dbInstance) {
    // Coba lakukan transaksi dummy untuk memeriksa apakah instance yang ada masih valid
    try {
      await dbInstance.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count();
      return dbInstance; // Jika berhasil, instance masih valid
    } catch (e) {
      console.warn("[IndexedDB] Existing DB instance seems closed or invalid, re-opening.", e);
      dbInstance = null; // Paksa buka kembali
    }
  }

  dbInstance = await openDB<ScanResiHGDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
    blocked() {
      console.warn("[IndexedDB] Database upgrade blocked. Please close all tabs with this app.");
    },
    blocking() {
      console.warn("[IndexedDB] Another tab is blocking database upgrade. Please close other tabs.");
    },
    // Handler untuk ketika koneksi database dihentikan secara tak terduga (misalnya oleh browser)
    terminated() {
      console.error("[IndexedDB] Database connection terminated unexpectedly. Resetting instance.");
      dbInstance = null; // Reset instance agar akan dibuka kembali lain kali
    },
  });

  // Tambahkan event listener untuk event 'close' pada koneksi database
  // Ini penting untuk menangani kasus di mana browser menutup koneksi
  dbInstance.onclose = () => {
    console.warn("[IndexedDB] Database connection closed. Resetting instance.");
    dbInstance = null; // Reset instance agar akan dibuka kembali lain kali
  };

  return dbInstance;
};