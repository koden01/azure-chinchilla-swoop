import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingOperations, deletePendingOperation, updatePendingOperation } from '@/integrations/indexeddb/pendingOperations';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { invalidateDashboardQueries } from '@/utils/dashboardQueryInvalidation';
// Removed unused import: format

const SYNC_INTERVAL_MS = 1000 * 60; // Sync every 1 minute
const MAX_RETRIES = 5; // Max attempts before giving up on an operation

export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

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
            // Menggunakan upsert untuk memastikan resi ada dan memperbarui schedule, created, dan Keterangan
            const { error: resiUpsertError } = await supabase
              .from("tbl_resi")
              .upsert({
                Resi: op.payload.resiNumber,
                nokarung: "0", // Set nokarung to "0" for batal
                created: op.payload.createdTimestampFromExpedisi || new Date(op.timestamp).toISOString(), // Gunakan created dari expedisi
                Keterangan: op.payload.keteranganValue, // Set Keterangan menjadi nama ekspedisi asli
                schedule: "batal", // Tetap set schedule ke "batal"
              }, { onConflict: 'Resi', ignoreDuplicates: false });

            if (resiUpsertError) throw resiUpsertError;

            success = true;
            console.log(`Successfully synced 'batal' for resi: ${op.payload.resiNumber}`);

          } else if (op.type === 'confirm') {
            const { error: resiUpsertError } = await supabase
              .from("tbl_resi")
              .upsert({
                Resi: op.payload.resiNumber,
                nokarung: "0", // Set nokarung to "0" for confirm
                created: op.payload.expedisiCreatedTimestamp || new Date(op.timestamp).toISOString(), // Gunakan created dari expedisi
                Keterangan: op.payload.keteranganValue || op.payload.courierNameFromExpedisi, // Gunakan Keterangan dari payload atau courierName
                schedule: "ontime",
              }, { onConflict: 'Resi', ignoreDuplicates: false });

            if (resiUpsertError) throw resiUpsertError;

            success = true;
            console.log(`Successfully synced 'confirm' for resi: ${op.payload.resiNumber}`);

          } else if (op.type === 'cekfu') {
            const { error } = await supabase
              .from("tbl_expedisi")
              .update({ cekfu: op.payload.newCekfuStatus })
              .eq("resino", op.payload.resiNumber);

            if (error) throw error;

            success = true;
            console.log(`Successfully synced 'cekfu' toggle for resi: ${op.payload.resiNumber} to ${op.payload.newCekfuStatus}`);
          } else if (op.type === 'scan') {
            const { resiNumber, selectedKarung, courierNameFromExpedisi } = op.payload;

            // 1. Insert or Update into tbl_resi using upsert
            const { error: resiUpsertError } = await supabase
              .from("tbl_resi")
              .upsert({
                Resi: resiNumber,
                nokarung: selectedKarung,
                created: new Date(op.timestamp).toISOString(),
                Keterangan: courierNameFromExpedisi,
              }, { onConflict: 'Resi', ignoreDuplicates: false });

            if (resiUpsertError) {
              throw resiUpsertError;
            }

            // 2. Update tbl_expedisi cekfu to FALSE (flag dikelola oleh trigger)
            const { error: expedisiUpdateError } = await supabase
              .from("tbl_expedisi")
              .update({ cekfu: false }) // Hanya update cekfu, flag akan diatur oleh trigger
              .eq("resino", resiNumber);

            if (expedisiUpdateError) {
              if (expedisiUpdateError.code !== 'PGRST116') { // PGRST116 means "no rows found"
                console.warn(`Warning: Failed to update tbl_expedisi for resi ${resiNumber}: ${expedisiUpdateError.message}`);
              }
            }

            success = true;
            console.log(`Successfully synced 'scan' for resi: ${resiNumber}`);
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
            await deletePendingOperation(op.id);
          } else {
            await updatePendingOperation(op);
          }
        }
      }

      if (operationsSynced > 0) {
        const today = new Date();
        invalidateDashboardQueries(queryClient, today);
        queryClient.invalidateQueries({ queryKey: ["historyData"] }); 
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered"] });
        queryClient.invalidateQueries({ queryKey: ["recentResiNumbersForValidation"] });
        queryClient.refetchQueries({ queryKey: ["karungSummary"] });
        queryClient.refetchQueries({ queryKey: ["lastKarung"] });
      }
      if (operationsFailed > 0) {
        // showError(`Gagal menyinkronkan ${operationsFailed} operasi. Akan mencoba lagi nanti.`);
      }

    } catch (error: any) {
      console.error("Error fetching pending operations or during sync process:", error.message);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    performSync();
    syncIntervalRef.current = window.setInterval(performSync, SYNC_INTERVAL_MS);
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return { triggerSync: performSync };
};