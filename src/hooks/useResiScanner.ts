import React from "react";
import { supabase, SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useDebounce } from "@/hooks/useDebounce";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

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
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const lastOptimisticIdRef = React.useRef<string | null>(null);

  const debouncedInvalidate = useDebounce(() => {
    console.log("Debounced invalidation triggered!");
    invalidateDashboardQueries(queryClient, new Date(), expedition);
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
    dismissToast();
    const currentResi = resiNumber.trim();
    setResiNumber("");

    if (!validateInput(currentResi)) {
      return;
    }

    setIsProcessing(true);
    console.log("Starting handleScanResi for:", currentResi, "at:", new Date().toISOString());
    console.log("Supabase Project ID in useResiScanner:", SUPABASE_PROJECT_ID);

    const queryKey = ["allResiForExpedition", expedition, formattedDate];

    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    try {
      // --- Optimistic UI Update ---
      // We don't know the actual Keterangan (courier name) or created timestamp from tbl_expedisi yet
      // for ID_REKOMENDASI or other cases, so we'll use a placeholder and current time.
      // The Edge Function will return the correct values if needed for a more precise optimistic update,
      // but for now, this is sufficient for immediate feedback.
      const newResiEntry: ResiExpedisiData = {
        Resi: currentResi,
        nokarung: selectedKarung,
        created: new Date().toISOString(), // Placeholder, will be corrected by refetch
        Keterangan: expedition === 'ID' ? 'ID_REKOMENDASI' : expedition, // Placeholder
        schedule: "ontime",
        optimisticId: currentOptimisticId,
      };

      queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
        return [...(oldData || []), newResiEntry];
      });

      lastOptimisticIdRef.current = currentOptimisticId;
      console.log("Optimistically updated caches with ID:", currentOptimisticId);
      
      setIsProcessing(false); // Allow user to type next resi immediately
      keepFocus(); // Keep focus on the input

      // --- Call Supabase Edge Function ---
      console.log("Invoking Edge Function 'scan-resi'...");
      const { data, error: invokeError } = await supabase.functions.invoke('scan-resi', {
        body: JSON.stringify({ resiNumber: currentResi, expedition, selectedKarung }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (invokeError) {
        throw new Error(`Edge Function invocation failed: ${invokeError.message}`);
      }

      if (!data.success) {
        // Handle validation errors or other specific errors from the Edge Function
        if (data.status === 'DUPLICATE_RESI') {
          try {
            beepDouble.play();
          } catch (e) {
            console.error("Error playing beepDouble:", e);
          }
        } else {
          try {
            beepFailure.play();
          } catch (e) {
            console.error("Error playing beepFailure:", e);
          }
        }
        throw new Error(data.message || "Operation failed via Edge Function.");
      }

      console.log("Edge Function 'scan-resi' returned success:", data.message);
      showSuccess(data.message);
      try {
        beepSuccess.play();
      } catch (e) {
        console.error("Error playing beepSuccess:", e);
      }

      lastOptimisticIdRef.current = null; // Clear the optimistic ref as the operation was successful
      debouncedInvalidate(); // Invalidate dashboard queries and history in the background

    } catch (error: any) {
      console.error("Error during resi input (after Edge Function call):", error);

      let errorMessage = "Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.";
      if (error.message) {
        errorMessage = `Terjadi kesalahan: ${error.message}`;
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
      setIsProcessing(false); // Ensure processing state is reset
      keepFocus(); // Ensure focus is returned
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