import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
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
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Debounced invalidate function
  const debouncedInvalidate = useDebounce(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date());
  }, 500); // 500ms debounce delay

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
    const { data: expedisiData, error: expError } = await supabase
      .from("tbl_expedisi")
      .select("resino, couriername")
      .eq("resino", currentResi)
      .single();

    if (expError && expError.code !== 'PGRST116') {
        throw expError;
    }

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
            showError("Resi tidak ditemukan di database ekspedisi.");
            beepFailure.play();
            return { success: false };
        }
        if (expedisiData.couriername !== expedition) {
            showError(`Resi ini bukan milik ekspedisi ${expedition}. Ini milik ${expedisiData.couriername}.`);
            beepFailure.play();
            return { success: false };
        }
    }

    const { data: duplicateResi, error: dupError } = await supabase.rpc("get_resi_for_expedition_and_date", {
      p_couriername: expedition,
      p_selected_date: formattedDate,
    }).eq("Resi", currentResi).eq("nokarung", selectedKarung);

    if (dupError) throw dupError;

    if (duplicateResi && duplicateResi.length > 0) {
      showError("Resi duplikat! Data sudah ada.");
      beepDouble.play();
      return { success: false };
    }

    return { success: true, actualCourierName: actualCourierNameFromExpedisi };
  };

  const insertResi = async (currentResi: string, actualCourierNameFromExpedisi: string | null) => {
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
      return false;
    }
    showSuccess(`Resi ${currentResi} berhasil diinput.`);
    beepSuccess.play();
    return true;
  };

  const handleScanResi = async () => {
    const currentResi = resiNumber.trim();
    setResiNumber("");

    if (!validateInput(currentResi)) {
      return;
    }

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
      keepFocus();
    }
  };

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
  };
};