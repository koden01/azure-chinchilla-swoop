import { initDB } from './db';

export interface PendingOperation {
  id: string;
  type: 'batal' | 'confirm' | 'cekfu' | 'scan'; // Added 'scan' type
  payload: {
    resiNumber: string;
    createdTimestampFromExpedisi?: string; // For 'batal'
    expedisiCreatedTimestamp?: string; // For 'confirm'
    courierNameFromExpedisi?: string | null; // For 'confirm' and 'scan'
    newCekfuStatus?: boolean; // For 'cekfu'
    selectedKarung?: string; // For 'scan'
    isRescan?: boolean; // NEW: Added for 'scan' type to indicate if it's an update
    keteranganValue?: string | null; // NEW: Added for 'batal' and 'confirm' to explicitly set Keterangan, now allows null
  };
  timestamp: number; // Timestamp when the operation was added
  retries?: number; // Number of retry attempts
  lastAttempt?: number; // Timestamp of the last attempt
}

const STORE_NAME = 'pending-operations';

export const addPendingOperation = async (operation: PendingOperation) => {
  console.log(`[${new Date().toISOString()}] [IndexedDB] Adding pending operation: ${operation.type} for resi ${operation.payload.resiNumber}`);
  console.time(`[IndexedDB] addPendingOperation`); // Fixed timer label
  const db = await initDB(); // initDB now returns existing instance if available
  await db.add(STORE_NAME, { ...operation, retries: 0, lastAttempt: Date.now() });
  console.timeEnd(`[IndexedDB] addPendingOperation`); // Fixed timer label
};

export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  console.log(`[${new Date().toISOString()}] [IndexedDB] Getting all pending operations.`);
  console.time(`[IndexedDB] getPendingOperations`); // Fixed timer label
  const db = await initDB();
  const operations = await db.getAll(STORE_NAME);
  console.timeEnd(`[IndexedDB] getPendingOperations`); // Fixed timer label
  return operations;
};

export const deletePendingOperation = async (id: string) => {
  console.log(`[${new Date().toISOString()}] [IndexedDB] Deleting pending operation with ID: ${id}`);
  console.time(`[IndexedDB] deletePendingOperation`); // Fixed timer label
  const db = await initDB();
  await db.delete(STORE_NAME, id);
  console.timeEnd(`[IndexedDB] deletePendingOperation`); // Fixed timer label
};

export const updatePendingOperation = async (operation: PendingOperation) => {
  console.log(`[${new Date().toISOString()}] [IndexedDB] Updating pending operation with ID: ${operation.id} (retries: ${operation.retries})`);
  console.time(`[IndexedDB] updatePendingOperation`); // Fixed timer label
  const db = await initDB();
  await db.put(STORE_NAME, operation);
  console.timeEnd(`[IndexedDB] updatePendingOperation`); // Fixed timer label
};