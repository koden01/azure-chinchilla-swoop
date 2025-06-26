import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepSabar, beepStart } from "@/utils/audio"; // Import beepStart
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
  const { triggerSync: debouncedTriggerSync } = useBackgroundSync(); // Use debouncedTriggerSync
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  React.useEffect(() => {
    setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
  }, [initialTotalExpeditionItems]);

  React.useEffect(() => {
    setOptimisticRemainingExpeditionItems(initialRemainingExpeditionItems || 0);
  }, [initialRemainingExpeditionItems]);

  React.useEffect(() => { // NEW: Effect for ID scan count
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
        "resino, couriername, created, flag, cekfu", // Hanya pilih kolom yang diperlukan
        (query) => query.eq("flag", "NO")
      );
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
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
    playBeep(beepStart); 
    
    setIsProcessing(true); 

    if (isPending) { 
      console.warn("[useResiScanner] UI update pending. Ignoring rapid input.");
      playBeep(beepSabar);
      setIsProcessing(false); 
      keepFocus();
      return;
    }

    dismissToast();
    const currentResi = resiNumber.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim();
    setResiNumber(""); 

    if (!validateInput(currentResi)) {
      setIsProcessing(false); 
      keepFocus();
      return;
    }

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
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        if (!expedisiRecord) {
            const { data: directExpedisiDataArray, error: directExpedisiError } = await supabase.rpc("get_expedisi_by_resino_case_insensitive", {
              p_resino: currentResi,
            });

            if (directExpedisiError) {
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

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        if (validationStatus === 'NOT_FOUND_EXPEDISI' || validationStatus === 'MISMATCH_EXPEDISI') { 
          playBeep(beepFailure);
        } else { 
          playBeep(beepDouble);
        }
        setIsProcessing(false);
        keepFocus();
        return;
      }

      setOptimisticTotalExpeditionItems(prev => {
        const newTotal = prev + (isNewExpedisiEntry ? 1 : 0);
        return newTotal;
      });
      setOptimisticRemainingExpeditionItems(prev => {
        const newRemaining = prev - (wasFlagNo ? 1 : 0);
        return newRemaining;
      });
      
      if (expedition === 'ID') {
        setOptimisticIdExpeditionScanCount(prev => {
          const newIdScanCount = prev + 1;
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
      
      debouncedTriggerSync(); // Use debouncedTriggerSync

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

      setOptimisticTotalExpeditionItems(prev => {
        const revertedTotal = prev - (isNewExpedisiEntry ? 1 : 0);
        return revertedTotal;
      });
      setOptimisticRemainingExpeditionItems(prev => {
        const revertedRemaining = prev + (wasFlagNo ? 1 : 0);
        return revertedRemaining;
      });
      if (expedition === 'ID') {
        setOptimisticIdExpeditionScanCount(prev => {
          const revertedIdScanCount = prev - 1;
          return revertedIdScanCount;
        });
      }

      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay });
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", formattedToday] });
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForRemainingExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForIdExpeditionScanCount });
      });
    } finally {
      setIsProcessing(false);
      keepFocus();
    }
  }, [resiNumber, expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allFlagNoExpedisiData, allResiForExpedition, queryClient, debouncedTriggerSync, validateInput, derivedRecentProcessedResiNumbers, startTransition, isPending, initialTotalExpeditionItems, initialRemainingExpeditionItems, initialIdExpeditionScanCount]);

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