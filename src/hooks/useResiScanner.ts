import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { useBackgroundSync } from "./useBackgroundSync";

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null; // Changed to Keterangan to match tbl_resi
  schedule: string | null;
  optimisticId?: string;
}

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string; // This prop is the formatted date for today
  allExpedisiDataUnfiltered: Map<string, any> | undefined;
  allResiForExpedition: ResiExpedisiData[] | undefined;
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allResiForExpedition }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [localCurrentCount, setLocalCurrentCount] = React.useState(0);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { triggerSync } = useBackgroundSync();
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  // Initialize localCurrentCount based on allResiForExpedition when expedition or karung changes
  // This useEffect will now be the primary source for initial count.
  React.useEffect(() => {
    if (allResiForExpedition && expedition && selectedKarung) {
      const count = allResiForExpedition.filter(item =>
        item.nokarung === selectedKarung &&
        (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition)
      ).length;
      setLocalCurrentCount(count);
    } else {
      setLocalCurrentCount(0);
    }
  }, [expedition, selectedKarung, allResiForExpedition]); // Depend on allResiForExpedition to re-evaluate when it changes from background sync

  const { data: recentScannedResiNumbers, isLoading: isLoadingRecentScannedResiNumbers } = useQuery<Set<string>>({
    queryKey: ["recentScannedResiNumbers", formattedToday], // Only today's date
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // dateFilterColumn
        today, // selectedStartDate (fetch only from today)
        today, // selectedEndDate (fetch only up to end of today)
        "Resi" // Only select the Resi column
      );
      const resiSet = new Set(data.map((item: { Resi: string }) => item.Resi.toLowerCase().trim()));
      console.log(`[useResiScanner] Fetched ${resiSet.size} recent scanned resi numbers.`);
      return resiSet;
    },
    staleTime: 1000 * 60 * 5, // Keep this data fresh for 5 minutes
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
    enabled: true, // Always enabled
  });

  const { data: allFlagNoExpedisiData, isLoading: isLoadingAllFlagNoExpedisiData } = useQuery<Map<string, any>>({
    queryKey: ["allFlagNoExpedisiData"], // This query remains global as it's for all 'NO' flags
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        undefined, // No date filter
        undefined, // No start date
        undefined, // No end date
        "*", // Select all columns needed for validation
        (query) => query.eq("flag", "NO") // Add flag filter
      );
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      console.log(`[useResiScanner] Fetched ${expedisiMap.size} Flag NO expedisi records.`);
      return expedisiMap;
    },
    staleTime: 1000 * 60 * 5, // Changed to 5 minutes for faster invalidation
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
    enabled: true, // Always enabled
  });

  // Memoize derivedRecentProcessedResiNumbers to avoid re-calculation on every render
  const derivedRecentProcessedResiNumbers = React.useMemo(() => {
    const processedSet = new Set<string>();
    if (allExpedisiDataUnfiltered) {
      for (const [resi, data] of allExpedisiDataUnfiltered.entries()) {
        if (data.flag === 'YES') {
          processedSet.add(resi);
        }
      }
    }
    return processedSet;
  }, [allExpedisiDataUnfiltered]);

  const lastOptimisticIdRef = React.useRef<string | null>(null);

  const keepFocus = () => {
    setTimeout(() => {
      if (resiInputRef.current) {
        resiInputRef.current.focus();
      }
    }, 0);
  };

  const playBeep = (audio: HTMLAudioElement) => {
    setTimeout(() => {
      try {
        audio.play();
      } catch (e) {
        console.error("[useResiScanner] Error playing beep sound:", e);
      }
    }, 0); // Delay audio play to not block main thread
  };

  const validateInput = (resi: string) => {
    if (!resi) {
      showError("Nomor resi tidak boleh kosong.");
      playBeep(beepFailure);
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Mohon pilih Expedisi dan No Karung terlebih dahulu.");
      playBeep(beepFailure);
      return false;
    }
    return true;
  };

  const handleScanResi = React.useCallback(async () => {
    console.time("handleScanResi_total"); // Start total timing
    dismissToast();
    const currentResi = resiNumber.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim();
    setResiNumber("");

    console.time("handleScanResi_validation_sync");
    if (!validateInput(currentResi)) {
      setIsProcessing(false);
      keepFocus();
      console.timeEnd("handleScanResi_validation_sync");
      console.timeEnd("handleScanResi_total");
      return;
    }
    console.timeEnd("handleScanResi_validation_sync");

    setIsProcessing(true);

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];
    const queryKeyForKarungSummary = ["karungSummary", expedition, formattedDate];

    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "DUPLICATE_SCANNED" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierName: string | null = null;
    let expedisiRecord: any = null;

    try {
      // 1. Check if resi has already been PROCESSED (flag = YES in tbl_expedisi)
      if (derivedRecentProcessedResiNumbers.has(normalizedCurrentResi)) {
        validationStatus = 'DUPLICATE_PROCESSED';
        validationMessage = `DOUBLE! Resi ini sudah diproses.`;
      }

      // 2. Check if resi has already been SCANNED (in tbl_resi)
      if (validationStatus === 'OK') {
        if (recentScannedResiNumbers?.has(normalizedCurrentResi)) {
          // Only fetch detail if it's a duplicate scanned resi
          const { data: existingResiDetail, error: _detailError } = await supabase
            .from("tbl_resi")
            .select("created")
            .eq("Resi", currentResi)
            .maybeSingle();

          let createdDateStr = "";
          if (existingResiDetail && existingResiDetail.created) {
            createdDateStr = format(new Date(existingResiDetail.created), "dd/MM/yyyy HH:mm");
          }

          validationStatus = 'DUPLICATE_SCANNED';
          validationMessage = `DOUBLE! Resi ini sudah discan pada ${createdDateStr}.`;
        }
      }

      // Only proceed with further checks if not already a duplicate
      if (validationStatus === 'OK') {
        console.time("handleScanResi_expedisi_lookup");
        // 3. Attempt to find expedisiRecord from caches or direct RPC call
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        if (!expedisiRecord) {
            console.time("rpc_get_expedisi_by_resino"); // Start timing RPC call
            const { data: directExpedisiDataArray, error: directExpedisiError } = await supabase.rpc("get_expedisi_by_resino_case_insensitive", {
              p_resino: currentResi,
            });
            console.timeEnd("rpc_get_expedisi_by_resino"); // End timing RPC call

            if (directExpedisiError) {
                console.error(`[useResiScanner] Error during direct fetch:`, directExpedisiError);
                throw directExpedisiError;
            }
            
            if (directExpedisiDataArray && directExpedisiDataArray.length > 0) {
                expedisiRecord = directExpedisiDataArray[0];
                // Invalidate these queries instead of setting data directly
                // This will trigger a background refetch for these large datasets
                // Removed from here, will be handled by optimistic setQueryData below
            }
        }
        console.timeEnd("handleScanResi_expedisi_lookup");
      }

      // 4. Determine actualCourierName and final validationStatus
      if (validationStatus === 'OK') {
        if (expedition === 'ID') {
          if (expedisiRecord) {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier === 'ID') {
              actualCourierName = 'ID';
            } else {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`;
            }
          } else {
            actualCourierName = 'ID_REKOMENDASI';
          }
        } else {
          if (!expedisiRecord) {
            validationStatus = 'NOT_FOUND_EXPEDISI';
            validationMessage = 'Data tidak ada di database ekspedisi.';
          } else {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier !== expedition.toUpperCase()) {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`;
            } else {
              actualCourierName = expedisiRecord.couriername;
            }
          }
        }
      }

      // --- FINAL ERROR HANDLING BLOCK ---
      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        playBeep(
          validationStatus === 'DUPLICATE_PROCESSED' || validationStatus === 'DUPLICATE_SCANNED'
            ? beepDouble
            : beepFailure
        );
        setIsProcessing(false);
        keepFocus();
        console.timeEnd("handleScanResi_total");
        return;
      }

      // --- If all OK, proceed with optimistic update and saving to IndexedDB ---
      console.time("handleScanResi_optimistic_updates");
      
      // Optimistically update localCurrentCount immediately for instant UI feedback
      setLocalCurrentCount(prevCount => prevCount + 1);

      // 1. Optimistically update recentScannedResiNumbers
      queryClient.setQueryData(["recentScannedResiNumbers", formattedToday], (oldData: Set<string> | undefined) => {
        const newData = new Set(oldData || []);
        newData.add(normalizedCurrentResi);
        return newData;
      });

      // 2. Optimistically update allExpedisiDataUnfiltered
      queryClient.setQueryData(["allExpedisiDataUnfiltered", formattedToday], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        const existingExpedisi = newMap.get(normalizedCurrentResi);
        newMap.set(normalizedCurrentResi, {
          ...(existingExpedisi || { resino: currentResi, created: new Date().toISOString() }), // Ensure basic fields if new
          flag: "YES",
          cekfu: false, // As per background sync logic
          couriername: actualCourierName || existingExpedisi?.couriername, // Keep existing or set new
        });
        return newMap;
      });

      // 3. Optimistically update allFlagNoExpedisiData (remove the scanned resi)
      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        newMap.delete(normalizedCurrentResi);
        return newMap;
      });

      // 4. Invalidate queries for Input page display (these are smaller and derived)
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay }); // allResiForExpedition
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary }); // karungSummary
      });
      
      console.timeEnd("handleScanResi_optimistic_updates");
      
      showSuccess(`Resi ${currentResi} Berhasil`);
      playBeep(beepSuccess);

      await addPendingOperation({
        id: `scan-${currentResi}-${Date.now()}`,
        type: "scan",
        payload: {
          resiNumber: currentResi,
          selectedKarung: selectedKarung,
          courierNameFromExpedisi: actualCourierName,
        },
        timestamp: Date.now(),
      });
      
      triggerSync();

    } catch (error: any) {
      console.error(`[useResiScanner] Error during resi input:`, error);

      let errorMessage = "Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.";
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        errorMessage = "Gagal terhubung ke server. Periksa koneksi internet Anda atau coba lagi nanti. Pastikan variabel lingkungan Supabase Anda sudah benar.";
      } else if (error.message) {
        errorMessage = `Terjadi kesalahan: ${error.message}`;
      } else if (error.code) {
        errorMessage = `Terjadi kesalahan Supabase (${error.code}): ${error.message || error.details}`;
      }
      showError(errorMessage);
      playBeep(beepFailure);

      // Revert localCurrentCount on error (this remains synchronous for immediate feedback)
      setLocalCurrentCount(prevCount => Math.max(0, prevCount - 1));
      
      // Invalidate queries to ensure they refetch to correct state after error
      // These invalidations are important for reverting the UI to the correct state
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay });
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary });
        queryClient.invalidateQueries({ queryKey: ["recentScannedResiNumbers", formattedToday] });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", formattedToday] });
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
      });
    } finally {
      setIsProcessing(false);
      keepFocus();
      console.timeEnd("handleScanResi_total"); // End total timing
    }
  }, [resiNumber, expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, recentScannedResiNumbers, allFlagNoExpedisiData, queryClient, triggerSync, validateInput, derivedRecentProcessedResiNumbers, startTransition]);

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing: isProcessing || isPending,
    isLoadingRecentScannedResiNumbers,
    isLoadingAllFlagNoExpedisiData,
    currentCount: localCurrentCount, // Return the local state
  };
};