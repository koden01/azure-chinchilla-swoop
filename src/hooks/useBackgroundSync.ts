import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingOperations, deletePendingOperation, updatePendingOperation } from '@/integrations/indexeddb/pendingOperations';
import type { PendingOperation } from '@/integrations/indexeddb/pendingOperations'; // Dipisahkan sebagai impor tipe
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { invalidateDashboardQueries } from '@/utils/dashboardQueryInvalidation';
import { format } from 'date-fns';

const SYNC_INTERVAL_MS = 1000 * 60; // Sync every 1 minute
const MAX_RETRIES = 5; // Max attempts before giving up on an operation

export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false); // To prevent multiple syncs running concurrently

  const performSync = async () => {
    if (isSyncingRef.current) {
      console.log("Sync already in progress, skipping this interval.");
      return;
    }

    isSyncingRef.current = true;
    console.log("Attempting to sync pending operations...");
    let operationsSynced = 0;
    let operationsFailed = 0;

    try {
      const pendingOperations = await getPendingOperations();
      if (pendingOperations.length === 0) {
        console.log("No pending operations to sync.");
        return;
      }

      console.log(`Found ${pendingOperations.length} pending operations.`);

      for (const op of pendingOperations) {
        try {
          let success = false;
          if (op.type === 'batal') {
            // Logic for 'batal' operation
            const { error: resiError } = await supabase
              .from("tbl_resi")
              .update({ schedule: "batal" })
              .eq("Resi", op.payload.resiNumber);

            if (resiError) throw resiError;

            const { error: expedisiError } = await supabase
              .from("tbl_expedisi")
              .update({ flag: "BATAL" }) // Assuming 'BATAL' is a valid flag for cancelled items
              .eq("resino", op.payload.resiNumber);

            if (expedisiError) throw expedisiError;

            success = true;
            console.log(`Successfully synced 'batal' for resi: ${op.payload.resiNumber}`);

          } else if (op.type === 'confirm') {
            // Logic for 'confirm' operation
            const { error: resiError } = await supabase
              .from("tbl_resi")
              .upsert({
                Resi: op.payload.resiNumber,
                nokarung: null, // Assuming no karung for confirmed items if not provided
                created: op.payload.expedisiCreatedTimestamp || new Date().toISOString(), // Use original created date
                Keterangan: op.payload.courierNameFromExpedisi,
                schedule: "ontime", // Confirmed means ontime
              }, { onConflict: 'Resi' });

            if (resiError) throw resiError;

            const { error: expedisiError } = await supabase
              .from("tbl_expedisi")
              .update({ flag: "YES" })
              .eq("resino", op.payload.resiNumber);

            if (expedisiError) throw expedisiError;

            success = true;
            console.log(`Successfully synced 'confirm' for resi: ${op.payload.resiNumber}`);

          } else if (op.type === 'cekfu') {
            // Logic for 'cekfu' toggle
            const { error } = await supabase
              .from("tbl_expedisi")
              .update({ cekfu: op.payload.newCekfuStatus })
              .eq("resino", op.payload.resiNumber);

            if (error) throw error;

            success = true;
            console.log(`Successfully synced 'cekfu' toggle for resi: ${op.payload.resiNumber} to ${op.payload.newCekfuStatus}`);
          }

          if (success) {
            await deletePendingOperation(op.id);
            operationsSynced++;
          }
        } catch (error: any) {
          console.error(`Failed to sync operation ${op.id} (type: ${op.type}, resi: ${op.payload.resiNumber}):`, error.message);
          op.retries = (op.retries || 0) + 1;
          op.lastAttempt = Date.now();
          if (op.retries >= MAX_RETRIES) {
            console.error(`Operation ${op.id} reached max retries. Deleting.`);
            showError(`Gagal menyinkronkan resi ${op.payload.resiNumber} setelah beberapa percobaan. Silakan coba lagi secara manual.`);
          } else {
            await updatePendingOperation(op);
            operationsFailed++;
          }
        }
      }

      if (operationsSynced > 0) {
        showSuccess(`Berhasil menyinkronkan ${operationsSynced} operasi di latar belakang.`);
        // Invalidate relevant queries after successful sync
        const today = new Date();
        const formattedToday = format(today, 'yyyy-MM-dd');
        invalidateDashboardQueries(queryClient, today); // Invalidate for today
        queryClient.invalidateQueries({ queryKey: ["historyData", formattedToday, formattedToday] }); // Invalidate history for today
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] }); // Invalidate the flag NO cache
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered"] }); // Invalidate the 3-day expedisi cache
        queryClient.invalidateQueries({ queryKey: ["recentResiNumbersForValidation"] }); // Invalidate recent resi numbers
      }
      if (operationsFailed > 0) {
        showError(`Gagal menyinkronkan ${operationsFailed} operasi. Akan mencoba lagi nanti.`);
      }

    } catch (error: any) {
      console.error("Error fetching pending operations or during sync process:", error.message);
      showError("Terjadi kesalahan saat mencoba menyinkronkan data.");
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    // Run sync immediately on mount
    performSync();

    // Set up interval sync
    syncIntervalRef.current = window.setInterval(performSync, SYNC_INTERVAL_MS);

    // Clean up interval on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  // Expose a manual trigger if needed, though not strictly required by the prompt
  return { triggerSync: performSync };
};