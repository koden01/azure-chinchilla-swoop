import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepSabar } from "@/utils/audio";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { useBackgroundSync } from "@/hooks/useBackgroundSync"; // Menambahkan impor ini

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string;
  allExpedisiDataUnfiltered: Map<string, any> | undefined;
  allResiForExpedition: any[] | undefined;
  initialTotalExpeditionItems: number | undefined;
  initialRemainingExpeditionItems: number | undefined;
}

export const useResiScanner = ({ 
  expedition, 
  selectedKarung, 
  formattedDate,
  allExpedisiDataUnfiltered,
  allResiForExpedition,
  initialTotalExpeditionItems,
  initialRemainingExpeditionItems,
}: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [optimisticTotalExpeditionItems, setOptimisticTotalExpeditionItems] = React.useState(initialTotalExpeditionItems || 0);
  const [optimisticRemainingExpeditionItems, setOptimisticRemainingExpeditionItems] = React.useState(initialRemainingExpeditionItems || 0);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { triggerSync } = useBackgroundSync();
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  React.useEffect(() => {
    setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
  }, [initialTotalExpeditionItems]);

  React.useEffect(() => {
    setOptimisticRemainingExpeditionItems(initialRemainingExpeditionItems || 0);
  }, [initialRemainingExpeditionItems]);

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
    // Set isProcessing to true at the very beginning to immediately disable input
    setIsProcessing(true); 

    // NEW: Defensive check for rapid scans, now that isProcessing is true immediately
    if (isPending) { // Only check isPending here, as isProcessing is already true
      console.warn("[useResiScanner] UI update pending. Ignoring rapid input.");
      playBeep(beepSabar);
      setIsProcessing(false); // Reset if we're just waiting for UI transition
      keepFocus();
      return;
    }

    console.time("handleScanResi_total");
    dismissToast();
    const currentResi = resiNumber.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim();
    setResiNumber("");

    console.time("handleScanResi_validation_sync");
    if (!validateInput(currentResi)) {
      setIsProcessing(false); // Reset if validation fails
      keepFocus();
      console.timeEnd("handleScanResi_validation_sync");
      console.timeEnd("handleScanResi_total");
      return;
    }
    console.timeEnd("handleScanResi_validation_sync");

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];
    const queryKeyForKarungSummary = ["karungSummary", expedition, formattedDate];
    const queryKeyForTotalExpeditionItems = ["totalExpeditionItems", expedition, formattedDate];
    const queryKeyForRemainingExpeditionItems = ["remainingExpeditionItems", expedition, formattedDate];

    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "DUPLICATE_SCANNED_TODAY_ID_REKOMENDASI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierName: string | null = null;
    let expedisiRecord: any = null;
    let isNewExpedisiEntry = false;
    let wasFlagNo = false;

    try {
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
      }

      if (validationStatus === 'OK') {
        console.time("handleScanResi_expedisi_lookup");
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        if (!expedisiRecord) {
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
              isNewExpedisiEntry = true;
            }
        } else {
          if (expedisiRecord.flag === 'NO') {
            wasFlagNo = true;
          }
        }
        console.timeEnd("handleScanResi_expedisi_lookup");
      }

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
        if (validationStatus === 'NOT_FOUND_EXPEDISI' || validationStatus === 'MISMATCH_EXPEDISI') { // Play beepFailure for NOT_FOUND and MISMATCH
          playBeep(beepFailure);
        } else { // Play beepDouble for other duplicates
          playBeep(beepDouble);
        }
        setIsProcessing(false);
        keepFocus();
        console.timeEnd("handleScanResi_total");
        return;
      }

      // --- If all OK, proceed with optimistic update and saving to IndexedDB ---
      console.time("handleScanResi_optimistic_updates");
      
      setOptimisticTotalExpeditionItems(prev => prev + (isNewExpedisiEntry ? 1 : 0));
      setOptimisticRemainingExpeditionItems(prev => prev - (wasFlagNo ? 1 : 0));

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
        } else {
          newData.push(newResiEntry);
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
        return newMap;
      });

      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        newMap.delete(normalizedCurrentResi);
        return newMap;
      });

      // Removed specific invalidateQueries for Input page display here.
      // Rely on triggerSync to invalidate and refetch after successful background sync.
      // This ensures optimistic updates persist until actual data is fetched.
      startTransition(() => {
        // Only invalidate the derived counts that are not directly updated by setQueryData
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForRemainingExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary }); // Invalidate karung summary as it's derived from tbl_resi
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

      setOptimisticTotalExpeditionItems(prev => prev - (isNewExpedisiEntry ? 1 : 0));
      setOptimisticRemainingExpeditionItems(prev => prev + (wasFlagNo ? 1 : 0));

      // Invalidate queries to ensure they refetch to correct state after error
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay });
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", formattedToday] });
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForRemainingExpeditionItems });
      });
    } finally {
      setIsProcessing(false);
      keepFocus();
      console.timeEnd("handleScanResi_total");
    }
  }, [resiNumber, expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allFlagNoExpedisiData, allResiForExpedition, queryClient, triggerSync, validateInput, derivedRecentProcessedResiNumbers, startTransition, isPending, initialTotalExpeditionItems, initialRemainingExpeditionItems]);

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
  };
};