import { useState, useEffect, useRef } from 'react';
import { getPendingOperations, PendingOperation } from '@/integrations/indexeddb/pendingOperations';
import { initDB } from '@/integrations/indexeddb/db';

const PENDING_OPERATIONS_POLL_INTERVAL = 1000 * 5; // Poll every 5 seconds

export const usePendingOperations = () => {
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const intervalRef = useRef<number | null>(null);

  const fetchOperations = async () => {
    try {
      console.time("[IndexedDB] Fetching all pending operations duration"); // Start timer
      const ops = await getPendingOperations();
      console.timeEnd("[IndexedDB] Fetching all pending operations duration"); // End timer
      setPendingOperations(ops);
    } catch (error) {
      console.error("Error fetching pending operations from IndexedDB:", error);
    }
  };

  useEffect(() => {
    // Initialize DB and fetch operations on mount
    initDB().then(() => {
      fetchOperations();
    });

    // Set up polling for pending operations
    intervalRef.current = window.setInterval(fetchOperations, PENDING_OPERATIONS_POLL_INTERVAL);

    // Clean up interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { pendingOperations, refetchPendingOperations: fetchOperations };
};