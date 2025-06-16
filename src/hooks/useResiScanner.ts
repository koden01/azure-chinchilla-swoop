import React from "react";
import { supabase, SUPABASE_PROJECT_ID } from "@/integrations/supabase/client"; // Import SUPABASE_PROJECT_ID
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useDebounce } from "@/hooks/useDebounce";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns"; // Import format for current timestamp

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string;
}

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  couriername: string | null;
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

    setIsProcessing(true); // Start processing indicator
    console.log("Starting handleScanResi for:", currentResi, "at:", new Date().toISOString());

    const queryKey = ["allResiForExpedition", expedition, formattedDate];
    let optimisticEntryAdded = false; // Flag to track if optimistic entry was added

    try {
      // --- Optimistic UI Update for InputPage ---
      const currentResiData = queryClient.getQueryData<ResiExpedisiData[]>(queryKey);

      if (currentResiData) {
        const newResiEntry: ResiExpedisiData = {
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          couriername: expedition, // Use expedition as initial optimistic couriername
        };
        queryClient.setQueryData(queryKey, [...currentResiData, newResiEntry]);
        optimisticEntryAdded = true;
        console.log("Optimistically updated allResiForExpedition cache.");
        showSuccess(`Resi ${currentResi} berhasil discan (optimis).`);
        beepSuccess.play();
      } else {
        // If data not in cache, force refetch for this specific query
        // No immediate success toast here, wait for actual fetch result
        queryClient.invalidateQueries({ queryKey: queryKey });
        console.log("allResiForExpedition cache not found, invalidating for refetch.");
      }
      // --- End Optimistic UI Update ---

      // Re-enable input immediately after optimistic update
      setIsProcessing(false); // Allow user to type next resi
      keepFocus(); // Keep focus on the input

      const edgeFunctionUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/process-resi-scan`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
        // If optimistic update was done, update the couriername if it changed
        if (optimisticEntryAdded && result.actual_couriername && result.actual_couriername !== expedition) {
            queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
                if (!oldData) return undefined;
                return oldData.map(item => item.Resi === currentResi ? { ...item, couriername: result.actual_couriername } : item);
            });
            console.log(`Updated optimistic entry couriername to ${result.actual_couriername}`);
        }
        // If no optimistic update was done (because cache was empty), the invalidateQueries above will refetch.
        // No need for success toast here if optimistic one was shown.
        
        debouncedInvalidate(); // Invalidate dashboard queries in the background
      } else {
        // Handle errors: revert optimistic update if necessary, show error toast
        showError(result.message || "Terjadi kesalahan saat memproses resi. Silakan coba lagi.");
        beepFailure.play();

        // Revert optimistic update if the actual operation failed
        if (optimisticEntryAdded) {
            queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
                if (!oldData) return undefined;
                return oldData.filter(item => item.Resi !== currentResi);
            });
            console.log("Reverted optimistic update due to backend error.");
        }
        console.error("Error during resi input via Edge Function:", result.message);
      }
    } catch (error: any) {
      showError(`Terjadi kesalahan jaringan: ${error.message || "Silakan periksa koneksi internet Anda."}`);
      beepFailure.play();
      console.error("Error during resi input via Edge Function:", error);

      // Revert optimistic update on network error
      if (optimisticEntryAdded) {
          const queryKey = ["allResiForExpedition", expedition, formattedDate];
          queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
              if (!oldData) return undefined;
              return oldData.filter(item => item.Resi !== currentResi);
          });
          console.log("Reverted optimistic update due to network error.");
      }
    } finally {
      // No need to set setIsProcessing(false) here anymore, it's done earlier
      // No need to keepFocus() here anymore, it's done earlier
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