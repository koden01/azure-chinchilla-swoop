import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingOperations, deletePendingOperation, updatePendingOperation } from '@/integrations/indexeddb/pendingOperations';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { invalidateDashboardQueries } from '@/utils/dashboardQueryInvalidation';
import { format } from 'date-fns';

const SYNC_INTERVAL_MS = 1000 * 60; // Sync every 1 minute
const MAX_RETRIES = 5; // Max attempts before giving up on an operation

// Define the type for tbl_expedisi records
interface TblExpedisiRecord {
  resino: string;
  orderno: string | null;
  chanelsales: string | null;
  couriername: string | null;
  created: string; // timestamp without time zone
  flag: string | null;
  datetrans: string | null;
  cekfu: boolean | null;
}

export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  const performSync = async () => {
    if (isSyncingRef.current) {
      console.log(`[BackgroundSync] Sync in progress. Skipping.`);
      return;
    }

    isSyncingRef.current = true;
    console.log(`[BackgroundSync] Starting sync.`);

    let operationsSynced = 0;
    let operationsFailed = 0;
    const affectedDates = new Set<string>();
    const affectedExpeditions = new Set<string>();

    try {
      const pendingOperations = await getPendingOperations();

      if (pendingOperations.length === 0) {
        console.log(`[BackgroundSync] No pending operations. Exiting sync.`);
        return;
      }

      console.log(`[BackgroundSync] Found ${pendingOperations.length} pending operations.`);

      for (const op of pendingOperations) {
        console.log(`[BackgroundSync] Processing ${op.type} for resi: ${op.payload.resiNumber || 'N/A'}`);
        try {
          let success = false;
          if (op.type === 'batal') {
            const { error: resiUpsertError } = await supabase
              .from("tbl_resi")
              .upsert({
                Resi: op.payload.resiNumber,
                nokarung: "0",
                created: op.payload.createdTimestampFromExpedisi || new Date(op.timestamp).toISOString(),
                Keterangan: op.payload.keteranganValue,
                schedule: "batal",
              }, { onConflict: 'Resi', ignoreDuplicates: false });

            if (resiUpsertError) throw resiUpsertError;
            success = true;
            affectedDates.add(format(new Date(op.payload.createdTimestampFromExpedisi || op.timestamp), 'yyyy-MM-dd'));
            if (op.payload.keteranganValue) affectedExpeditions.add(op.payload.keteranganValue);

          } else if (op.type === 'confirm') {
            const { error: resiUpsertError } = await supabase
              .from("tbl_resi")
              .upsert({
                Resi: op.payload.resiNumber,
                nokarung: "0",
                created: op.payload.expedisiCreatedTimestamp || new Date(op.timestamp).toISOString(),
                Keterangan: op.payload.keteranganValue || op.payload.courierNameFromExpedisi,
                schedule: "ontime",
              }, { onConflict: 'Resi', ignoreDuplicates: false });

            if (resiUpsertError) throw resiUpsertError;
            success = true;
            affectedDates.add(format(new Date(op.payload.expedisiCreatedTimestamp || op.timestamp), 'yyyy-MM-dd'));
            if (op.payload.keteranganValue) affectedExpeditions.add(op.payload.keteranganValue);

          } else if (op.type === 'cekfu') {
            const { data: expedisiRecord, error: _fetchExpedisiError } = await supabase
              .from("tbl_expedisi")
              .update({ cekfu: op.payload.newCekfuStatus })
              .eq("resino", op.payload.resiNumber)
              .select()
              .returns<TblExpedisiRecord[]>();

            if (_fetchExpedisiError) throw _fetchExpedisiError;
            success = true;
            if (expedisiRecord && expedisiRecord.length > 0) {
              affectedDates.add(format(new Date(expedisiRecord[0].created), 'yyyy-MM-dd'));
              if (expedisiRecord[0].couriername) affectedExpeditions.add(expedisiRecord[0].couriername);
            }

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
              .update({ cekfu: false })
              .eq("resino", resiNumber);

            if (expedisiUpdateError && expedisiUpdateError.code !== 'PGRST116') { // PGRST116 means "no rows found"
              console.warn(`[BackgroundSync] Warning: Failed to update tbl_expedisi for resi ${resiNumber}: ${expedisiUpdateError.message}`);
            }
            success = true;
            affectedDates.add(format(new Date(op.timestamp), 'yyyy-MM-dd'));
            if (courierNameFromExpedisi) affectedExpeditions.add(courierNameFromExpedisi);
          }

          if (success) {
            console.log(`[BackgroundSync] Operation ${op.id} successful. Deleting.`);
            await deletePendingOperation(op.id);
            operationsSynced++;
          }
        } catch (error: any) {
          console.error(`[BackgroundSync] Failed to sync operation ${op.id} (type: ${op.type}, resi: ${op.payload.resiNumber || 'N/A'}):`, error.message);
          op.retries = (op.retries || 0) + 1;
          op.lastAttempt = Date.now();
          if (op.retries >= MAX_RETRIES) {
            console.error(`[BackgroundSync] Operation ${op.id} reached max retries (${MAX_RETRIES}). Deleting.`);
            showError(`Gagal menyinkronkan resi ${op.payload.resiNumber || 'N/A'} setelah beberapa percobaan. Silakan coba lagi secara manual.`);
            await deletePendingOperation(op.id);
          } else {
            console.log(`[BackgroundSync] Operation ${op.id} failed. Retrying (${op.retries}/${MAX_RETRIES}).`);
            await updatePendingOperation(op);
          }
          operationsFailed++;
        }
      }

      if (operationsSynced > 0) {
        console.log(`[BackgroundSync] ${operationsSynced} operations synced. Invalidating queries.`);
        const today = new Date();
        affectedDates.forEach(dateStr => {
          invalidateDashboardQueries(queryClient, new Date(dateStr));
        });
        affectedExpeditions.forEach(expName => {
          invalidateDashboardQueries(queryClient, today, expName);
        });

        queryClient.invalidateQueries({ queryKey: ["historyData"] });
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered"] });
        queryClient.invalidateQueries({ queryKey: ["recentScannedResiNumbers"] });
        queryClient.invalidateQueries({ queryKey: ["karungSummary"] });
        queryClient.invalidateQueries({ queryKey: ["lastKarung"] });
        queryClient.invalidateQueries({ queryKey: ["uniqueExpeditionNames"] });
      }
      if (operationsFailed > 0) {
        console.warn(`[BackgroundSync] ${operationsFailed} operations failed to sync.`);
      }

    } catch (error: any) {
      console.error(`[BackgroundSync] Error during sync:`, error.message);
    } finally {
      isSyncingRef.current = false;
      console.log(`[BackgroundSync] Sync finished.`);
    }
  };

  useEffect(() => {
    console.log(`[BackgroundSync] Initializing sync.`);
    performSync();
    syncIntervalRef.current = window.setInterval(performSync, SYNC_INTERVAL_MS);
    return () => {
      if (syncIntervalRef.current) {
        console.log(`[BackgroundSync] Clearing sync interval.`);
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return { triggerSync: performSync };
};