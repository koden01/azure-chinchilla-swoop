import React from "react";
import { supabase, SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, subDays } from "date-fns";

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

  // Calculate date range for 5 days back for local validation data
  const today = new Date();
  const fiveDaysAgo = subDays(today, 4); // 5 days including today (today, yesterday, -2, -3, -4)
  const fiveDaysAgoISO = startOfDay(fiveDaysAgo).toISOString();
  const endOfTodayISO = endOfDay(today).toISOString();
  const fiveDaysAgoFormatted = format(fiveDaysAgo, "yyyy-MM-dd");
  const endOfTodayFormatted = format(today, "yyyy-MM-dd"); // Consistent with allExpedisiDataUnfiltered query key

  // Query to fetch tbl_resi data for the last 5 days for local validation
  const { data: recentResiDataForValidation } = useQuery<ResiExpedisiData[]>({
    queryKey: ["recentResiDataForValidation", fiveDaysAgoFormatted, formattedDate],
    queryFn: async () => {
      console.log(`Fetching recentResiDataForValidation from ${fiveDaysAgoFormatted} to ${formattedDate}`);
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, nokarung, created, Keterangan, schedule")
        .gte("created", fiveDaysAgoISO)
        .lt("created", endOfTodayISO); // Use < endOfTodayISO to include all of today

      if (error) {
        console.error("Error fetching recent resi data for validation:", error);
        throw error;
      }
      console.log(`Fetched ${data?.length || 0} recent resi records for validation.`);
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // Keep this data fresh for 10 minutes
    gcTime: 1000 * 60 * 60 * 24 * 5, // Garbage collect after 5 days
    enabled: true, // Always enabled for local validation
  });

  const lastOptimisticIdRef = React.useRef<string | null>(null);

  // Menggunakan useDebouncedCallback untuk mendebounce pemanggilan fungsi invalidasi
  const debouncedInvalidate = useDebouncedCallback(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date(), expedition);
    // Invalidate historyData for the current day to ensure immediate update
    queryClient.invalidateQueries({ queryKey: ["historyData", formattedDate, formattedDate] });
    // Invalidate the recentResiDataForValidation query
    queryClient.invalidateQueries({ queryKey: ["recentResiDataForValidation", fiveDaysAgoFormatted, formattedDate] });
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
    setResiNumber("");

    if (!validateInput(currentResi)) {
      return;
    }

    setIsProcessing(true);
    console.log("Starting handleScanResi for:", currentResi, "at:", new Date().toISOString());
    console.log("Supabase Project ID in useResiScanner:", SUPABASE_PROJECT_ID); // Log Supabase Project ID

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];

    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    try {
      let actualCourierName: string | null = null;
      let validationMessage: string | null = null;
      let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";

      // 1. Local Duplicate Check (using recentResiDataForValidation cache)
      console.log(`Performing local duplicate check for resi ${currentResi} using recentResiDataForValidation...`);
      const localDuplicate = recentResiDataForValidation?.find(
        (item) => item.Resi.toLowerCase() === currentResi.toLowerCase()
      );

      if (localDuplicate) {
        const existingScanDate = new Date(localDuplicate.created);
        validationStatus = 'DUPLICATE_RESI';
        validationMessage = `DOUBLE! Resi ini sudah discan di karung ${localDuplicate.nokarung} pada tanggal ${format(existingScanDate, 'dd/MM/yyyy')} dengan keterangan ${localDuplicate.Keterangan}.`;
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        try {
          beepDouble.play(); // Tetap beepDouble untuk duplikat
        } catch (e) {
          console.error("Error playing beepDouble:", e);
        }
        setIsProcessing(false);
        keepFocus();
        return; // Exit early if duplicate found locally
      }

      // 2. Local Expedition Validation (using allExpedisiDataUnfiltered cache, with fallback to direct fetch)
      console.log(`Performing local expedition validation for resi ${currentResi} using allExpedisiDataUnfiltered...`);
      let expedisiRecord = allExpedisiDataUnfiltered?.get(currentResi.toLowerCase());

      // If not found in cache, try a direct fetch from tbl_expedisi
      if (!expedisiRecord) {
          console.log(`Resi ${currentResi} not found in allExpedisiDataUnfiltered cache. Attempting direct fetch from tbl_expedisi.`);
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
              queryClient.setQueryData(
                  ["allExpedisiDataUnfiltered", fiveDaysAgoFormatted, endOfTodayFormatted], // Use the correct query key for allExpedisiDataUnfiltered
                  (oldMap: Map<string, any> | undefined) => {
                      const newMap = oldMap ? new Map(oldMap) : new Map();
                      newMap.set(currentResi.toLowerCase(), directExpedisiData);
                      return newMap;
                  }
              );
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
        setIsProcessing(false);
        keepFocus();
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
          // This logic needs to be careful not to override a 'NOT_FOUND_EXPEDISI' status if it was set.
          // If we are here, it means expedisiRecord is null, so it's truly not found.
          // For 'ID' expedition, if not found, it's considered 'ID_REKOMENDASI'.
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
        setIsProcessing(false);
        keepFocus();
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

      // Update the specific query for the current expedition and date (for input page display)
      queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry]; // Ensure oldData is an array
      });

      // Also update the broader recentResiDataForValidation cache optimistically
      queryClient.setQueryData(["recentResiDataForValidation", fiveDaysAgoFormatted, formattedDate], (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry];
      });

      lastOptimisticIdRef.current = currentOptimisticId;
      console.log("Optimistically updated caches with ID:", currentOptimisticId);
      // --- End Optimistic UI Update ---

      // Re-enable input immediately after optimistic update
      setIsProcessing(false); // Allow user to type next resi
      keepFocus(); // Keep focus on the input

      // --- Direct Supabase Insert/Update using upsert ---
      // Remove 'schedule' from upsert to let the database trigger handle 'ontime'/'late'
      const { error: upsertError } = await supabase
        .from("tbl_resi")
        .upsert({
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          Keterangan: actualCourierName,
          // schedule: "ontime", // Dihapus agar trigger database yang menentukan
        }, { onConflict: 'Resi' }); // Specify the unique column for conflict resolution

      if (upsertError) {
        throw new Error(`Gagal menyisipkan/memperbarui resi ke tbl_resi: ${upsertError.message}`);
      }
      
      console.log("Successfully upserted into tbl_resi.");

      // 2. Update tbl_expedisi flag to 'YES'
      const { error: updateExpedisiError } = await supabase
        .from("tbl_expedisi")
        .update({ flag: "YES" })
        .eq("resino", currentResi);

      if (updateExpedisiError) {
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
          queryClient.setQueryData(["recentResiDataForValidation", fiveDaysAgoFormatted, formattedDate], (oldData: ResiExpedisiData[] | undefined) => {
            return (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
          });
          console.log(`Reverted optimistic update for ID: ${lastOptimisticIdRef.current} due to error.`);
      }
      lastOptimisticIdRef.current = null; // Clear the ref after attempting revert
    } finally {
      console.log("Finished handleScanResi for:", currentResi, "at:", new Date().toISOString());
      setIsProcessing(false);
      keepFocus();
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