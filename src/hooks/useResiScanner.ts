import React from "react";
import { supabase, SUPABASE_PROJECT_ID } from "@/integrations/supabase/client"; // Import SUPABASE_PROJECT_ID
import { showSuccess, showError, dismissToast } from "@/utils/toast";
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
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Debounced invalidate function
  const debouncedInvalidate = useDebounce(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date());
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
    // NEW: Validate Supabase Anon Key before making the request
    if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
      showError("Kesalahan konfigurasi: Kunci API Supabase (VITE_SUPABASE_ANON_KEY) tidak ditemukan. Mohon periksa file .env Anda.");
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

    try {
      const edgeFunctionUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/process-resi-scan`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, // Use anon key for client-side invocation
        },
        body: JSON.stringify({
          resiNumber: currentResi,
          expedition,
          selectedKarung,
          formattedDate,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess(result.message);
        beepSuccess.play();
        debouncedInvalidate();
      } else {
        // Memeriksa tipe kesalahan dari fungsi Edge
        if (result.type === "duplicate") {
          showError(result.message);
          beepDouble.play(); // Mainkan beep-double untuk duplikat
        } else {
          showError(result.message || "Terjadi kesalahan saat memproses resi. Silakan coba lagi.");
          beepFailure.play(); // Mainkan beep-failure untuk kesalahan lainnya
        }
      }
    } catch (error: any) {
      showError(`Terjadi kesalahan jaringan: ${error.message || "Silakan periksa koneksi internet Anda."}`);
      beepFailure.play();
      console.error("Error during resi input via Edge Function:", error);
    } finally {
      setIsProcessing(false);
      keepFocus();
      console.log("Finished handleScanResi for:", currentResi, "at:", new Date().toISOString());
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