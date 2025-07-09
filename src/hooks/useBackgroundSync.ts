import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPendingOperations, deletePendingOperation, updatePendingOperation } from '@/integrations/indexeddb/pendingOperations';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { format } from 'date-fns';
import { normalizeExpeditionName } from '@/utils/expeditionUtils';
import { useDebouncedCallback } from './useDebouncedCallback';

const SYNC_INTERVAL_MS = 1000 * 60; // Sync every 1 minute
const MAX_RETRIES = 5; // Max attempts before giving up on an operation
const SYNC_DEBOUNCE_MS = 500; // Debounce sync calls by 500ms

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

// Define the type for tbl_resi records
interface TblResiRecord {
  Resi: string;
  nokarung: string | null;
  created: string; // timestamp with time zone
  Keterangan: string | null;
  schedule: string | null;
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
    
    // Use sets to collect unique affected dates and expeditions for efficient invalidation/refetching
    const affectedDates = new Set<string>(); // Stores 'yyyy-MM-dd'
    const affectedExpeditions = new Set<string>(); // Stores normalized expedition names

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
          let resiCreatedDateForInvalidation: Date | undefined;
          let resiExpeditionForInvalidation: string | undefined;

          if (op.type === 'batal') {
            const { resiNumber, createdTimestampFromExpedisi, keteranganValue, expedisiFlagStatus } = op.payload;

            const { data: existingResi, error: fetchResiError } = await supabase
              .from("tbl_resi")
              .select("created, nokarung, Keterangan")
              .eq("Resi", resiNumber)
              .maybeSingle();

            if (fetchResiError && fetchResiError.code !== 'PGRST116') { // PGRST116 means "no rows found"
              throw fetchResiError;
            }

            const resiToUpsert: Partial<TblResiRecord> = {
              Resi: resiNumber,
              schedule: "batal",
            };

            if (existingResi) {
              resiToUpsert.created = existingResi.created;
              resiToUpsert.nokarung = existingResi.nokarung;
              resiToUpsert.Keterangan = existingResi.Keterangan;
            } else {
              resiToUpsert.created = createdTimestampFromExpedisi || new Date(op.timestamp).toISOString();
              resiToUpsert.nokarung = "0";
              resiToUpsert.Keterangan = keteranganValue;
            }

            const { error: resiUpsertError } = await supabase
              .from("tbl_resi")
              .upsert(resiToUpsert as TblResiRecord, { onConflict: 'Resi', ignoreDuplicates: false });

            if (resiUpsertError) throw resiUpsertError;

            const { error: expedisiUpdateError } = await supabase
              .from("tbl_expedisi")
              .update({ flag: expedisiFlagStatus || 'NO' })
              .eq("resino", resiNumber);

            if (expedisiUpdateError && expedisiUpdateError.code !== 'PGRST116') {
              console.warn(`[BackgroundSync] Warning: Failed to update tbl_expedisi flag for resi ${resiNumber}: ${expedisiUpdateError.message}`);
            }
            success = true;
            resiCreatedDateForInvalidation = new Date(resiToUpsert.created!);
            resiExpeditionForInvalidation = resiToUpsert.Keterangan || undefined;

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
            resiCreatedDateForInvalidation = new Date(op.payload.expedisiCreatedTimestamp || op.timestamp);
            resiExpeditionForInvalidation = op.payload.keteranganValue || op.payload.courierNameFromExpedisi || undefined;

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
              resiCreatedDateForInvalidation = new Date(expedisiRecord[0].created);
              resiExpeditionForInvalidation = expedisiRecord[0].couriername || undefined;
            }

          } else if (op.type === 'scan') {
            const { resiNumber, selectedKarung, courierNameFromExpedisi } = op.payload;

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

            const { error: expedisiUpdateError } = await supabase
              .from("tbl_expedisi")
              .update({ cekfu: false })
              .eq("resino", resiNumber);

            if (expedisiUpdateError && expedisiUpdateError.code !== 'PGRST116') {
              console.warn(`[BackgroundSync] Warning: Failed to update tbl_expedisi for resi ${resiNumber}: ${expedisiUpdateError.message}`);
            }
            success = true;
            resiCreatedDateForInvalidation = new Date(op.timestamp);
            resiExpeditionForInvalidation = courierNameFromExpedisi || undefined;
          }

          if (success) {
            console.log(`[BackgroundSync] Operation ${op.id} successful. Deleting.`);
            await deletePendingOperation(op.id);
            operationsSynced++;
            if (resiCreatedDateForInvalidation) {
              affectedDates.add(format(resiCreatedDateForInvalidation, 'yyyy-MM-dd'));
            }
            if (resiExpeditionForInvalidation) {
              affectedExpeditions.add(normalizeExpeditionName(resiExpeditionForInvalidation) || '');
            }
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
        console.log(`[BackgroundSync] ${operationsSynced} operations synced. Refetching queries.`);
        
        // Always refetch global/unfiltered data that might change
        // Note: allExpedisiDataUnfiltered query key includes formattedToday, so it's date-specific
        queryClient.refetchQueries({ queryKey: ["allExpedisiDataUnfiltered"] }); 
        queryClient.refetchQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.refetchQueries({ queryKey: ["uniqueExpeditionNames"] });
        queryClient.refetchQueries({ queryKey: ["historyData"] }); // History is always affected

        // Invalidate allResiForExpedition to ensure Input page gets fresh 5-day data
        queryClient.invalidateQueries({ queryKey: ["allResiForExpedition"], exact: false });

        // Refetch dashboard summary counts (which are date-specific)
        // and Input page specific counts (which are date and expedition specific)
        affectedDates.forEach(dateStr => {
            const dateObj = new Date(dateStr);
            const dashboardFormattedDate = format(dateObj, "yyyy-MM-dd");
            const dashboardFormattedDateISO = dateObj.toISOString().split('T')[0];

            // Dashboard summary queries
            queryClient.refetchQueries({ queryKey: ["transaksiHariIni", dashboardFormattedDate] });
            queryClient.refetchQueries({ queryKey: ["totalScan", dashboardFormattedDateISO] });
            queryClient.refetchQueries({ queryKey: ["idRekCount", dashboardFormattedDateISO] });
            queryClient.refetchQueries({ queryKey: ["belumKirim", dashboardFormattedDate] });
            queryClient.refetchQueries({ queryKey: ["scanFollowupLateCount", dashboardFormattedDateISO] });
            queryClient.refetchQueries({ queryKey: ["batalCount", dashboardFormattedDateISO] });
            queryClient.refetchQueries({ queryKey: ["followUpData", dashboardFormattedDate] });
            queryClient.refetchQueries({ queryKey: ["expedisiDataForSelectedDate", dashboardFormattedDate] });
            queryClient.refetchQueries({ queryKey: ["followUpFlagNoCount", dashboardFormattedDate] }); 

            // Input page specific queries (date-specific, but also expedition-specific)
            affectedExpeditions.forEach(expName => {
                const normalizedExpName = normalizeExpeditionName(expName);
                if (normalizedExpName) {
                    queryClient.refetchQueries({ queryKey: ["karungSummary", normalizedExpName, dashboardFormattedDate] });
                    queryClient.refetchQueries({ queryKey: ["totalExpeditionItems", normalizedExpName, dashboardFormattedDate] });
                    queryClient.refetchQueries({ queryKey: ["remainingExpeditionItems", normalizedExpName, dashboardFormattedDate] });
                    // idExpeditionScanCount is already covered by the general dashboard refetch if expName is 'ID'
                    if (normalizedExpName === 'ID') {
                        queryClient.refetchQueries({ queryKey: ["idExpeditionScanCount", dashboardFormattedDate] });
                    }
                }
            });
            // Also refetch the "all karung summaries" for the dashboard, as it aggregates across all expeditions for a date
            queryClient.refetchQueries({ queryKey: ["allKarungSummaries", dashboardFormattedDate] });
        });
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

  // Debounce the performSync function
  const debouncedPerformSync = useDebouncedCallback(performSync, SYNC_DEBOUNCE_MS);

  useEffect(() => {
    console.log(`[BackgroundSync] Initializing sync.`);
    // Initial sync on mount
    debouncedPerformSync();
    // Set up interval for periodic sync
    syncIntervalRef.current = window.setInterval(debouncedPerformSync, SYNC_INTERVAL_MS);
    return () => {
      if (syncIntervalRef.current) {
        console.log(`[BackgroundSync] Clearing sync interval.`);
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [debouncedPerformSync]);

  return { triggerSync: debouncedPerformSync };
};