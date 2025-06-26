import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepSabar } from "@/utils/audio";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { ResiExpedisiData } from "@/hooks/useResiInputData"; // Import ResiExpedisiData

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string;
  allExpedisiDataUnfiltered: Map<string, any> | undefined;
  allResiForExpedition: any[] | undefined;
  initialTotalExpeditionItems: number | undefined;
  initialRemainingExpeditionItems: number | undefined;
  initialIdExpeditionScanCount: number | undefined; // NEW: Add initial ID scan count
}

export const useResiScanner = ({ 
  expedition, 
  selectedKarung, 
  formattedDate,
  allExpedisiDataUnfiltered,
  allResiForExpedition,
  initialTotalExpeditionItems,
  initialRemainingExpeditionItems,
  initialIdExpeditionScanCount, // NEW
}: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [optimisticTotalExpeditionItems, setOptimisticTotalExpeditionItems] = React.useState(initialTotalExpeditionItems || 0);
  const [optimisticRemainingExpeditionItems, setOptimisticRemainingExpeditionItems] = React.useState(initialRemainingExpeditionItems || 0);
  const [optimisticIdExpeditionScanCount, setOptimisticIdExpeditionScanCount] = React.useState(initialIdExpeditionScanCount || 0); // NEW
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { triggerSync } = useBackgroundSync();
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  React.useEffect(() => {
    console.log("[useResiScanner] Initializing optimisticTotalExpeditionItems:", initialTotalExpeditionItems);
    setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
  }, [initialTotalExpeditionItems]);

  React.useEffect(() => {
    console.log("[useResiScanner] Initializing optimisticRemainingExpeditionItems:", initialRemainingExpeditionItems);
    setOptimisticRemainingExpeditionItems(initialRemainingExpeditionItems || 0);
  }, [initialRemainingExpeditionItems]);

  React.useEffect(() => { // NEW: Effect for ID scan count
    console.log("[useResiScanner] Initializing optimisticIdExpeditionScanCount:", initialIdExpeditionScanCount);
    setOptimisticIdExpeditionScanCount(initialIdExpeditionScanCount || 0);
  }, [initialIdExpeditionScanCount]);

  const { data: allFlagNoExpedisiData, isLoading: isLoadingAllFlagNoExpedisiData } = useQuery<Map<string, any>>({
    queryKey: ["allFlagNoExpedisiData"],
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        undefined,
        undefined,
        undefined,
        "*",
        (query) => query.eq("flag", "NO")
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
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    enabled: true,
  });

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
    }, 0);
  };

  const validateInput = (resi: string) => {
    console.log(`[useResiScanner] Validating input: '${resi}'`);
    if (!resi) {
      showError("Nomor resi tidak boleh kosong.");
      playBeep(beepFailure);
      console.log("[useResiScanner] Validation failed: Empty resi.");
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Mohon pilih Expedisi dan No Karung terlebih dahulu.");
      playBeep(beepFailure);
      console.log("[useResiScanner] Validation failed: Expedition or Karung not selected.");
      return false;
    }
    console.log("[useResiScanner] Input validation passed.");
    return true;
  };

  const handleScanResi = React.useCallback(async () => {
    console.log("--- [handleScanResi] START ---");
    // Set isProcessing to true at the very beginning to immediately disable input
    setIsProcessing(true); 

    // NEW: Defensive check for rapid scans, now that isProcessing is true immediately
    if (isPending) { // Only check isPending here, as isProcessing is already true
      console.warn("[useResiScanner] UI update pending. Ignoring rapid input.");
      playBeep(beepSabar);
      setIsProcessing(false); // Reset if we're just waiting for UI transition
      keepFocus();
      console.log("--- [handleScanResi] END (Pending UI) ---");
      return;
    }

    console.time("handleScanResi_total");
    dismissToast();
    const currentResi = resiNumber.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim();
    console.log(`[handleScanResi] Scanned Resi: '${currentResi}' (Normalized: '${normalizedCurrentResi}')`);
    setResiNumber(""); // Clear input immediately

    console.time("handleScanResi_validation_sync");
    if (!validateInput(currentResi)) {
      setIsProcessing(false); // Reset if validation fails
      keepFocus();
      console.timeEnd("handleScanResi_validation_sync");
      console.timeEnd("handleScanResi_total");
      console.log("--- [handleScanResi] END (Validation Failed) ---");
      return;
    }
    console.timeEnd("handleScanResi_validation_sync");

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];
    const queryKeyForKarungSummary = ["karungSummary", expedition, formattedDate];
    const queryKeyForTotalExpeditionItems = ["totalExpeditionItems", expedition, formattedDate];
    const queryKeyForRemainingExpeditionItems = ["remainingExpeditionItems", expedition, formattedDate];
    const queryKeyForIdExpeditionScanCount = ["idExpeditionScanCount", formattedDate]; // NEW

    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "DUPLICATE_SCANNED_TODAY_ID_REKOMENDASI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierName: string | null = null;
    let expedisiRecord: any = null;
    let isNewExpedisiEntry = false;
    let wasFlagNo = false;

    try {
      console.log("[handleScanResi] Checking for DUPLICATE_PROCESSED...");
      if (derivedRecentProcessedResiNumbers.has(normalizedCurrentResi)) {
        validationStatus = 'DUPLICATE_PROCESSED';
        const { data: resiDetails, error: resiDetailsError } = await supabase
            .from("tbl_resi")
            .select("created, Keterangan, nokarung, schedule")
            .eq("Resi", currentResi)
            .maybeSingle();

        let keterangan = "Tidak Diketahui";
        let processedDate = "Tidak Diketahui";
        let nokarung = "Tidak Diketahui";
        
        if (resiDetails && !resiDetailsError) {
            processedDate = resiDetails.created ? format(new Date(resiDetails.created), "dd/MM/yyyy HH:mm") : "Tidak Diketahui";
            if (resiDetails.schedule === "batal") {
              validationMessage = `BATAL ${processedDate}`;
            } else {
              keterangan = resiDetails.Keterangan || "Tidak Diketahui";
              nokarung = resiDetails.nokarung || "Tidak Diketahui";
              validationMessage = `DOUBLE! Resi ini ${keterangan} sudah diproses pada ${processedDate} di karung ${nokarung}.`;
            }
        } else {
            const processedExpedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);
            if (processedExpedisiRecord) {
                keterangan = processedExpedisiRecord.couriername || "Tidak Diketahui";
                processedDate = processedExpedisiRecord.created ? format(new Date(processedExpedisiRecord.created), "dd/MM/yyyy HH:mm") : "Tidak Diketahui";
                validationMessage = `DOUBLE! Resi ini ${expedisiRecord.couriername} sudah diproses pada ${processedDate}.`;
            } else {
                validationMessage = `DOUBLE! Resi ini sudah diproses.`;
            }
        }
        console.log(`[handleScanResi] Validation Status: ${validationStatus}, Message: ${validationMessage}`);
      }

      if (validationStatus === 'OK') {
        console.time("handleScanResi_expedisi_lookup");
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);
        console.log(`[handleScanResi] Lookup in allExpedisiDataUnfiltered: ${expedisiRecord ? 'Found' : 'Not Found'}`);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
          console.log(`[handleScanResi] Lookup in allFlagNoExpedisiData: ${expedisiRecord ? 'Found' : 'Not Found'}`);
        }

        if (!expedisiRecord) {
            console.log("[handleScanResi] Direct RPC call for get_expedisi_by_resino_case_insensitive...");
            console.time("rpc_get_expedisi_by_resino");
            const { data: directExpedisiDataArray, error: directExpedisiError } = await supabase.rpc("get_expedisi_by_resino_case_insensitive", {
              p_resino: currentResi,
            });
            console.timeEnd("rpc_get_expedisi_by_resino");

            if (directExpedisiError) {
                console.error(`[useResiScanner] Error during direct fetch:`, directExpedisiError);
                throw directExpedisiError;
            }
            
            if (directExpedisiDataArray && directExpedisiDataArray.length > 0) {
                expedisiRecord = directExpedisiDataArray[0];
                isNewExpedisiEntry = false;
                console.log(`[handleScanResi] Direct RPC found expedisi record:`, expedisiRecord);
                // Optimistically update local cache for allExpedisiDataUnfiltered
                queryClient.setQueryData(["allExpedisiDataUnfiltered", formattedToday], (oldMap: Map<string, any> | undefined) => {
                  const newMap = new Map(oldMap || []);
                  newMap.set(normalizedCurrentResi, expedisiRecord);
                  console.log("[handleScanResi] Optimistically updated allExpedisiDataUnfiltered cache.");
                  return newMap;
                });
                // Optimistically update local cache for allFlagNoExpedisiData if applicable
                queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
                  const newMap = new Map(oldMap || []);
                  if (expedisiRecord.flag === 'NO') {
                    newMap.set(normalizedCurrentResi, expedisiRecord);
                    console.log("[handleScanResi] Optimistically updated allFlagNoExpedisiData cache.");
                  }
                  return newMap;
                });
            } else {
              isNewExpedisiEntry = true;
              console.log("[handleScanResi] Resi not found in any expedisi data. Will be treated as new entry.");
            }
        } else {
          if (expedisiRecord.flag === 'NO') {
            wasFlagNo = true;
            console.log("[handleScanResi] Existing expedisi record found with flag 'NO'.");
          } else {
            console.log("[handleScanResi] Existing expedisi record found with flag 'YES'.");
          }
        }
        console.timeEnd("handleScanResi_expedisi_lookup");
      }

      if (validationStatus === 'OK') {
        console.log(`[handleScanResi] Checking expedition type: '${expedition}'`);
        if (expedition === 'ID') {
          if (expedisiRecord) {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier === 'ID') {
              actualCourierName = 'ID';
              console.log("[handleScanResi] Matched ID expedition with existing record.");
            } else {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`;
              console.log(`[handleScanResi] Validation Status: ${validationStatus}, Message: ${validationMessage}`);
            }
          } else {
            actualCourierName = 'ID_REKOMENDASI';
            console.log("[handleScanResi] Treating as new ID_REKOMENDASI resi.");
            if (allResiForExpedition) {
              const isAlreadyScannedToday = allResiForExpedition.some(item =>
                (item.Resi || "").toLowerCase() === normalizedCurrentResi
              );
              if (isAlreadyScannedToday) {
                validationStatus = 'DUPLICATE_SCANNED_TODAY_ID_REKOMENDASI';
                validationMessage = `DOUBLE! Resi ID Rekomendasi ini sudah dipindai hari ini.`;
                console.log(`[handleScanResi] Validation Status: ${validationStatus}, Message: ${validationMessage}`);
              }
            }
          }
        } else {
          if (!expedisiRecord) {
            validationStatus = 'NOT_FOUND_EXPEDISI';
            validationMessage = 'Data tidak ada di database ekspedisi.';
            console.log(`[handleScanResi] Validation Status: ${validationStatus}, Message: ${validationMessage}`);
          } else {
            const normalizedExpedisiCourier = normalizeExpeditionName(expedisiRecord.couriername);
            if (normalizedExpedisiCourier !== expedition.toUpperCase()) {
              validationStatus = 'MISMATCH_EXPEDISI';
              validationMessage = `Resi milik ${expedisiRecord.couriername}`;
              console.log(`[handleScanResi] Validation Status: ${validationStatus}, Message: ${validationMessage}`);
            } else {
              actualCourierName = expedisiRecord.couriername;
              console.log(`[handleScanResi] Matched ${expedition} expedition with existing record.`);
            }
          }
        }
      }

      // --- FINAL ERROR HANDLING BLOCK ---
      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        if (validationStatus === 'NOT_FOUND_EXPEDISI' || validationStatus === 'MISMATCH_EXPEDISI') { // Play beepFailure for NOT_FOUND and MISMATCH
          playBeep(beepFailure);
        } else { // Play beepDouble for other duplicates
          playBeep(beepDouble);
        }
        setIsProcessing(false);
        keepFocus();
        console.timeEnd("handleScanResi_total");
        console.log("--- [handleScanResi] END (Validation Error) ---");
        return;
      }

      // --- If all OK, proceed with optimistic update and saving to IndexedDB ---
      console.time("handleScanResi_optimistic_updates");
      console.log("[handleScanResi] Applying optimistic updates...");
      
      // Log initial optimistic values
      console.log(`[handleScanResi] Before optimistic update: Total=${optimisticTotalExpeditionItems}, Remaining=${optimisticRemainingExpeditionItems}, ID Scan=${optimisticIdExpeditionScanCount}`);

      setOptimisticTotalExpeditionItems(prev => {
        const newTotal = prev + (isNewExpedisiEntry ? 1 : 0);
        console.log(`[handleScanResi] Optimistic Total: ${prev} -> ${newTotal} (isNewExpedisiEntry: ${isNewExpedisiEntry})`);
        return newTotal;
      });
      setOptimisticRemainingExpeditionItems(prev => {
        const newRemaining = prev - (wasFlagNo ? 1 : 0);
        console.log(`[handleScanResi] Optimistic Remaining: ${prev} -> ${newRemaining} (wasFlagNo: ${wasFlagNo})`);
        return newRemaining;
      });
      
      // NEW: Optimistic update for ID scan count
      if (expedition === 'ID') {
        setOptimisticIdExpeditionScanCount(prev => {
          const newIdScanCount = prev + 1;
          console.log(`[handleScanResi] Optimistic ID Scan Count: ${prev} -> ${newIdScanCount}`);
          return newIdScanCount;
        });
      }

      queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
        const newData = [...(oldData || [])];
        const existingResiIndex = newData.findIndex(item => (item.Resi || "").toLowerCase() === normalizedCurrentResi);
        const newResiEntry: ResiExpedisiData = {
          Resi: currentResi,
          nokarung: selectedKarung,
          created: new Date().toISOString(),
          Keterangan: actualCourierName,
          schedule: "ontime",
        };

        if (existingResiIndex !== -1) {
          newData[existingResiIndex] = { ...newData[existingResiIndex], ...newResiEntry };
          console.log(`[handleScanResi] Updated existing resi in cache: ${currentResi}`);
        } else {
          newData.push(newResiEntry);
          console.log(`[handleScanResi] Added new resi to cache: ${currentResi}`);
        }
        return newData;
      });

      queryClient.setQueryData(["allExpedisiDataUnfiltered", formattedToday], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        const existingExpedisi = newMap.get(normalizedCurrentResi);
        newMap.set(normalizedCurrentResi, {
          ...(existingExpedisi || { resino: currentResi, created: new Date().toISOString() }),
          flag: "YES",
          cekfu: false,
          couriername: actualCourierName || existingExpedisi?.couriername,
        });
        console.log(`[handleScanResi] Updated allExpedisiDataUnfiltered cache for ${currentResi}. Flag set to YES.`);
        return newMap;
      });

      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        newMap.delete(normalizedCurrentResi);
        console.log(`[handleScanResi] Removed ${currentResi} from allFlagNoExpedisiData cache.`);
        return newMap;
      });
      
      // REMOVED: startTransition(() => { ... queryClient.invalidateQueries(...) });
      // These invalidations will now be handled by useBackgroundSync after successful DB write.
      
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
      console.log(`[handleScanResi] Added pending operation for ${currentResi} to IndexedDB.`);
      
      triggerSync();
      console.log("[handleScanResi] Triggered background sync.");

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

      // Revert optimistic updates on error
      setOptimisticTotalExpeditionItems(prev => {
        const revertedTotal = prev - (isNewExpedisiEntry ? 1 : 0);
        console.log(`[handleScanResi] Reverting optimistic Total: ${prev} -> ${revertedTotal}`);
        return revertedTotal;
      });
      setOptimisticRemainingExpeditionItems(prev => {
        const revertedRemaining = prev + (wasFlagNo ? 1 : 0);
        console.log(`[handleScanResi] Reverting optimistic Remaining: ${prev} -> ${revertedRemaining}`);
        return revertedRemaining;
      });
      if (expedition === 'ID') {
        setOptimisticIdExpeditionScanCount(prev => {
          const revertedIdScanCount = prev - 1;
          console.log(`[handleScanResi] Reverting optimistic ID Scan Count: ${prev} -> ${revertedIdScanCount}`);
          return revertedIdScanCount;
        });
      }

      // Keep invalidation on error to ensure UI reflects actual DB state if optimistic update fails
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay });
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", formattedToday] });
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForRemainingExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForIdExpeditionScanCount });
        console.log("[handleScanResi] Invalidated queries to revert to actual state after error.");
      });
    } finally {
      setIsProcessing(false);
      keepFocus();
      console.timeEnd("handleScanResi_total");
      console.log("--- [handleScanResi] END (Finally) ---");
    }
  }, [resiNumber, expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allFlagNoExpedisiData, allResiForExpedition, queryClient, triggerSync, validateInput, derivedRecentProcessedResiNumbers, startTransition, isPending, initialTotalExpeditionItems, initialRemainingExpeditionItems, initialIdExpeditionScanCount]);

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing: isProcessing || isPending,
    isLoadingRecentScannedResiNumbers: false,
    isLoadingAllFlagNoExpedisiData,
    optimisticTotalExpeditionItems,
    optimisticRemainingExpeditionItems,
    optimisticIdExpeditionScanCount, // NEW: Return optimistic ID scan count
  };
};