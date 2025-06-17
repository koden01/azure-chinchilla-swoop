import React from "react";
import { supabase, SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepCancel } from "@/utils/audio";
import { useDebounce } from "@/hooks/useDebounce";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null;
  schedule: string | null;
  optimisticId?: string;
}

// Define type for tbl_expedisi data
interface ExpedisiData {
  resino: string;
  couriername: string | null;
  created: string;
}

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string;
  allResiForExpedition: ResiExpedisiData[] | undefined;
  allExpedisiDataUnfiltered: ExpedisiData[] | undefined; // Prop for all expedisi data
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate, allResiForExpedition, allExpedisiDataUnfiltered }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const lastOptimisticIdRef = React.useRef<string | null>(null);

  const debouncedInvalidate = useDebounce(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date(), expedition);
    // NEW: Invalidate historyData for the current day to ensure immediate update
    queryClient.invalidateQueries({ queryKey: ["historyData", formattedDate, formattedDate] });
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
      beepFailure.play();
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Mohon pilih Expedisi dan No Karung terlebih dahulu.");
      beepFailure.play();
      return false;
    }
    return true;
  };

  const handleScanResi = async () => {
    dismissToast();
    const currentResi = resiNumber.trim();
    setResiNumber("");

    if (!validateInput(currentResi)) {
      return;
    }

    setIsProcessing(true);
    console.log("Starting handleScanResi for:", currentResi, "at:", new Date().toISOString());
    console.log("Supabase Project ID in useResiScanner:", SUPABASE_PROJECT_ID); // Log Supabase Project ID

    const queryKey = ["allResiForExpedition", expedition, formattedDate];
    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    try {
      // --- Client-side Validation Logic (Moved from RPC) ---
      let actualCourierName: string | null = null;
      let validationMessage: string | null = null;
      let validationStatus: "OK" | "DUPLICATE_RESI" | "PREVIOUSLY_SCANNED" | "NOT_FOUND_EXPEDISI" | "MISMATCH_EXPEDISI" = "OK";

      // 1. Check tbl_expedisi for the resi number
      const expedisiRecord = allExpedisiDataUnfiltered?.find(
        (exp) => exp.resino?.trim().toLowerCase() === currentResi.toLowerCase()
      );

      if (expedition === 'ID') {
        if (!expedisiRecord) {
          actualCourierName = 'ID_REKOMENDASI';
        } else if (expedisiRecord.couriername?.trim().toUpperCase() !== 'ID') {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini bukan untuk ekspedisi ID, melainkan untuk ${expedisiRecord.couriername}.`;
        } else {
          actualCourierName = 'ID';
        }
      } else { // For non-ID expeditions
        if (!expedisiRecord) {
          validationStatus = 'NOT_FOUND_EXPEDISI';
          validationMessage = 'Resi tidak ditemukan dalam database ekspedisi.';
        } else if (expedisiRecord.couriername?.trim().toUpperCase() !== expedition.toUpperCase()) {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini bukan milik ekspedisi ${expedisiRecord.couriername}.`;
        } else {
          actualCourierName = expedisiRecord.couriername;
        }
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        beepFailure.play();
        setIsProcessing(false);
        keepFocus();
        return;
      }

      // 2. Check tbl_resi for any scan of this resi, regardless of date range (PREVIOUSLY_SCANNED)
      const existingResiScan = allResiForExpedition?.find(
        (item) => item.Resi.toLowerCase() === currentResi.toLowerCase()
      );

      if (existingResiScan) {
        const existingScanDate = new Date(existingResiScan.created);
        const currentScanDate = new Date(formattedDate);

        // Check if the existing scan date is OUTSIDE the current scan date range (i.e., different day)
        if (format(existingScanDate, "yyyy-MM-dd") !== format(currentScanDate, "yyyy-MM-dd")) {
          validationStatus = 'PREVIOUSLY_SCANNED';
          validationMessage = `Resi ini sudah pernah discan pada tanggal ${format(existingScanDate, 'dd/MM/yyyy')} di karung ${existingResiScan.nokarung}. Tidak dapat discan ulang.`;
        } else {
          // If it's the same day, it's a DUPLICATE_RESI
          validationStatus = 'DUPLICATE_RESI';
          validationMessage = `Resi duplikat! Resi ini sudah discan di karung ${existingResiScan.nokarung} pada tanggal ${format(existingScanDate, 'dd/MM/yyyy')}.`;
        }
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        beepDouble.play(); // Play double beep for duplicates/previously scanned
        setIsProcessing(false);
        keepFocus();
        return;
      }
      // --- End Client-side Validation Logic ---

      // --- Optimistic UI Update ---
      const newResiEntry: ResiExpedisiData = {
        Resi: currentResi,
        nokarung: selectedKarung,
        created: new Date().toISOString(),
        Keterangan: actualCourierName, // Use validated courier name
        schedule: "ontime", // Optimistic schedule
        optimisticId: currentOptimisticId,
      };

      queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry]; // Ensure oldData is an array
      });
      lastOptimisticIdRef.current = currentOptimisticId;
      console.log("Optimistically updated allResiForExpedition cache with ID:", currentOptimisticId);
      // --- End Optimistic UI Update ---

      // Re-enable input immediately after optimistic update
      setIsProcessing(false); // Allow user to type next resi
      keepFocus(); // Keep focus on the input

      // --- Direct Supabase Insert/Update ---
      // 1. Insert into tbl_resi
      const { error: insertError } = await supabase
        .from("tbl_resi")
        .insert({
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          Keterangan: actualCourierName,
          schedule: "ontime",
        });

      if (insertError) {
        // Handle specific duplicate key error
        if (insertError.code === '23505') { // PostgreSQL unique_violation error code
          console.warn(`Duplicate key error for Resi ${currentResi}. Attempting to update to 'BATAL'.`);
          beepCancel.play(); // Play beep-cancel sound for duplicate/batal

          // Fetch the existing record to get its creation date
          const { data: existingResiData, error: fetchExistingError } = await supabase
            .from("tbl_resi")
            .select("created")
            .eq("Resi", currentResi)
            .single();

          if (fetchExistingError || !existingResiData) {
            console.error("Failed to fetch existing resi data for duplicate:", fetchExistingError);
            showError(`Resi "${currentResi}" sudah ada, tetapi gagal mengambil detailnya untuk pembatalan.`);
            // Revert optimistic update on error
            if (lastOptimisticIdRef.current) {
                queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
                    return (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
                });
            }
            lastOptimisticIdRef.current = null;
            return; // Exit early
          }

          const existingCreatedDate = new Date(existingResiData.created);
          const formattedExistingDate = format(existingCreatedDate, "dd/MM/yyyy");

          // Update the existing record to 'batal'
          const { error: updateError } = await supabase
            .from("tbl_resi")
            .update({ schedule: "batal", Keterangan: "BATAL" })
            .eq("Resi", currentResi);

          if (updateError) {
            console.error("Failed to update existing resi to BATAL:", updateError);
            showError(`Resi "${currentResi}" sudah ada, tetapi gagal mengubah statusnya menjadi "BATAL".`);
            // Revert optimistic update on error
            if (lastOptimisticIdRef.current) {
                queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
                    return (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
                });
            }
            lastOptimisticIdRef.current = null;
            return; // Exit early
          }

          showSuccess(`Resi "${currentResi}" sudah ada dan diubah menjadi "BATAL" pada tanggal ${formattedExistingDate}.`);
          debouncedInvalidate(); // Invalidate dashboard queries and history
          lastOptimisticIdRef.current = null; // Clear the optimistic ref as the operation was successful
          return; // Exit after handling duplicate
        }
        throw new Error(`Gagal menyisipkan resi ke tbl_resi: ${insertError.message}`);
      }
      console.log("Successfully inserted into tbl_resi.");

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
      beepSuccess.play();

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
      beepFailure.play();

      // Revert optimistic update on error
      if (lastOptimisticIdRef.current) {
          queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
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