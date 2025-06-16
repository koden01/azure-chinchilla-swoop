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
  // Add an optional optimisticId to distinguish optimistic entries
  optimisticId?: string; 
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Ref to store the optimistic ID of the last added entry
  const optimisticEntryRef = React.useRef<{ resi: string; id: string } | null>(null);

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
    let optimisticId: string | null = null; // Declare optimisticId here

    try {
      // --- Optimistic UI Update for InputPage ---
      const currentResiData = queryClient.getQueryData<ResiExpedisiData[]>(queryKey);

      if (currentResiData) {
        optimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9); // Generate unique ID
        const newResiEntry: ResiExpedisiData = {
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          couriername: expedition, // Use expedition as initial optimistic couriername
          optimisticId: optimisticId, // Add optimistic ID
        };
        queryClient.setQueryData(queryKey, [...currentResiData, newResiEntry]);
        optimisticEntryRef.current = { resi: currentResi, id: optimisticId }; // Store for potential revert
        console.log("Optimistically updated allResiForExpedition cache with ID:", optimisticId);
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
        if (optimisticEntryRef.current && optimisticEntryRef.current.resi === currentResi && result.actual_couriername && result.actual_couriername !== expedition) {
            const idToUpdate = optimisticEntryRef.current.id;
            queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
                if (!oldData) return undefined;
                return oldData.map(item => item.optimisticId === idToUpdate ? { ...item, couriername: result.actual_couriername } : item);
            });
            console.log(`Updated optimistic entry couriername to ${result.actual_couriername}`);
        }
        // Clear the optimistic ref as the operation was successful
        optimisticEntryRef.current = null;
        
        debouncedInvalidate(); // Invalidate dashboard queries in the background
      } else {
        // Handle errors: revert optimistic update if necessary, show error toast
        if (result.type === "duplicate") {
          showError(result.message);
          beepDouble.play(); // Mainkan beep-double untuk duplikat
        } else {
          showError(result.message || "Terjadi kesalahan saat memproses resi. Silakan coba lagi.");
          beepFailure.play(); // Mainkan beep-failure untuk kesalahan lainnya
        }

        // Revert optimistic update if the actual operation failed
        if (optimisticEntryRef.current && optimisticEntryRef.current.resi === currentResi) {
            const idToRemove = optimisticEntryRef.current.id;
            queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
                if (!oldData) return undefined;
                // Filter out only the specific optimistic entry using its unique ID
                return oldData.filter(item => item.optimisticId !== idToRemove);
            });
            console.log("Reverted optimistic update due to backend error.");
            optimisticEntryRef.current = null; // Clear the ref
        }
        console.error("Error during resi input via Edge Function:", result.message);
      }
    } catch (error: any) {
      showError(`Terjadi kesalahan jaringan: ${error.message || "Silakan periksa koneksi internet Anda."}`);
      beepFailure.play();
      console.error("Error during resi input via Edge Function:", error);

      // Revert optimistic update on network error
      if (optimisticEntryRef.current && optimisticEntryRef.current.resi === currentResi) {
          const idToRemove = optimisticEntryRef.current.id;
          queryClient.setQueryData(queryKey, (oldData: ResiExpedisiData[] | undefined) => {
              if (!oldData) return undefined;
              return oldData.filter(item => item.optimisticId !== idToRemove);
          });
          console.log("Reverted optimistic update due to network error.");
          optimisticEntryRef.current = null; // Clear the ref
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