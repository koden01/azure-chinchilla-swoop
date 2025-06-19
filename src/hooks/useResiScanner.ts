import React from "react";
import { supabase, SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useResiInputData } from "./useResiInputData";

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null;
  schedule: string | null;
  optimisticId?: string;
}

// Define interface for the RPC return type
interface ResiValidationDetails {
  resi_record: {
    Resi: string;
    nokarung: string;
    created: string;
    Keterangan: string;
    schedule: string;
  } | null;
  expedisi_record: {
    resino: string;
    orderno: string;
    chanelsales: string;
    couriername: string;
    created: string;
    flag: string;
    datetrans: string;
    cekfu: boolean;
  } | null;
}

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string;
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { allResiForExpedition } = useResiInputData(expedition, false); // Get the locally cached data

  const lastOptimisticIdRef = React.useRef<string | null>(null);

  // Menggunakan useDebouncedCallback untuk mendebounce pemanggilan fungsi invalidasi
  const debouncedInvalidate = useDebouncedCallback(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date(), expedition);
    // Invalidate historyData for the current day to ensure immediate update
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

    const queryKey = ["allResiForExpedition", expedition, formattedDate];

    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    try {
      let actualCourierName: string | null = null;
      let validationMessage: string | null = null;
      let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";

      // 1. Quick Local Duplicate Check (using allResiForExpedition cache)
      console.log(`Performing quick local duplicate check for resi ${currentResi}...`);
      const localDuplicate = allResiForExpedition?.find(
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
          beepDouble.play();
        } catch (e) {
          console.error("Error playing beepDouble:", e);
        }
        setIsProcessing(false);
        keepFocus();
        return; // Exit early if duplicate found locally
      }

      // 2. Server-Side Combined Validation (RPC Call)
      console.log(`Calling RPC get_resi_validation_details for resi ${currentResi}...`);
      const { data, error: rpcError } = await supabase.rpc("get_resi_validation_details", {
        p_resi_number: currentResi,
      }).single();

      if (rpcError) {
        console.error("Error calling get_resi_validation_details RPC:", rpcError);
        throw rpcError;
      }

      // Explicitly type `rpcData` after the call
      const rpcData: ResiValidationDetails | null = data as ResiValidationDetails | null; // Add type assertion here

      const resiRecord = rpcData?.resi_record;
      const expedisiRecord = rpcData?.expedisi_record;

      console.log("RPC Result - resi_record:", resiRecord);
      console.log("RPC Result - expedisi_record:", expedisiRecord);

      // Check for global duplicate (if resiRecord exists, it's a duplicate)
      if (resiRecord) {
        const existingScanDate = new Date(resiRecord.created);
        validationStatus = 'DUPLICATE_RESI';
        validationMessage = `DOUBLE! Resi ini sudah discan di karung ${resiRecord.nokarung} pada tanggal ${format(existingScanDate, 'dd/MM/yyyy')} dengan keterangan ${resiRecord.Keterangan}.`;
      } else if (expedition === 'ID') {
        if (expedisiRecord) {
          // Resi found in tbl_expedisi, but current expedition is 'ID'
          if (expedisiRecord.couriername?.trim().toUpperCase() === 'ID') {
            actualCourierName = 'ID'; // Store as 'ID' if it's genuinely an 'ID' resi in tbl_expedisi
          } else {
            // Mismatch: found in tbl_expedisi but not 'ID' (e.g., JNE, SPX)
            validationStatus = 'MISMATCH_EXPEDISI';
            validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
          }
        } else {
          // Resi NOT found in tbl_expedisi at all, and current expedition is 'ID'
          actualCourierName = 'ID_REKOMENDASI'; // Store as 'ID_REKOMENDASI' if not found in tbl_expedisi
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
        try {
          beepDouble.play(); // Use beepDouble for any validation failure
        } catch (e) {
          console.error("Error playing beepDouble:", e);
        }
        setIsProcessing(false);
        keepFocus();
        return; // Exit early if server-side validation fails
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

      // Update the specific query for the current expedition and date
      queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry]; // Ensure oldData is an array
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