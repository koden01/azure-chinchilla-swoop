import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { useBackgroundSync } from "./useBackgroundSync";

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null; // Changed to Keterangan to match tbl_resi
  schedule: string | null;
  optimisticId?: string;
}

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string; // This prop is the formatted date for today
  allExpedisiDataUnfiltered: Map<string, any> | undefined;
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { triggerSync } = useBackgroundSync();

  // Calculate date range for 2 days back for local validation data
  const today = new Date();
  // Mengubah menjadi hanya hari ini dan kemarin
  const yesterday = subDays(today, 1);
  const yesterdayFormatted = format(yesterday, "yyyy-MM-dd");
  // const endOfTodayFormatted = format(today, "yyyy-MM-dd"); // Dihapus karena tidak terpakai

  // Query to fetch tbl_resi data for the last 2 days for local duplicate validation
  // Now returns a Set<string> for O(1) lookups
  const { data: recentResiNumbersForValidation, isLoading: isLoadingRecentResiNumbersForValidation } = useQuery<Set<string>>({
    queryKey: ["recentResiNumbersForValidation", yesterdayFormatted, formattedDate],
    queryFn: async () => {
      console.log(`[${new Date().toISOString()}] [useResiScanner] Fetching recentResiNumbersForValidation...`);
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // dateFilterColumn
        yesterday, // selectedStartDate
        today, // selectedEndDate (use 'today' to include all of today)
        "Resi" // Only select the Resi column
      );
      const resiSet = new Set(data.map((item: { Resi: string }) => item.Resi.toLowerCase().trim()));
      console.log(`[${new Date().toISOString()}] [useResiScanner] Finished fetching recentResiNumbersForValidation. Count: ${resiSet.size}`);
      return resiSet;
    },
    staleTime: 1000 * 60 * 60, // Increased to 1 hour for better performance
    gcTime: 1000 * 60 * 60 * 24 * 2, // Garbage collect after 2 days
    enabled: true, // Always enabled for local validation
  });

  // NEW: Query to fetch ALL tbl_expedisi data with flag = 'NO' for comprehensive local validation
  const { data: allFlagNoExpedisiData, isLoading: isLoadingAllFlagNoExpedisiData } = useQuery<Map<string, any>>({
    queryKey: ["allFlagNoExpedisiData"],
    queryFn: async () => {
      console.log(`[${new Date().toISOString()}] [useResiScanner] Fetching allFlagNoExpedisiData...`);
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        undefined, // No date filter
        undefined, // No start date
        undefined, // No end date
        "*", // Select all columns needed for validation
        (query) => query.eq("flag", "NO") // Add flag filter
      );
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      console.log(`[${new Date().toISOString()}] [useResiScanner] Finished fetching allFlagNoExpedisiData. Count: ${expedisiMap.size}`);
      return expedisiMap;
    },
    staleTime: 1000 * 60 * 60 * 4, // Increased to 4 hours
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
    enabled: true, // Always enabled
  });

  const lastOptimisticIdRef = React.useRef<string | null>(null);

  const keepFocus = () => {
    setTimeout(() => {
      if (resiInputRef.current) {
        resiInputRef.current.focus();
      }
    }, 0);
  };

  const validateInput = (resi: string) => {
    if (!resi) {
      showError("Nomor resi tidak boleh kosong.");
      try {
        beepFailure.play();
      } catch (e) {
        console.error("Error playing beepFailure:", e);
      }
      console.log(`[${new Date().toISOString()}] [useResiScanner] Validation failed: Empty resi.`);
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Mohon pilih Expedisi dan No Karung terlebih dahulu.");
      try {
        beepFailure.play();
      } catch (e) {
        console.error("Error playing beepFailure:", e);
      }
      console.log(`[${new Date().toISOString()}] [useResiScanner] Validation failed: Expedition or Karung not selected.`);
      return false;
    }
    console.log(`[${new Date().toISOString()}] [useResiScanner] Input validation passed.`);
    return true;
  };

  const handleScanResi = async () => {
    console.time("[useResiScanner] handleScanResi execution time");
    dismissToast();
    const currentResi = resiNumber.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim();
    setResiNumber("");

    console.log(`[${new Date().toISOString()}] [useResiScanner] Starting scan for resi: ${currentResi}`);

    if (!validateInput(currentResi)) {
      setIsProcessing(false);
      keepFocus();
      console.timeEnd("[useResiScanner] handleScanResi execution time");
      return;
    }

    setIsProcessing(true);

    // Query key for the input page's display (allResiForExpedition)
    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, yesterdayFormatted, formattedDate];
    // const queryKeyForKarungSummary = ["karungSummary", expedition, formattedDate]; // Dihapus karena tidak terpakai


    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierName: string | null = null;
    let expedisiRecord: any = null;

    try {
      console.time("[useResiScanner] Validation checks");
      // 1. Local Duplicate Check (for recent scans)
      console.log(`[${new Date().toISOString()}] [useResiScanner] Performing local duplicate check...`);
      if (recentResiNumbersForValidation?.has(normalizedCurrentResi)) {
        // Fetch the created date for the duplicate resi
        const { data: existingResiDetail, error: _detailError } = await supabase
          .from("tbl_resi")
          .select("created")
          .eq("Resi", currentResi)
          .maybeSingle();

        let createdDateStr = "";
        if (existingResiDetail && existingResiDetail.created) {
          createdDateStr = format(new Date(existingResiDetail.created), "dd/MM/yyyy HH:mm");
        }

        validationStatus = 'DUPLICATE_RESI';
        validationMessage = `DOUBLE! Resi ini sudah discan ${createdDateStr}.`;
        console.log(`[${new Date().toISOString()}] [useResiScanner] Local duplicate found.`);
      }

      // 2. Database Duplicate Check (for older scans, if not found locally)
      if (validationStatus === 'OK') {
        console.log(`[${new Date().toISOString()}] [useResiScanner] Performing database duplicate check...`);
        const { data: existingResiInDb, error: dbCheckError } = await supabase
          .from("tbl_resi")
          .select("Resi, created")
          .eq("Resi", currentResi)
          .maybeSingle();

        if (dbCheckError && dbCheckError.code !== 'PGRST116') {
          throw dbCheckError;
        }

        if (existingResiInDb) {
          let createdDateStr = "";
          if (existingResiInDb.created) {
            createdDateStr = format(new Date(existingResiInDb.created), "dd/MM/yyyy HH:mm");
          }
          validationStatus = 'DUPLICATE_RESI';
          validationMessage = `DOUBLE! Resi ini sudah discan ${createdDateStr}.`;
          console.log(`[${new Date().toISOString()}] [useResiScanner] Database duplicate found.`);
        }
      }

      // Only proceed with further checks if not already a duplicate
      if (validationStatus === 'OK') {
        // 3. Attempt to find expedisiRecord from caches or direct RPC call
        console.log(`[${new Date().toISOString()}] [useResiScanner] Checking expedisi record in caches...`);
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        if (!expedisiRecord) {
            console.log(`[${new Date().toISOString()}] [useResiScanner] Expedisi record not in cache, fetching directly via RPC...`);
            const { data: directExpedisiDataArray, error: directExpedisiError } = await supabase.rpc("get_expedisi_by_resino_case_insensitive", {
              p_resino: currentResi,
            });

            if (directExpedisiError) {
                console.error(`[${new Date().toISOString()}] [useResiScanner] Error during direct fetch via RPC:`, directExpedisiError);
                throw directExpedisiError;
            }
            
            if (directExpedisiDataArray && directExpedisiDataArray.length > 0) {
                expedisiRecord = directExpedisiDataArray[0];
                console.log(`[${new Date().toISOString()}] [useResiScanner] Expedisi record fetched directly.`);
                // No need to update allExpedisiDataUnfiltered cache here. Let background sync handle it.
            } else {
              console.log(`[${new Date().toISOString()}] [useResiScanner] No expedisi record found directly via RPC.`);
            }
        } else {
          console.log(`[${new Date().toISOString()}] [useResiScanner] Expedisi record found in cache.`);
        }
      }

      // 4. Determine actualCourierName and final validationStatus based on `expedition` and `expedisiRecord` presence
      if (validationStatus === 'OK') {
        console.log(`[${new Date().toISOString()}] [useResiScanner] Determining courier name and final validation status...`);
        if (expedition === 'ID') {
          if (expedisiRecord) {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier === 'ID') {
              actualCourierName = 'ID';
              console.log(`[${new Date().toISOString()}] [useResiScanner] Matched to ID (from expedisi record).`);
            } else {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`;
              console.log(`[${new Date().toISOString()}] [useResiScanner] Mismatch: Expected ID, got ${expedisiRecord.couriername}.`);
            }
          } else {
            actualCourierName = 'ID_REKOMENDASI';
            console.log(`[${new Date().toISOString()}] [useResiScanner] Resi not found in expedisi, treating as ID_REKOMENDASI.`);
          }
        } else { // For non-ID expeditions (JNE, SPX, etc.)
          if (!expedisiRecord) {
            // If expedition is NOT 'ID' and resi was NOT found in tbl_expedisi, then it's a true NOT_FOUND_EXPEDISI
            validationStatus = 'NOT_FOUND_EXPEDISI';
            validationMessage = 'Data tidak ada di database ekspedisi.';
            console.log(`[${new Date().toISOString()}] [useResiScanner] Not found in expedisi for non-ID expedition.`);
          } else {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier !== expedition.toUpperCase()) {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`;
              console.log(`[${new Date().toISOString()}] [useResiScanner] Mismatch: Expected ${expedition}, got ${expedisiRecord.couriername}.`);
            } else {
              actualCourierName = expedisiRecord.couriername;
              console.log(`[${new Date().toISOString()}] [useResiScanner] Matched to ${expedition}.`);
            }
          }
        }
      }
      console.timeEnd("[useResiScanner] Validation checks");

      // --- FINAL ERROR HANDLING BLOCK ---
      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        try {
          switch (validationStatus) {
            case 'NOT_FOUND_EXPEDISI':
            case 'MISMATCH_EXPEDISI':
              beepFailure.play();
              break;
            case 'DUPLICATE_RESI':
              beepDouble.play();
              break;
            default:
              beepFailure.play(); // Fallback
              break;
          }
        } catch (e) {
          console.error(`[${new Date().toISOString()}] [useResiScanner] Error playing beep sound:`, e);
        }
        setIsProcessing(false);
        keepFocus();
        console.timeEnd("[useResiScanner] handleScanResi execution time");
        return; // Exit after handling error
      }

      // --- If all OK, proceed with optimistic update and saving to IndexedDB ---
      console.log(`[${new Date().toISOString()}] [useResiScanner] Validation OK. Proceeding with optimistic updates and IndexedDB.`);
      const newResiEntry: ResiExpedisiData = {
        Resi: currentResi,
        nokarung: selectedKarung,
        created: new Date().toISOString(),
        Keterangan: actualCourierName, // Use validated courier name
        schedule: "ontime", // Added schedule property
        optimisticId: currentOptimisticId,
      };

      console.time("[useResiScanner] Optimistic UI updates");
      // Optimistic UI update for the input page's display (allResiForExpedition)
      queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
        const newData = [...(oldData || []), newResiEntry];
        return newData;
      });
      // Optimistik update for recentResiNumbersForValidation (Set)
      queryClient.setQueryData(["recentResiNumbersForValidation", yesterdayFormatted, formattedDate], (oldSet: Set<string> | undefined) => {
        const newSet = oldSet ? new Set(oldSet) : new Set();
        newSet.add(normalizedCurrentResi);
        return newSet;
      });
      // REMOVED: Optimistic update for allExpedisiDataUnfiltered cache
      // REMOVED: Optimistic update for allFlagNoExpedisiData cache
      // REMOVED: Optimistic update for KARUNG SUMMARY (will be handled by background sync invalidation)
      console.timeEnd("[useResiScanner] Optimistic UI updates");

      lastOptimisticIdRef.current = currentOptimisticId;
      
      console.time("[useResiScanner] Add to IndexedDB");
      // Add operation to IndexedDB for background sync
      await addPendingOperation({
        id: `scan-${currentResi}-${Date.now()}`,
        type: "scan",
        payload: {
          resiNumber: currentResi,
          selectedKarung: selectedKarung,
          courierNameFromExpedisi: actualCourierName,
        },
        timestamp: Date.now(),
      });
      console.timeEnd("[useResiScanner] Add to IndexedDB");

      showSuccess(`Resi ${currentResi} Berhasil`);
      try {
        beepSuccess.play();
      } catch (e) {
        console.error(`[${new Date().toISOString()}] [useResiScanner] Error playing beepSuccess:`, e);
      }

      // Clear the optimistic ref as the operation was successfully added to IndexedDB
      lastOptimisticIdRef.current = null;
      
      console.log(`[${new Date().toISOString()}] [useResiScanner] Triggering background sync.`);
      triggerSync();

    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] [useResiScanner] Error during resi input (before IndexedDB save or during optimistic update):`, error);

      let errorMessage = "Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.";
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        errorMessage = "Gagal terhubung ke server. Periksa koneksi internet Anda atau coba lagi nanti. Pastikan variabel lingkungan Supabase Anda sudah benar.";
      } else if (error.message) {
        errorMessage = `Terjadi kesalahan: ${error.message}`;
      } else if (error.code) {
        errorMessage = `Terjadi kesalahan Supabase (${error.code}): ${error.message || error.details}`;
      }
      showError(errorMessage);
      try {
        beepFailure.play();
      } catch (e) {
        console.error(`[${new Date().toISOString()}] [useResiScanner] Error playing beepFailure:`, e);
      }

      console.time("[useResiScanner] Revert optimistic updates on error");
      // Revert optimistic update on error
      if (lastOptimisticIdRef.current) {
          queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
              const revertedData = (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
              return revertedData;
          });
          // Revert optimistic update for recentResiNumbersForValidation (Set)
          queryClient.setQueryData(["recentResiNumbersForValidation", yesterdayFormatted, formattedDate], (oldSet: Set<string> | undefined) => {
            const newSet = oldSet ? new Set(oldSet) : new Set();
            newSet.delete(normalizedCurrentResi);
            return newSet;
          });
          // REMOVED: Revert optimistic update for allExpedisiDataUnfiltered cache
          // REMOVED: Revert optimistic update for allFlagNoExpedisiData cache
          // REMOVED: Revert optimistic update for KARUNG SUMMARY
      }
      console.timeEnd("[useResiScanner] Revert optimistic updates on error");
      lastOptimisticIdRef.current = null;
    } finally {
      setIsProcessing(false);
      keepFocus();
      console.timeEnd("[useResiScanner] handleScanResi execution time");
    }
  };

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing,
    isLoadingRecentResiNumbersForValidation,
    isLoadingAllFlagNoExpedisiData,
  };
};