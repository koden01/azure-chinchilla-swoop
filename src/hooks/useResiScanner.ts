import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast"; // Import dismissToast
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useDebounce } from "@/hooks/useDebounce";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useQueryClient } from "@tanstack/react-query";

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string;
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false); // New state for processing
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Debounced invalidate function
  const debouncedInvalidate = useDebounce(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date());
  }, 150); // Dipercepat menjadi 150ms

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
      showError("Pilih Expedisi dan No Karung terlebih dahulu.");
      beepFailure.play();
      return false;
    }
    return true;
  };

  interface ValidationResult {
    success: boolean;
    actualCourierName?: string | null;
  }

  const checkExpeditionAndDuplicates = async (currentResi: string): Promise<ValidationResult> => {
    console.log("Starting checkExpeditionAndDuplicates at:", new Date().toISOString());
    const { data: expedisiData, error: expError } = await supabase
      .from("tbl_expedisi")
      .select("resino, couriername")
      .eq("resino", currentResi)
      .single();

    if (expError && expError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error("Error fetching expedisi data:", expError);
        throw expError;
    }
    console.log("Finished tbl_expedisi select at:", new Date().toISOString());

    let actualCourierNameFromExpedisi: string | null = expedisiData?.couriername || null;

    if (expedition === "ID") {
        if (!expedisiData) {
            // Resi not found in tbl_expedisi, but it's "ID" expedition, so allow it to proceed.
        } else if (expedisiData.couriername !== "ID") {
            showError(`Resi ini bukan milik ekspedisi ID. Ini milik ${expedisiData.couriername}.`);
            beepFailure.play();
            return { success: false };
        }
    } else {
        if (expError || !expedisiData) {
            showError("Resi tidak ada di data base."); // Updated message
            beepFailure.play();
            return { success: false };
        }
        if (expedisiData.couriername !== expedition) {
            showError(`Resi ini bukan milik ekspedisi ${expedition}. Ini milik ${expedisiData.couriername}.`); // Updated message
            beepFailure.play();
            return { success: false };
        }
    }

    console.log("Starting get_filtered_resi_for_expedition_and_date RPC at:", new Date().toISOString());
    // Updated RPC call to include p_resi and p_nokarung for server-side filtering
    const { data: duplicateResi, error: dupError } = await supabase.rpc("get_filtered_resi_for_expedition_and_date", {
      p_couriername: expedition,
      p_selected_date: formattedDate,
      p_resi: currentResi, // Pass resi number to RPC
      p_nokarung: selectedKarung, // Pass karung number to RPC
    });

    if (dupError) {
        console.error("Error fetching duplicate resi:", dupError);
        throw dupError;
    }
    console.log("Finished get_filtered_resi_for_expedition_and_date RPC at:", new Date().toISOString());

    if (duplicateResi && duplicateResi.length > 0) {
      const existingKarung = duplicateResi[0].nokarung;
      showError(`Resi duplikat! Sudah ada di karung No. ${existingKarung}.`); // Updated message
      beepDouble.play();
      return { success: false };
    }

    return { success: true, actualCourierName: actualCourierNameFromExpedisi };
  };

  const insertResi = async (currentResi: string, actualCourierNameFromExpedisi: string | null) => {
    console.log("Starting insertResi at:", new Date().toISOString());
    let insertPayload: any = {
        Resi: currentResi,
        nokarung: selectedKarung,
    };

    if (expedition === "ID") {
        if (actualCourierNameFromExpedisi === null) {
            insertPayload.Keterangan = "ID_REKOMENDASI";
            insertPayload.schedule = "idrek";
        } else {
            insertPayload.Keterangan = actualCourierNameFromExpedisi;
        }
    } else {
        insertPayload.Keterangan = expedition;
    }

    const { error: insertError } = await supabase
      .from("tbl_resi")
      .insert(insertPayload);

    if (insertError) {
      showError(`Gagal menginput resi: ${insertError.message}`);
      beepFailure.play();
      console.error("Error inserting resi:", insertError);
      return false;
    }
    showSuccess(`Resi ${currentResi} berhasil diinput.`);
    beepSuccess.play();
    console.log("Finished insertResi at:", new Date().toISOString());
    return true;
  };

  const handleScanResi = async () => {
    dismissToast(); // Dismiss any existing toast when a new scan starts
    const currentResi = resiNumber.trim();
    setResiNumber("");

    if (!validateInput(currentResi)) {
      return;
    }

    setIsProcessing(true); // Start processing
    console.log("Starting handleScanResi for:", currentResi, "at:", new Date().toISOString());

    try {
      const validationResult = await checkExpeditionAndDuplicates(currentResi);
      if (!validationResult.success) {
        return;
      }

      const isInserted = await insertResi(currentResi, validationResult.actualCourierName || null);
      if (isInserted) {
        debouncedInvalidate();
      }
    } catch (error: any) {
      showError(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
      beepFailure.play();
      console.error("Error during resi input:", error);
    } finally {
      setIsProcessing(false); // End processing
      keepFocus();
      console.log("Finished handleScanResi for:", currentResi, "at:", new Date().toISOString());
    }
  };

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing, // Return isProcessing state
  };
};