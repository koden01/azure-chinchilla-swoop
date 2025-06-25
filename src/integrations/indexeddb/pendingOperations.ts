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
    expedisiFlagStatus?: string; // NEW: Added for 'batal' to explicitly set flag in tbl_expedisi
  };
  timestamp: number; // Timestamp when the operation was added
  retries?: number; // Number of retry attempts
  lastAttempt?: number; // Timestamp of the last attempt
}

const STORE_NAME = 'pending-operations';

export const addPendingOperation = async (operation: PendingOperation) => {
  console.log(`[IndexedDB] Adding operation: ${operation.type} for resi ${operation.payload.resiNumber}`);
  const db = await initDB();
  await db.add(STORE_NAME, { ...operation, retries: 0, lastAttempt: Date.now() });
};

export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  // console.log(`[IndexedDB] Fetching all pending operations.`); // Log ini dihapus karena redundan
  const db = await initDB();
  const operations = await db.getAll(STORE_NAME);
  return operations;
};

export const deletePendingOperation = async (id: string) => {
  console.log(`[IndexedDB] Deleting operation ID: ${id}`);
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};

export const updatePendingOperation = async (operation: PendingOperation) => {
  console.log(`[IndexedDB] Updating operation ID: ${operation.id} (retries: ${operation.retries})`);
  const db = await initDB();
  await db.put(STORE_NAME, operation);
};