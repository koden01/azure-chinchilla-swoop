import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingOperations, deletePendingOperation, updatePendingOperation } from '@/integrations/indexeddb/pendingOperations';
import { supabase } from '@/integrations/supabase/client';
import { showError } => '@/utils/toast';
import { invalidateDashboardQueries } from '@/utils/dashboardQueryInvalidation';
import { format } from 'date-fns';

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
            const { error: resiError } = await supabase
              .from("tbl_resi")
              .update({ schedule: "batal" })
              .eq("Resi", op.payload.resiNumber);

            if (resiError) throw resiError;

            const { error: expedisiError } = await supabase
              .from("tbl_expedisi")
              .update({ flag: "BATAL" })
              .eq("resino", op.payload.resiNumber);

            if (expedisiError) throw expedisiError;

            success = true;
            console.log(`Successfully synced 'batal' for resi: ${op.payload.resiNumber}`);

          } else if (op.type === 'confirm') {
            const { error: resiError } = await supabase
              .from("tbl_resi")
              .upsert({
                Resi: op.payload.resiNumber,
                nokarung: null,
                created: op.payload.expedisiCreatedTimestamp || new Date().toISOString(),
                Keterangan: op.payload.courierNameFromExpedisi,
                schedule: "ontime", // This should be fine as it's a 'confirm' action
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
                created: new Date(op.timestamp).toISOString(), // Use operation timestamp for consistency
                Keterangan: courierNameFromExpedisi,
                // schedule: "ontime", // REMOVED: Let DB trigger handle this
              }, { onConflict: 'Resi', ignoreDuplicates: false }); // Use onConflict to update if exists

            if (resiUpsertError) {
              throw resiUpsertError;
            }

            // 2. Update tbl_expedisi flag to 'YES' and cekfu to FALSE
            const { error: expedisiUpdateError } = await supabase
              .from("tbl_expedisi")
              .update({ flag: "YES", cekfu: false }) // Set cekfu to false on scan
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
            operationsFailed++;
          }
        }
      }

      if (operationsSynced > 0) {
        const today = new Date();
        const formattedToday = format(today, 'yyyy-MM-dd');
        invalidateDashboardQueries(queryClient, today);
        queryClient.invalidateQueries({ queryKey: ["historyData", formattedToday, formattedToday] });
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