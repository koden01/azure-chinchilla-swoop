import { initDB } from './db';

export interface PendingOperation {
  id: string;
  type: 'batal' | 'confirm' | 'cekfu' | 'scan'; // Added 'scan' type
  payload: {
    resiNumber: string;
    createdTimestampFromExpedisi?: string; // For 'batal' and 'confirm'
    courierNameFromExpedisi?: string | null; // For 'confirm' and 'scan'
    expedisiCreatedTimestamp?: string; // For 'confirm'
    newCekfuStatus?: boolean; // For 'cekfu'
    selectedKarung?: string; // For 'scan'
  };
  timestamp: number; // Timestamp when the operation was added
  retries?: number; // Number of retry attempts
  lastAttempt?: number; // Timestamp of the last attempt
}

const STORE_NAME = 'pending-operations';

export const addPendingOperation = async (operation: PendingOperation) => {
  const db = await initDB();
  await db.add(STORE_NAME, { ...operation, retries: 0, lastAttempt: Date.now() });
  console.log(`Operation added to IndexedDB: ${operation.id}`);
};

export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const deletePendingOperation = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
  console.log(`Operation deleted from IndexedDB: ${id}`);
};

export const updatePendingOperation = async (operation: PendingOperation) => {
  const db = await initDB();
  await db.put(STORE_NAME, operation);
  console.log(`Operation updated in IndexedDB: ${operation.id}`);
};