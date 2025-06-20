import React from "react";
import { supabase, SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
// import { ModalDataItem } from "@/types/data"; // Dihapus karena tidak digunakan

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null;
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

  // Calculate date range for 2 days back for local validation data
  const today = new Date();
  const twoDaysAgo = subDays(today, 2); // Covers today, yesterday, and the day before yesterday
  const twoDaysAgoFormatted = format(twoDaysAgo, "yyyy-MM-dd");
  const endOfTodayFormatted = format(today, "yyyy-MM-dd");

  // Query to fetch tbl_resi data for the last 2 days for local duplicate validation
  // Now returns a Set<string> for O(1) lookups
  const { data: recentResiNumbersForValidation, /* isLoading: isLoadingRecentResiDataForValidation */ } = useQuery<Set<string>>({
    queryKey: ["recentResiNumbersForValidation", twoDaysAgoFormatted, formattedDate],
    queryFn: async () => {
      console.log(`Fetching recentResiNumbersForValidation from ${twoDaysAgoFormatted} to ${formattedDate} using fetchAllDataPaginated.`);
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // dateFilterColumn
        twoDaysAgo, // selectedStartDate
        today, // selectedEndDate (use 'today' to include all of today)
        "Resi" // Only select the Resi column
      );
      const resiSet = new Set(data.map((item: { Resi: string }) => item.Resi.toLowerCase().trim()));
      console.log(`Fetched ${resiSet.size} unique recent resi numbers for validation.`);
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
      console.log("Fetching allFlagNoExpedisiData (paginated) where flag = 'NO'.");
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
      console.log(`Fetched ${expedisiMap.size} 'flag NO' expedisi records for validation.`);
      return expedisiMap;
    },
    staleTime: 1000 * 60 * 60, // Changed to 60 minutes
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
    enabled: true, // Always enabled
  });

  // Add this useEffect for debugging recentResiNumbersForValidation changes
  React.useEffect(() => {
    console.log("DEBUG: recentResiNumbersForValidation updated. Current size:", recentResiNumbersForValidation?.size);
  }, [recentResiNumbersForValidation]);

  const lastOptimisticIdRef = React.useRef<string | null>(null);

  // Menggunakan useDebouncedCallback untuk mendebounce pemanggilan fungsi invalidasi
  const debouncedInvalidate = useDebouncedCallback(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date(), expedition);
    // Invalidate historyData for the current day to ensure immediate update
    queryClient.invalidateQueries({ queryKey: ["historyData", formattedDate, formattedDate] });
    // Invalidate the recentResiNumbersForValidation query
    queryClient.invalidateQueries({ queryKey: ["recentResiNumbersForValidation", twoDaysAgoFormatted, formattedDate] });
    // Invalidate the new allFlagNoExpedisiData query
    queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
  }, 150);

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
    // Deklarasikan normalizedCurrentResi di sini agar dapat diakses di blok catch
    const normalizedCurrentResi = currentResi.toLowerCase().trim(); 
    setResiNumber("");

    if (!validateInput(currentResi)) {
      return;
    }

    setIsProcessing(true); // Set to true at the very beginning
    console.log("Starting handleScanResi for:", currentResi, "at:", new Date().toISOString());
    console.log("Supabase Project ID in useResiScanner:", SUPABASE_PROJECT_ID); // Log Supabase Project ID

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];

    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    try {
      let actualCourierName: string | null = null;
      let validationMessage: string | null = null;
      let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";

      // 1. Local Duplicate Check (using recentResiNumbersForValidation Set)
      console.log(`Performing local duplicate check for resi ${currentResi} using recentResiNumbersForValidation Set...`);
      
      if (recentResiNumbersForValidation?.has(normalizedCurrentResi)) {
        console.log("DEBUG: Duplicate found in Set.");
        // To get details of the duplicate, we would need to fetch it or store more data in the Set/Map.
        // For now, we just know it's a duplicate.
        validationStatus = 'DUPLICATE_RESI';
        validationMessage = `DOUBLE! Resi ini sudah discan sebelumnya.`; // Simplified message as we don't have full details from Set
      } else {
        console.log("DEBUG: No duplicate found in Set.");
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        try {
          beepDouble.play();
        } catch (e) {
          console.error("Error playing beepDouble:", e);
        }
        return; // Exit early if validation fails
      }

      // 2. Local Expedition Validation (using allExpedisiDataUnfiltered cache, with fallback to allFlagNoExpedisiData, then direct fetch)
      console.log(`Performing local expedition validation for resi ${currentResi} using allExpedisiDataUnfiltered (3-day cache)...`);
      let expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

      // If not found in 3-day cache, try the comprehensive 'flag NO' cache
      if (!expedisiRecord) {
        console.log(`Resi ${currentResi} not found in 3-day cache. Checking allFlagNoExpedisiData (flag NO cache)...`);
        expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
      }

      // If still not found in any local cache, try a direct fetch from tbl_expedisi
      if (!expedisiRecord) {
          console.log(`Resi ${currentResi} not found in any local cache. Attempting direct fetch from tbl_expedisi.`);
          const { data: directExpedisiData, error: directExpedisiError } = await supabase
              .from("tbl_expedisi")
              .select("*")
              .eq("resino", currentResi)
              .single();

          if (directExpedisiError && directExpedisiError.code !== 'PGRST116') { // PGRST116 means "no rows found"
              throw directExpedisiError; // Re-throw other errors
          }
          
          if (directExpedisiData) {
              expedisiRecord = directExpedisiData;
              console.log(`Resi ${currentResi} found via direct fetch from tbl_expedisi.`);
              // Optionally, update the cache with this fresh data to prevent future direct fetches for this item
              // Update both 3-day cache and flag NO cache if applicable
              queryClient.setQueryData(
                  ["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted],
                  (oldMap: Map<string, any> | undefined) => {
                      const newMap = oldMap ? new Map(oldMap) : new Map();
                      newMap.set(normalizedCurrentResi, directExpedisiData);
                      return newMap;
                  }
              );
              if (directExpedisiData.flag === 'NO') {
                queryClient.setQueryData(
                  ["allFlagNoExpedisiData"],
                  (oldMap: Map<string, any> | undefined) => {
                      const newMap = oldMap ? new Map(oldMap) : new Map();
                      newMap.set(normalizedCurrentResi, directExpedisiData);
                      return newMap;
                  }
                );
              }
          } else {
              console.log(`Resi ${currentResi} NOT found via direct fetch from tbl_expedisi.`);
              validationStatus = 'NOT_FOUND_EXPEDISI';
              validationMessage = 'Data tidak ada di database ekspedisi.';
          }
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        try {
          // Conditional beep based on validation status
          if (validationStatus === 'NOT_FOUND_EXPEDISI') {
            beepFailure.play(); // Play beepFailure for "data tidak ada"
          } else {
            beepDouble.play(); // Keep beepDouble for other mismatches
          }
        } catch (e) {
          console.error("Error playing beep sound:", e);
        }
        return; // Exit early if local expedition validation fails
      }

      // If expedisiRecord is still null here, it means NOT_FOUND_EXPEDISI was set.
      // If it's not null, proceed with courier name validation.
      if (expedition === 'ID') {
        if (expedisiRecord) {
          const normalizedExpedisiCourier = expedisiRecord.couriername?.trim().toUpperCase();
          if (normalizedExpedisiCourier === 'ID' || normalizedExpedisiCourier === 'ID_REKOMENDASI') {
            actualCourierName = 'ID';
          } else {
            validationStatus = 'MISMATCH_EXPEDISI';
            validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
          }
        } else {
          // This branch is reached if expedisiRecord was not found in cache AND not found via direct fetch.
          // This means validationStatus is already 'NOT_FOUND_EXPEDISI'.
          // However, for 'ID' expedition, if not found in tbl_expedisi, it can be ID_REKOMENDASI.
          // This is a specific business rule.
          actualCourierName = 'ID_REKOMENDASI';
          console.log(`Resi ${currentResi} not found in tbl_expedisi, but selected expedition is 'ID'. Assuming 'ID_REKOMENDASI'.`);
        }
      } else { // For non-ID expeditions
        if (!expedisiRecord) {
          // This case should ideally be caught by the earlier direct fetch logic.
          // If we reach here and expedisiRecord is null, it means it was truly not found.
          validationStatus = 'NOT_FOUND_EXPEDISI';
          validationMessage = 'Data tidak ada di database ekspedisi.';
        } else {
          const normalizedExpedisiCourier = expedisiRecord.couriername?.trim().toUpperCase();
          if (normalizedExpedisiCourier !== expedition.toUpperCase()) {
            validationStatus = 'MISMATCH_EXPEDISI';
            validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
          } else {
            actualCourierName = expedisiRecord.couriername;
          }
        }
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        try {
          // Conditional beep based on validation status
          if (validationStatus === 'NOT_FOUND_EXPEDISI') {
            beepFailure.play(); // Play beepFailure for "data tidak ada"
          } else {
            beepDouble.play(); // Keep beepDouble for other mismatches
          }
        } catch (e) {
          console.error("Error playing beep sound:", e);
        }
        return; // Exit early if local expedition validation fails
      }

      // --- Optimistic UI Update ---
      const newResiEntry: ResiExpedisiData = {
        Resi: currentResi,
        nokarung: selectedKarung,
        created: new Date().toISOString(),
        Keterangan: actualCourierName, // Use validated courier name
        schedule: "ontime", // Optimistic schedule (will be corrected by DB trigger if 'late')
        optimisticId: currentOptimisticId,
      };

      queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry]; // Ensure oldData is an array
      });
      // Optimistic update for recentResiNumbersForValidation (Set)
      queryClient.setQueryData(["recentResiNumbersForValidation", twoDaysAgoFormatted, formattedDate], (oldSet: Set<string> | undefined) => {
        const newSet = oldSet ? new Set(oldSet) : new Set();
        newSet.add(normalizedCurrentResi);
        return newSet;
      });
      // NEW: Optimistic update for allExpedisiDataUnfiltered cache
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
          optimisticId: currentOptimisticId, // Add optimistic ID for potential rollback
        });
        console.log(`Optimistically updated allExpedisiDataUnfiltered cache for ${currentResi}.`);
        return newMap;
      });
      // NEW: Optimistic update for allFlagNoExpedisiData cache (remove if flag becomes YES)
      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = oldMap ? new Map(oldMap) : new Map();
        newMap.delete(normalizedCurrentResi); // Remove from flag NO cache as it's now 'YES'
        console.log(`Optimistically removed ${currentResi} from allFlagNoExpedisiData cache.`);
        return newMap;
      });


      lastOptimisticIdRef.current = currentOptimisticId;
      console.log("Optimistically updated caches with ID:", currentOptimisticId);
      // --- End Optimistic UI Update ---

      // --- Direct Supabase Insert/Update using upsert ---
      console.log(`Attempting upsert for tbl_resi with Resi: ${currentResi}, Keterangan: ${actualCourierName}, nokarung: ${selectedKarung}`);
      const { data: upsertData, error: upsertError } = await supabase
        .from("tbl_resi")
        .upsert({
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          Keterangan: actualCourierName,
        }, { onConflict: 'Resi' }); // Specify the unique column for conflict resolution

      if (upsertError) {
        console.error("Supabase upsert to tbl_resi failed:", upsertError); // Detailed error log
        throw new Error(`Gagal menyisipkan/memperbarui resi ke tbl_resi: ${upsertError.message}`);
      }
      console.log("Successfully upserted into tbl_resi. Data:", upsertData);

      // 2. Update tbl_expedisi flag to 'YES'
      console.log(`Attempting to update tbl_expedisi flag to 'YES' for resino: ${currentResi}`);
      const { error: updateExpedisiError } = await supabase
        .from("tbl_expedisi")
        .update({ flag: "YES" })
        .eq("resino", currentResi);

      if (updateExpedisiError) {
        console.error("Supabase update to tbl_expedisi failed:", updateExpedisiError); // Detailed error log
        throw new Error(`Gagal memperbarui flag di tbl_expedisi: ${updateExpedisiError.message}`);
      }
      console.log("Successfully updated tbl_expedisi flag.");

      showSuccess(`Resi ${currentResi} berhasil discan.`);
      try {
        beepSuccess.play();
      } catch (e) {
        console.error("Error playing beepSuccess:", e);
      }

      // Clear the optimistic ref as the operation was successful
      lastOptimisticIdRef.current = null;
      
      debouncedInvalidate(); // Invalidate dashboard queries and history in the background

    } catch (error: any) {
      console.error("Error during resi input:", error); // Log the full error object

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
              return (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
          });
          // Revert optimistic update for recentResiNumbersForValidation (Set)
          queryClient.setQueryData(["recentResiNumbersForValidation", twoDaysAgoFormatted, formattedDate], (oldSet: Set<string> | undefined) => {
            const newSet = oldSet ? new Set(oldSet) : new Set();
            newSet.delete(normalizedCurrentResi); // Remove the optimistically added resi
            return newSet;
          });
          // Revert optimistic update for allExpedisiDataUnfiltered cache
          queryClient.setQueryData(["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted], (oldMap: Map<string, any> | undefined) => {
            const newMap = oldMap ? new Map(oldMap) : new Map();
            const existingExpedisi = newMap.get(normalizedCurrentResi);
            if (existingExpedisi && existingExpedisi.optimisticId === lastOptimisticIdRef.current) {
              // If this was an optimistic insert, delete it. If it was an update, revert its flag.
              // For simplicity, if it was optimistically added, remove it. If it was an update, we'd need to store its original state.
              // For now, we'll just remove the optimistic flag if it exists.
              const revertedExpedisi = { ...existingExpedisi };
              delete revertedExpedisi.optimisticId; // Remove the optimistic flag
              // If the original state was 'NO', we might need to revert the flag too.
              // This requires storing the original flag state in the optimistic update.
              // For now, we assume the flag was 'NO' before the optimistic 'YES'.
              revertedExpedisi.flag = "NO"; // Revert flag to NO
              newMap.set(normalizedCurrentResi, revertedExpedisi);
            }
            return newMap;
          });
          // NEW: Revert optimistic update for allFlagNoExpedisiData cache (add back if flag was 'NO')
          queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
            const newMap = oldMap ? new Map(oldMap) : new Map();
            // If the original expedisi record (before optimistic update) had flag 'NO', add it back.
            // This requires knowing the original state, which is not directly available here.
            // For now, we'll re-fetch this cache on error to ensure consistency.
            // A more robust solution would involve storing the original state in the optimistic context.
            // For simplicity, we'll just invalidate this cache to force a re-fetch.
            queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
            return newMap; // Return current map, invalidation will handle refresh
          });
          console.log(`Reverted optimistic update for ID: ${lastOptimisticIdRef.current} due to error.`);
      }
      lastOptimisticIdRef.current = null; // Clear the ref after attempting revert
    } finally {
      console.log("Finished handleScanResi for:", currentResi, "at:", new Date().toISOString());
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
  };
};