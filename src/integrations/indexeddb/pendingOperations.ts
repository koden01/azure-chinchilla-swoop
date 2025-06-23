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
  const timerLabel = `[IndexedDB] addPendingOperation:${operation.id}`;
  console.log(`[${new Date().toISOString()}] [IndexedDB] Adding pending operation: ${operation.type} for resi ${operation.payload.resiNumber}`);
  console.time(timerLabel);
  const db = await initDB(); // initDB now returns existing instance if available
  await db.add(STORE_NAME, { ...operation, retries: 0, lastAttempt: Date.now() });
  console.timeEnd(timerLabel);
};

export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  const timerLabel = `[IndexedDB] getPendingOperations`;
  console.log(`[${new Date().toISOString()}] [IndexedDB] Getting all pending operations.`);
  console.time(timerLabel);
  const db = await initDB();
  const operations = await db.getAll(STORE_NAME);
  console.timeEnd(timerLabel);
  return operations;
};

export const deletePendingOperation = async (id: string) => {
  const timerLabel = `[IndexedDB] deletePendingOperation:${id}`;
  console.log(`[${new Date().toISOString()}] [IndexedDB] Deleting pending operation with ID: ${id}`);
  console.time(timerLabel);
  const db = await initDB();
  await db.delete(STORE_NAME, id);
  console.timeEnd(timerLabel);
};

export const updatePendingOperation = async (operation: PendingOperation) => {
  const timerLabel = `[IndexedDB] updatePendingOperation:${operation.id}`;
  console.log(`[${new Date().toISOString()}] [IndexedDB] Updating pending operation with ID: ${operation.id} (retries: ${operation.retries})`);
  console.time(timerLabel);
  const db = await initDB();
  await db.put(STORE_NAME, operation);
  console.timeEnd(timerLabel);
};