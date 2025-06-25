import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepSabar } from "@/utils/audio"; // Import beepSabar
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
  initialTotalExpeditionItems: number | undefined; // NEW: Initial total items
  initialRemainingExpeditionItems: number | undefined; // NEW: Initial remaining items
}

export const useResiScanner = ({ 
  expedition, 
  selectedKarung, 
  formattedDate, 
  allExpedisiDataUnfiltered, 
  allResiForExpedition,
  initialTotalExpeditionItems, // NEW
  initialRemainingExpeditionItems, // NEW
}: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  // const [localCurrentCount, setLocalCurrentCount] = React.useState(0); // REMOVED: No longer needed
  const [optimisticTotalExpeditionItems, setOptimisticTotalExpeditionItems] = React.useState(initialTotalExpeditionItems || 0); // NEW
  const [optimisticRemainingExpeditionItems, setOptimisticRemainingExpeditionItems] = React.useState(initialRemainingExpeditionItems || 0); // NEW
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { triggerSync } = useBackgroundSync();
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  // REMOVED: No longer needed as currentCount is derived from useResiInputData
  // React.useEffect(() => {
  //   if (allResiForExpedition && expedition && selectedKarung) {
  //     const count = allResiForExpedition.filter(item =>
  //       item.nokarung === selectedKarung &&
  //       (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition)
  //     ).length;
  //     setLocalCurrentCount(count);
  //   } else {
  //     setLocalCurrentCount(0);
  //   }
  // }, [expedition, selectedKarung, allResiForExpedition]);

  // NEW: Update optimistic states when initial values change (e.g., on expedition change)
  React.useEffect(() => {
    setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
  }, [initialTotalExpeditionItems]);

  React.useEffect(() => {
    setOptimisticRemainingExpeditionItems(initialRemainingExpeditionItems || 0);
  }, [initialRemainingExpeditionItems]);

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
      playBeep(beepFailure); // Changed to beepFailure
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Mohon pilih Expedisi dan No Karung terlebih dahulu.");
      playBeep(beepFailure); // Changed to beepFailure
      return false;
    }
    return true;
  };

  const handleScanResi = React.useCallback(async () => {
    // NEW: Defensive check for rapid scans
    if (isProcessing) {
      console.warn("[useResiScanner] Already processing a scan. Ignoring rapid input.");
      playBeep(beepSabar); // Play beepSabar sound for rapid input attempts
      return;
    }

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
    // NEW: Query keys for total and remaining items
    const queryKeyForTotalExpeditionItems = ["totalExpeditionItems", expedition, formattedDate];
    const queryKeyForRemainingExpeditionItems = ["remainingExpeditionItems", expedition, formattedDate];


    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "DUPLICATE_SCANNED_TODAY_ID_REKOMENDASI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierName: string | null = null;
    let expedisiRecord: any = null;
    let isNewExpedisiEntry = false; // NEW: Flag to track if this scan creates a new tbl_expedisi entry
    let wasFlagNo = false; // NEW: Flag to track if the expedisi record was 'NO' before scan

    try {
      // 1. Check if resi has already been PROCESSED (flag = YES in tbl_expedisi)
      if (derivedRecentProcessedResiNumbers.has(normalizedCurrentResi)) {
        validationStatus = 'DUPLICATE_PROCESSED';
        // Fetch details from tbl_resi for the toast message
        const { data: resiDetails, error: resiDetailsError } = await supabase
            .from("tbl_resi")
            .select("created, Keterangan, nokarung, schedule") // Include schedule
            .eq("Resi", currentResi)
            .maybeSingle();

        let keterangan = "Tidak Diketahui";
        let processedDate = "Tidak Diketahui";
        let nokarung = "Tidak Diketahui";
        
        if (resiDetails && !resiDetailsError) {
            processedDate = resiDetails.created ? format(new Date(resiDetails.created), "dd/MM/yyyy HH:mm") : "Tidak Diketahui";
            if (resiDetails.schedule === "batal") {
              validationMessage = `BATAL ${processedDate}`; // Simplified message for 'batal' schedule
            } else {
              keterangan = resiDetails.Keterangan || "Tidak Diketahui";
              nokarung = resiDetails.nokarung || "Tidak Diketahui";
              validationMessage = `DOUBLE! Resi ini ${keterangan} sudah diproses pada ${processedDate} di karung ${nokarung}.`;
            }
        } else {
            // Fallback to expedisi data if resiDetails not found (shouldn't happen if flag is YES)
            const processedExpedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);
            if (processedExpedisiRecord) {
                keterangan = processedExpedisiRecord.couriername || "Tidak Diketahui";
                processedDate = processedExpedisiRecord.created ? format(new Date(processedExpedisiRecord.created), "dd/MM/yyyy HH:mm") : "Tidak Diketahui";
                validationMessage = `DOUBLE! Resi ini ${expedisiRecord.couriername} sudah diproses pada ${processedDate}.`; // No nokarung from expedisi
            } else {
                validationMessage = `DOUBLE! Resi ini sudah diproses.`; // Generic fallback
            }
        }
      }

      // 2. Attempt to find expedisiRecord from caches or direct RPC call
      // This step is crucial to determine if the resi exists in tbl_expedisi at all.
      if (validationStatus === 'OK') { // Only proceed if not already a processed duplicate
        console.time("handleScanResi_expedisi_lookup");
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
                isNewExpedisiEntry = false; // It was found, so not a new entry
                // Optimistically update allExpedisiDataUnfiltered and allFlagNoExpedisiData if a new record is found via RPC
                queryClient.setQueryData(["allExpedisiDataUnfiltered", formattedToday], (oldMap: Map<string, any> | undefined) => {
                  const newMap = new Map(oldMap || []);
                  newMap.set(normalizedCurrentResi, expedisiRecord);
                  return newMap;
                });
                queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
                  const newMap = new Map(oldMap || []);
                  if (expedisiRecord.flag === 'NO') {
                    newMap.set(normalizedCurrentResi, expedisiRecord);
                  }
                  return newMap;
                });
            } else {
              // If not found in any cache and not found via direct RPC, it's a truly new entry for tbl_expedisi
              isNewExpedisiEntry = true;
            }
        } else {
          // If found in cache, check its flag status
          if (expedisiRecord.flag === 'NO') {
            wasFlagNo = true;
          }
        }
        console.timeEnd("handleScanResi_expedisi_lookup");
      }

      // 3. Determine actualCourierName and final validationStatus based on expedisiRecord presence
      if (validationStatus === 'OK') { // Still OK after processed check
        if (expedition === 'ID') {
          if (expedisiRecord) {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier === 'ID') {
              actualCourierName = 'ID'; // Resi ID yang ada di tbl_expedisi
            } else {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`;
            }
          } else {
            // Resi ID yang TIDAK ada di tbl_expedisi (ID_REKOMENDASI)
            actualCourierName = 'ID_REKOMENDASI';
            // For ID_REKOMENDASI, we MUST check tbl_resi for duplicates
            if (allResiForExpedition) {
              const isAlreadyScannedToday = allResiForExpedition.some(item =>
                (item.Resi || "").toLowerCase() === normalizedCurrentResi
              );
              if (isAlreadyScannedToday) {
                validationStatus = 'DUPLICATE_SCANNED_TODAY_ID_REKOMENDASI';
                validationMessage = `DOUBLE! Resi ID Rekomendasi ini sudah dipindai hari ini.`;
              }
            }
          }
        } else { // Non-ID expedition
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
        playBeep(beepDouble); // Play double beep for any duplicate or validation error
        setIsProcessing(false);
        keepFocus();
        console.timeEnd("handleScanResi_total");
        return;
      }

      // --- If all OK, proceed with optimistic update and saving to IndexedDB ---
      console.time("handleScanResi_optimistic_updates");
      
      // Optimistically update localCurrentCount immediately for instant UI feedback
      // setLocalCurrentCount(prevCount => prevCount + 1); // REMOVED: No longer needed

      // NEW: Optimistically update total and remaining items
      setOptimisticTotalExpeditionItems(prev => prev + (isNewExpedisiEntry ? 1 : 0));
      setOptimisticRemainingExpeditionItems(prev => prev - (wasFlagNo ? 1 : 0));

      // Optimistically update allResiForExpedition (the local cache for tbl_resi)
      queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
        const newData = [...(oldData || [])];
        const existingResiIndex = newData.findIndex(item => (item.Resi || "").toLowerCase() === normalizedCurrentResi);
        const newResiEntry: ResiExpedisiData = {
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          Keterangan: actualCourierName,
          schedule: "ontime", // Default schedule for new scans
        };

        if (existingResiIndex !== -1) {
          // If it exists (e.g., was 'batal' and now re-scanned), update it
          newData[existingResiIndex] = { ...newData[existingResiIndex], ...newResiEntry };
        } else {
          // Otherwise, add as a new entry
          newData.push(newResiEntry);
        }
        return newData;
      });

      // 1. Optimistically update allExpedisiDataUnfiltered
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

      // 2. Optimistically update allFlagNoExpedisiData (remove the scanned resi)
      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        newMap.delete(normalizedCurrentResi);
        return newMap;
      });

      // 3. Invalidate queries for Input page display (these are smaller and derived)
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay }); // allResiForExpedition
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary }); // karungSummary
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems }); // NEW
        queryClient.invalidateQueries({ queryKey: queryKeyForRemainingExpeditionItems }); // NEW
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
      playBeep(beepFailure); // Changed to beepFailure

      // Revert localCurrentCount on error (this remains synchronous for immediate feedback)
      // setLocalCurrentCount(prevCount => Math.max(0, prevCount - 1)); // REMOVED: No longer needed
      
      // NEW: Revert optimistic total and remaining items on error
      setOptimisticTotalExpeditionItems(prev => prev - (isNewExpedisiEntry ? 1 : 0));
      setOptimisticRemainingExpeditionItems(prev => prev + (wasFlagNo ? 1 : 0));

      // Invalidate queries to ensure they refetch to correct state after error
      // These invalidations are important for reverting the UI to the correct state
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay });
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", formattedToday] });
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems }); // NEW
        queryClient.invalidateQueries({ queryKey: queryKeyForRemainingExpeditionItems }); // NEW
      });
    } finally {
      setIsProcessing(false);
      keepFocus();
      console.timeEnd("handleScanResi_total"); // End total timing
    }
  }, [resiNumber, expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allFlagNoExpedisiData, allResiForExpedition, queryClient, triggerSync, validateInput, derivedRecentProcessedResiNumbers, startTransition, isProcessing]);

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing: isProcessing || isPending,
    isLoadingRecentScannedResiNumbers: false, // Always false now as the query is removed
    isLoadingAllFlagNoExpedisiData,
    // currentCount: localCurrentCount, // REMOVED: No longer returned from here
    optimisticTotalExpeditionItems, // NEW
    optimisticRemainingExpeditionItems, // NEW
  };
};