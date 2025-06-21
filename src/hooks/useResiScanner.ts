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
  formattedDate: string;
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
  const twoDaysAgo = subDays(today, 2);
  const twoDaysAgoFormatted = format(twoDaysAgo, "yyyy-MM-dd");
  const endOfTodayFormatted = format(today, "yyyy-MM-dd");

  // Query to fetch tbl_resi data for the last 2 days for local duplicate validation
  // Now returns a Set<string> for O(1) lookups
  const { data: recentResiNumbersForValidation, isLoading: isLoadingRecentResiNumbersForValidation } = useQuery<Set<string>>({
    queryKey: ["recentResiNumbersForValidation", twoDaysAgoFormatted, formattedDate],
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // dateFilterColumn
        twoDaysAgo, // selectedStartDate
        today, // selectedEndDate (use 'today' to include all of today)
        "Resi" // Only select the Resi column
      );
      const resiSet = new Set(data.map((item: { Resi: string }) => item.Resi.toLowerCase().trim()));
      // console.log(`[useResiScanner] Fetched recentResiNumbersForValidation (initial/refetch):`, resiSet); // Removed log
      return resiSet;
    },
    staleTime: 1000 * 60 * 10, // Keep this data fresh for 10 minutes
    gcTime: 1000 * 60 * 60 * 24 * 2, // Garbage collect after 2 days
    enabled: true, // Always enabled for local validation
  });

  // NEW: Query to fetch ALL tbl_expedisi data with flag = 'NO' for comprehensive local validation
  const { data: allFlagNoExpedisiData, isLoading: isLoadingAllFlagNoExpedisiData } = useQuery<Map<string, any>>({
    queryKey: ["allFlagNoExpedisiData"],
    queryFn: async () => {
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
      // console.log(`[useResiScanner] Fetched allFlagNoExpedisiData (initial/refetch):`, expedisiMap); // Removed log
      return expedisiMap;
    },
    staleTime: 1000 * 60 * 60, // Changed to 60 minutes
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
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Mohon pilih Expedisi dan No Karung terlebih dahulu.");
      try {
        beepFailure.play();
      } catch (e) {
        console.error("Error playing beepFailure:", e);
      }
      return false;
    }
    return true;
  };

  const handleScanResi = async () => {
    dismissToast(); // Memanggil dismissToast tanpa argumen untuk menutup semua toast
    const currentResi = resiNumber.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim(); 
    setResiNumber("");

    // console.log(`[handleScanResi] Processing resi: ${currentResi}, Expedition: ${expedition}, Karung: ${selectedKarung}`); // Removed log

    if (!validateInput(currentResi)) {
      // console.log("[handleScanResi] Initial input validation failed."); // Removed log
      return;
    }

    setIsProcessing(true); // Set to true at the very beginning

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];
    const queryKeyForKarungSummary = ["karungSummary", expedition, formattedDate];


    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierName: string | null = null;
    let expedisiRecord: any = null; // Will hold the record from tbl_expedisi if found

    try {
      // 1. Local Duplicate Check (for recent scans)
      // console.log(`[handleScanResi] Checking for local duplicate (recent): ${normalizedCurrentResi}`); // Removed log
      if (recentResiNumbersForValidation?.has(normalizedCurrentResi)) {
        // Fetch the created date for the duplicate resi
        const { data: existingResiDetail, error: _detailError } = await supabase // Changed detailError to _detailError
          .from("tbl_resi")
          .select("created")
          .eq("Resi", currentResi)
          .maybeSingle();

        let createdDateStr = "";
        if (existingResiDetail && existingResiDetail.created) {
          createdDateStr = format(new Date(existingResiDetail.created), "dd/MM/yyyy HH:mm");
        }

        validationStatus = 'DUPLICATE_RESI';
        validationMessage = `DOUBLE! Resi ini sudah discan ${createdDateStr}.`; // Updated message
        // console.log(`[handleScanResi] Validation Failed: DUPLICATE_RESI (recent). Message: ${validationMessage}`); // Removed log
      }

      // 2. Database Duplicate Check (for older scans, if not found locally)
      if (validationStatus === 'OK') {
        // console.log(`[handleScanResi] Checking for database duplicate (all history): ${currentResi}`); // Removed log
        const { data: existingResiInDb, error: dbCheckError } = await supabase
          .from("tbl_resi")
          .select("Resi, created") // Select created as well
          .eq("Resi", currentResi)
          .maybeSingle(); // Use maybeSingle to get null if not found, or data if found

        if (dbCheckError && dbCheckError.code !== 'PGRST116') { // PGRST116 means "no rows found"
          throw dbCheckError; // Re-throw other errors
        }

        if (existingResiInDb) {
          let createdDateStr = "";
          if (existingResiInDb.created) {
            createdDateStr = format(new Date(existingResiInDb.created), "dd/MM/yyyy HH:mm");
          }
          validationStatus = 'DUPLICATE_RESI';
          validationMessage = `DOUBLE! Resi ini sudah discan ${createdDateStr}.`; // Updated message
          // console.log(`[handleScanResi] Validation Failed: DUPLICATE_RESI (history). Message: ${validationMessage}`); // Removed log
        }
      }

      // Only proceed with further checks if not already a duplicate
      if (validationStatus === 'OK') {
        // 3. Attempt to find expedisiRecord from caches or direct RPC call
        // console.log(`[handleScanResi] Checking allExpedisiDataUnfiltered for ${normalizedCurrentResi}`); // Removed log
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          // console.log(`[handleScanResi] Not found in allExpedisiDataUnfiltered. Checking allFlagNoExpedisiData.`); // Removed log
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        if (!expedisiRecord) {
            // console.log(`[handleScanResi] Not found in local caches. Attempting direct fetch from tbl_expedisi using RPC for ${currentResi}.`); // Removed log
            const { data: directExpedisiDataArray, error: directExpedisiError } = await supabase.rpc("get_expedisi_by_resino_case_insensitive", {
              p_resino: currentResi,
            });

            if (directExpedisiError) {
                console.error(`[handleScanResi] Error during direct fetch via RPC:`, directExpedisiError);
                throw directExpedisiError; // Re-throw other errors
            }
            
            if (directExpedisiDataArray && directExpedisiDataArray.length > 0) {
                expedisiRecord = directExpedisiDataArray[0]; // Take the first one if multiple
                // console.log(`[handleScanResi] Found via direct fetch (RPC). Data:`, expedisiRecord); // Removed log
                // Optionally, update the cache with this fresh data to prevent future direct fetches for this item
                queryClient.setQueryData(
                    ["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted],
                    (oldMap: Map<string, any> | undefined) => {
                        const newMap = oldMap ? new Map(oldMap) : new Map();
                        newMap.set(normalizedCurrentResi, expedisiRecord);
                        return newMap;
                    }
                );
                if (expedisiRecord.flag === 'NO') {
                  queryClient.setQueryData(
                    ["allFlagNoExpedisiData"],
                    (oldMap: Map<string, any> | undefined) => {
                        const newMap = oldMap ? new Map(oldMap) : new Map();
                        newMap.set(normalizedCurrentResi, expedisiRecord);
                        return newMap;
                    }
                  );
                }
            }
        }
      }

      // 4. Determine actualCourierName and final validationStatus based on `expedition` and `expedisiRecord` presence
      if (validationStatus === 'OK') { // Only proceed if not already a duplicate
        // console.log(`[handleScanResi] Performing courier name check. Selected expedition: ${expedition}`); // Removed log
        if (expedition === 'ID') {
          if (expedisiRecord) {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier === 'ID') {
              actualCourierName = 'ID';
              // console.log(`[handleScanResi] Courier match: ID (from expedisiRecord).`); // Removed log
            } else {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`; // Updated message
              // console.log(`[handleScanResi] Validation Failed: MISMATCH_EXPEDISI (ID). Message: ${validationMessage}`); // Removed log
            }
          } else {
            // If expedition is 'ID' and resi was NOT found in tbl_expedisi, treat as ID_REKOMENDASI
            actualCourierName = 'ID_REKOMENDASI';
            // console.log(`[handleScanResi] Courier assumed: ID_REKOMENDASI (expedisiRecord not found, but selected is ID).`); // Removed log
          }
        } else { // For non-ID expeditions (JNE, SPX, etc.)
          if (!expedisiRecord) {
            // If expedition is NOT 'ID' and resi was NOT found in tbl_expedisi, then it's a true NOT_FOUND_EXPEDISI
            validationStatus = 'NOT_FOUND_EXPEDISI';
            validationMessage = 'Data tidak ada di database ekspedisi.';
            // console.log(`[handleScanResi] Validation Failed: NOT_FOUND_EXPEDISI (non-ID). Message: ${validationMessage}`); // Removed log
          } else {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier !== expedition.toUpperCase()) {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`; // Updated message
              // console.log(`[handleScanResi] Validation Failed: MISMATCH_EXPEDISI (non-ID). Message: ${validationMessage}`); // Removed log
            } else {
              actualCourierName = expedisiRecord.couriername;
              // console.log(`[handleScanResi] Courier match: ${actualCourierName}.`); // Removed log
            }
          }
        }
      }

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
          console.error("Error playing beep sound:", e);
        }
        return; // Exit after handling error
      }

      // --- If all OK, proceed with optimistic update and saving to IndexedDB ---
      // console.log("[handleScanResi] All validations passed. Proceeding with optimistic update and IndexedDB save."); // Removed log
      const newResiEntry: ResiExpedisiData = {
        Resi: currentResi,
        nokarung: selectedKarung,
        created: new Date().toISOString(),
        Keterangan: actualCourierName, // Use validated courier name
        schedule: "ontime", // Added schedule property
        optimisticId: currentOptimisticId,
      };

      // Optimistic UI update for the input page's display
      queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
        const newData = [...(oldData || []), newResiEntry]; // Ensure oldData is an array
        // console.log(`[handleScanResi] Optimistic allResiForExpedition Update:`, newData); // Removed log
        return newData;
      });
      // Optimistic update for recentResiNumbersForValidation (Set)
      queryClient.setQueryData(["recentResiNumbersForValidation", twoDaysAgoFormatted, formattedDate], (oldSet: Set<string> | undefined) => {
        const newSet = oldSet ? new Set(oldSet) : new Set();
        newSet.add(normalizedCurrentResi);
        // console.log(`[handleScanResi] Optimistic recentResiNumbersForValidation Update:`, newSet); // Removed log
        return newSet;
      });
      // Optimistic update for allExpedisiDataUnfiltered cache
      queryClient.setQueryData(["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted], (oldMap: Map<string, any> | undefined) => {
        const newMap = oldMap ? new Map(oldMap) : new Map();
        const existingExpedisi = newMap.get(normalizedCurrentResi);
        
        // Create or update the expedisi record in the cache
        newMap.set(normalizedCurrentResi, {
          ...existingExpedisi, // Keep existing properties if any
          resino: currentResi,
          couriername: actualCourierName,
          flag: "YES", // Set flag to YES optimistically
          created: existingExpedisi?.created || new Date().toISOString(), // Keep original created or set new
          cekfu: existingExpedisi?.cekfu || false, // Keep existing cekfu or default
          optimisticId: currentOptimisticId, // Add optimistic ID for potential rollback
        });
        // console.log(`[handleScanResi] Optimistic allExpedisiDataUnfiltered Update:`, newMap); // Removed log
        return newMap;
      });
      // Optimistic update for allFlagNoExpedisiData cache (remove if flag becomes YES)
      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = oldMap ? new Map(oldMap) : new Map();
        newMap.delete(normalizedCurrentResi); // Remove from flag NO cache as it's now 'YES'
        // console.log(`[handleScanResi] Optimistic allFlagNoExpedisiData Update (removed ${normalizedCurrentResi}):`, newMap); // Removed log
        return newMap;
      });

      // NEW OPTIMISTIC UPDATE FOR KARUNG SUMMARY
      queryClient.setQueryData(queryKeyForKarungSummary, (oldSummary: { karung_number: string; quantity: number; }[] | undefined) => {
        const newSummary = oldSummary ? [...oldSummary] : [];
        const existingKarungIndex = newSummary.findIndex(item => item.karung_number === selectedKarung);

        if (existingKarungIndex !== -1) {
          // If karung exists, increment its quantity
          newSummary[existingKarungIndex] = {
            ...newSummary[existingKarungIndex],
            quantity: newSummary[existingKarungIndex].quantity + 1,
          };
        } else {
          // If karung doesn't exist, add it with quantity 1
          newSummary.push({
            karung_number: selectedKarung,
            quantity: 1,
          });
        }
        // console.log(`[handleScanResi] Optimistic Karung Summary Update:`, newSummary); // Removed log
        return newSummary;
      });

      lastOptimisticIdRef.current = currentOptimisticId;
      
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

      showSuccess(`Resi ${currentResi} Berhasil`); // Updated toast message
      try {
        beepSuccess.play();
      } catch (e) {
        console.error("Error playing beepSuccess:", e);
      }

      // Clear the optimistic ref as the operation was successfully added to IndexedDB
      lastOptimisticIdRef.current = null;
      
      triggerSync(); // Manually trigger background sync immediately

    } catch (error: any) {
      console.error("Error during resi input (before IndexedDB save or during optimistic update):", error); // Log the full error object

      let errorMessage = "Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.";
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        errorMessage = "Gagal terhubung ke server. Periksa koneksi internet Anda atau coba lagi nanti. Pastikan variabel lingkungan Supabase Anda sudah benar."; // Enhanced message
      } else if (error.message) {
        errorMessage = `Terjadi kesalahan: ${error.message}`;
      } else if (error.code) { // Supabase error codes
        errorMessage = `Terjadi kesalahan Supabase (${error.code}): ${error.message || error.details}`;
      }
      showError(errorMessage);
      try {
        beepFailure.play();
      } catch (e) {
        console.error("Error playing beepFailure:", e);
      }

      // Revert optimistic update on error
      if (lastOptimisticIdRef.current) {
          queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
              const revertedData = (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
              // console.log(`[handleScanResi] Reverted allResiForExpedition Update:`, revertedData); // Removed log
              return revertedData;
          });
          // Revert optimistic update for recentResiNumbersForValidation (Set)
          queryClient.setQueryData(["recentResiNumbersForValidation", twoDaysAgoFormatted, formattedDate], (oldSet: Set<string> | undefined) => {
            const newSet = oldSet ? new Set(oldSet) : new Set();
            newSet.delete(normalizedCurrentResi); // Remove the optimistically added resi
            // console.log(`[handleScanResi] Reverted recentResiNumbersForValidation Update:`, newSet); // Removed log
            return newSet;
          });
          // Revert optimistic update for allExpedisiDataUnfiltered cache
          queryClient.setQueryData(["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted], (oldMap: Map<string, any> | undefined) => {
            const newMap = oldMap ? new Map(oldMap) : new Map();
            const existingExpedisi = newMap.get(normalizedCurrentResi);
            if (existingExpedisi && existingExpedisi.optimisticId === lastOptimisticIdRef.current) {
              const revertedExpedisi = { ...existingExpedisi };
              delete revertedExpedisi.optimisticId; 
              revertedExpedisi.flag = "NO"; // Revert flag to NO
              newMap.set(normalizedCurrentResi, revertedExpedisi);
            }
            // console.log(`[handleScanResi] Reverted allExpedisiDataUnfiltered Update:`, newMap); // Removed log
            return newMap;
          });
          // Revert optimistic update for allFlagNoExpedisiData cache (add back if flag was 'NO')
          queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
            const newMap = oldMap ? new Map(oldMap) : new Map();
            queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] }); 
            // console.log(`[handleScanResi] Reverted allFlagNoExpedisiData Update (forced refetch).`); // Removed log
            return newMap; 
          });
          // REVERT OPTIMISTIC UPDATE FOR KARUNG SUMMARY
          queryClient.setQueryData(queryKeyForKarungSummary, (oldSummary: { karung_number: string; quantity: number; }[] | undefined) => {
            const newSummary = oldSummary ? [...oldSummary] : [];
            const existingKarungIndex = newSummary.findIndex(item => item.karung_number === selectedKarung);

            if (existingKarungIndex !== -1) {
              newSummary[existingKarungIndex] = {
                ...newSummary[existingKarungIndex],
                quantity: newSummary[existingKarungIndex].quantity - 1,
              };
              if (newSummary[existingKarungIndex].quantity <= 0) {
                newSummary.splice(existingKarungIndex, 1);
              }
            }
            // console.log(`[handleScanResi] Reverted Optimistic Karung Summary Update:`, newSummary); // Removed log
            return newSummary;
          });
      }
      lastOptimisticIdRef.current = null; // Clear the ref after attempting revert
    } finally {
      setIsProcessing(false); // Ensure processing state is reset
      keepFocus(); // Ensure focus is returned to input
    }
  };

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing,
    isLoadingRecentResiNumbersForValidation, // NEW: Return loading state
    isLoadingAllFlagNoExpedisiData, // NEW: Return loading state
  };
};