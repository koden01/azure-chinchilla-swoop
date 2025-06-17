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
  allResiForExpedition: ResiExpedisiData[] | undefined; // This is still used for optimistic updates
  allResiDataComprehensive: ResiExpedisiData[] | undefined; // NEW: Comprehensive list
  allExpedisiDataUnfiltered: ExpedisiData[] | undefined; // Prop for all expedisi data
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate, allResiForExpedition, allResiDataComprehensive, allExpedisiDataUnfiltered }: UseResiScannerProps) => {
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
    // Invalidate the comprehensive resi data to ensure it's up-to-date for future scans
    queryClient.invalidateQueries({ queryKey: ["allResiDataComprehensive"] });
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

    const queryKey = ["allResiForExpedition", expedition, formattedDate]; // Still used for optimistic update

    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    try {
      let actualCourierName: string | null = null;
      let validationMessage: string | null = null;
      let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";

      // 1. Global Resi Duplicate Check (from allResiDataComprehensive)
      const existingResiScan = allResiDataComprehensive?.find(
        (item) => item.Resi.toLowerCase() === currentResi.toLowerCase()
      );

      if (existingResiScan) {
        const existingScanDate = new Date(existingResiScan.created);
        validationStatus = 'DUPLICATE_RESI';
        validationMessage = `DOUBLE! Resi ini sudah discan di karung ${existingResiScan.nokarung} pada tanggal ${format(existingScanDate, 'dd/MM/yyyy')} dengan keterangan ${existingResiScan.Keterangan}.`;
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        beepDouble.play();
        setIsProcessing(false);
        keepFocus();
        return; // Exit early if duplicate
      }

      // 2. Check tbl_expedisi for the resi number and expedition match
      const expedisiRecord = allExpedisiDataUnfiltered?.find(
        (exp) => exp.resino?.trim().toLowerCase() === currentResi.toLowerCase()
      );

      if (expedition === 'ID') {
        if (!expedisiRecord) {
          actualCourierName = 'ID_REKOMENDASI'; // Treat as ID_REKOMENDASI if not found in tbl_expedisi
        } else if (expedisiRecord.couriername?.trim().toUpperCase() !== 'ID') {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
        } else {
          actualCourierName = 'ID';
        }
      } else { // For non-ID expeditions
        if (!expedisiRecord) {
          validationStatus = 'NOT_FOUND_EXPEDISI';
          validationMessage = 'Data tidak ada di database ekspedisi.';
        } else if (expedisiRecord.couriername?.trim().toUpperCase() !== expedition.toUpperCase()) {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
        } else {
          actualCourierName = expedisiRecord.couriername;
        }
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        beepFailure.play();
        setIsProcessing(false);
        keepFocus();
        return; // Exit early if expedisi validation fails
      }

      // --- Optimistic UI Update ---
      const newResiEntry: ResiExpedisiData = {
        Resi: currentResi,
        nokarung: selectedKarung,
        created: new Date().toISOString(),
        Keterangan: actualCourierName, // Use validated courier name
        schedule: "ontime", // Optimistic schedule
        optimisticId: currentOptimisticId,
      };

      // Update the specific query for the current expedition and date
      queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry]; // Ensure oldData is an array
      });
      // Also optimistically update the comprehensive list
      queryClient.setQueryData(["allResiDataComprehensive"], (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry];
      });

      lastOptimisticIdRef.current = currentOptimisticId;
      console.log("Optimistically updated caches with ID:", currentOptimisticId);
      // --- End Optimistic UI Update ---

      // Re-enable input immediately after optimistic update
      setIsProcessing(false); // Allow user to type next resi
      keepFocus(); // Keep focus on the input

      // --- Direct Supabase Insert/Update ---
      // 1. Insert into tbl_resi with onConflict to avoid unique constraint error
      const { data: insertedData, error: insertError } = await supabase
        .from("tbl_resi")
        .insert({
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          Keterangan: actualCourierName,
          schedule: "ontime",
        })
        .onConflict("Resi") // Specify the unique constraint column
        .ignore() // Ignore the insert if conflict occurs
        .select(); // Select the inserted row to check if it was actually inserted

      if (insertError) {
        throw new Error(`Gagal menyisipkan resi ke tbl_resi: ${insertError.message}`);
      }

      if (!insertedData || insertedData.length === 0) {
        // This case should ideally not be hit often if client-side validation is good,
        // but it's a fallback for true race conditions.
        console.warn("Supabase insert was ignored due to duplicate Resi (race condition). Client-side validation should have caught this.");
        // No need to show error here, as client-side already showed it.
        // Just ensure optimistic update is reverted if it somehow wasn't already.
        if (lastOptimisticIdRef.current) {
          queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
              return (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
          });
          queryClient.setQueryData(["allResiDataComprehensive"], (oldData: ResiExpedisiData[] | undefined) => {
            return (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
          });
          console.log(`Reverted optimistic update for ID: ${lastOptimisticIdRef.current} due to database conflict.`);
        }
        lastOptimisticIdRef.current = null; // Clear the ref
        return; // Exit as it was a duplicate handled by DB
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
          queryClient.setQueryData(["allResiDataComprehensive"], (oldData: ResiExpedisiData[] | undefined) => {
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