import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingOperations, deletePendingOperation, updatePendingOperation } from '@/integrations/indexeddb/pendingOperations';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { invalidateDashboardQueries } from '@/utils/dashboardQueryInvalidation';
import { format } from 'date-fns'; // Pastikan format diimpor

const SYNC_INTERVAL_MS = 1000 * 60; // Sync every 1 minute
const MAX_RETRIES = 5; // Max attempts before giving up on an operation

export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  const performSync = async () => {
    if (isSyncingRef.current) {
      console.log(`[${new Date().toISOString()}] [BackgroundSync] Sync already in progress. Skipping.`);
      return;
    }

    isSyncingRef.current = true;
    console.time(`[BackgroundSync] Total sync duration`);
    console.log(`[${new Date().toISOString()}] [BackgroundSync] Starting background sync...`);

    let operationsSynced = 0;
    let operationsFailed = 0;
    const affectedDates = new Set<string>(); // To collect unique dates affected
    const affectedExpeditions = new Set<string>(); // To collect unique expeditions affected

    try {
      console.time(`[BackgroundSync] Fetching pending operations`);
      const pendingOperations = await getPendingOperations();
      console.timeEnd(`[BackgroundSync] Fetching pending operations`);

      if (pendingOperations.length === 0) {
        console.log(`[${new Date().toISOString()}] [BackgroundSync] No pending operations found. Exiting sync.`);
        return;
      }

      console.log(`[${new Date().toISOString()}] [BackgroundSync] Found ${pendingOperations.length} pending operations.`);

      for (const op of pendingOperations) {
        console.log(`[${new Date().toISOString()}] [BackgroundSync] Processing operation ${op.id} (type: ${op.type}, resi: ${op.payload.resiNumber || 'N/A'})`);
        console.time(`[BackgroundSync] Operation ${op.id} processing time`);
        try {
          let success = false;
          if (op.type === 'batal') {
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Executing 'batal' for resi: ${op.payload.resiNumber}`);
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
            console.log(`[${new Date().toISOString()}] [BackgroundSync] 'batal' operation for ${op.payload.resiNumber} successful.`);
            success = true;
            affectedDates.add(format(new Date(op.payload.createdTimestampFromExpedisi || op.timestamp), 'yyyy-MM-dd'));
            if (op.payload.keteranganValue) affectedExpeditions.add(op.payload.keteranganValue);

          } else if (op.type === 'confirm') {
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Executing 'confirm' for resi: ${op.payload.resiNumber}`);
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
            console.log(`[${new Date().toISOString()}] [BackgroundSync] 'confirm' operation for ${op.payload.resiNumber} successful.`);
            success = true;
            affectedDates.add(format(new Date(op.payload.expedisiCreatedTimestamp || op.timestamp), 'yyyy-MM-dd'));
            if (op.payload.keteranganValue) affectedExpeditions.add(op.payload.keteranganValue);

          } else if (op.type === 'cekfu') {
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Executing 'cekfu' for resi: ${op.payload.resiNumber} to ${op.payload.newCekfuStatus}`);
            const { error } = await supabase
              .from("tbl_expedisi")
              .update({ cekfu: op.payload.newCekfuStatus })
              .eq("resino", op.payload.resiNumber);

            if (error) throw error;
            console.log(`[${new Date().toISOString()}] [BackgroundSync] 'cekfu' operation for ${op.payload.resiNumber} successful.`);
            success = true;
            // For cekfu, we need to find the original created date of the expedisi record
            const { data: expedisiRecord, error: fetchExpedisiError } = await supabase
              .from('tbl_expedisi')
              .select('created, couriername')
              .eq('resino', op.payload.resiNumber)
              .single();
            if (expedisiRecord) {
              affectedDates.add(format(new Date(expedisiRecord.created), 'yyyy-MM-dd'));
              if (expedisiRecord.couriername) affectedExpeditions.add(expedisiRecord.couriername);
            }

          } else if (op.type === 'scan') {
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Executing 'scan' for resi: ${op.payload.resiNumber}`);
            const { resiNumber, selectedKarung, courierNameFromExpedisi } = op.payload;

            // 1. Insert or Update into tbl_resi using upsert
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Upserting tbl_resi for ${resiNumber}`);
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
            console.log(`[${new Date().toISOString()}] [BackgroundSync] tbl_resi upsert for ${resiNumber} successful.`);

            // 2. Update tbl_expedisi cekfu to FALSE (flag dikelola oleh trigger)
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Updating tbl_expedisi cekfu for ${resiNumber}`);
            const { error: expedisiUpdateError } = await supabase
              .from("tbl_expedisi")
              .update({ cekfu: false }) // Hanya update cekfu, flag akan diatur oleh trigger
              .eq("resino", resiNumber);

            if (expedisiUpdateError) {
              if (expedisiUpdateError.code !== 'PGRST116') { // PGRST116 means "no rows found"
                console.warn(`[${new Date().toISOString()}] [BackgroundSync] Warning: Failed to update tbl_expedisi for resi ${resiNumber}: ${expedisiUpdateError.message}`);
              } else {
                console.log(`[${new Date().toISOString()}] [BackgroundSync] tbl_expedisi record for ${resiNumber} not found, no cekfu update needed.`);
              }
            } else {
              console.log(`[${new Date().toISOString()}] [BackgroundSync] tbl_expedisi cekfu update for ${resiNumber} successful.`);
            }

            success = true;
            affectedDates.add(format(new Date(op.timestamp), 'yyyy-MM-dd'));
            if (courierNameFromExpedisi) affectedExpeditions.add(courierNameFromExpedisi);
          }

          if (success) {
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Deleting pending operation ${op.id} from IndexedDB.`);
            await deletePendingOperation(op.id);
            operationsSynced++;
          }
        } catch (error: any) {
          console.error(`[${new Date().toISOString()}] [BackgroundSync] Failed to sync operation ${op.id} (type: ${op.type}, resi: ${op.payload.resiNumber || 'N/A'}):`, error.message);
          op.retries = (op.retries || 0) + 1;
          op.lastAttempt = Date.now();
          if (op.retries >= MAX_RETRIES) {
            console.error(`[${new Date().toISOString()}] [BackgroundSync] Operation ${op.id} reached max retries (${MAX_RETRIES}). Deleting.`);
            showError(`Gagal menyinkronkan resi ${op.payload.resiNumber || 'N/A'} setelah beberapa percobaan. Silakan coba lagi secara manual.`);
            await deletePendingOperation(op.id);
          } else {
            console.log(`[${new Date().toISOString()}] [BackgroundSync] Updating pending operation ${op.id} with new retry count: ${op.retries}.`);
            await updatePendingOperation(op);
          }
          operationsFailed++;
        } finally {
          console.timeEnd(`[BackgroundSync] Operation ${op.id} processing time`);
        }
      }

      if (operationsSynced > 0) {
        console.log(`[${new Date().toISOString()}] [BackgroundSync] ${operationsSynced} operations synced. Invalidating relevant queries.`);
        // Invalidate queries once after all operations are processed
        const today = new Date();
        // Invalidate for each affected date and expedition
        affectedDates.forEach(dateStr => {
          invalidateDashboardQueries(queryClient, new Date(dateStr));
        });
        affectedExpeditions.forEach(expName => {
          invalidateDashboardQueries(queryClient, today, expName); // Pass today's date and specific expedition
        });

        // Also invalidate general queries that might not be date/expedition specific
        queryClient.invalidateQueries({ queryKey: ["historyData"] }); 
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered"] });
        queryClient.invalidateQueries({ queryKey: ["recentResiNumbersForValidation"] });
        queryClient.invalidateQueries({ queryKey: ["karungSummary"] }); // Invalidate all karung summaries
        queryClient.invalidateQueries({ queryKey: ["lastKarung"] }); // Invalidate all last karung
        queryClient.invalidateQueries({ queryKey: ["uniqueExpeditionNames"] }); // Invalidate unique expedition names
        console.log(`[${new Date().toISOString()}] [BackgroundSync] Queries invalidated.`);
      }
      if (operationsFailed > 0) {
        console.warn(`[${new Date().toISOString()}] [BackgroundSync] ${operationsFailed} operations failed to sync.`);
      }

    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] [BackgroundSync] Error fetching pending operations or during main sync loop:`, error.message);
    } finally {
      isSyncingRef.current = false;
      console.log(`[${new Date().toISOString()}] [BackgroundSync] Background sync finished.`);
      console.timeEnd(`[BackgroundSync] Total sync duration`);
    }
  };

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] [BackgroundSync] Setting up initial sync and interval.`);
    performSync();
    syncIntervalRef.current = window.setInterval(performSync, SYNC_INTERVAL_MS);
    return () => {
      if (syncIntervalRef.current) {
        console.log(`[${new Date().toISOString()}] [BackgroundSync] Clearing sync interval.`);
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return { triggerSync: performSync };
};