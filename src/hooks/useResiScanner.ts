import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepStart } from "@/utils/audio";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
// import { fetchAllDataPaginated } from "@/utils/supabaseFetch"; // Menghapus fetchAllDataPaginated
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { ResiExpedisiData } from "@/hooks/useResiInputData";

interface UseResiScannerProps {
  expedition: string;
  selectedKarung: string;
  formattedDate: string;
  allExpedisiDataUnfiltered: Map<string, any> | undefined;
  allResiForExpedition: any[] | undefined;
  initialTotalExpeditionItems: number | undefined;
  initialRemainingExpeditionItems: number | undefined;
  initialIdExpeditionScanCount: number | undefined;
  allFlagNoExpedisiData: Map<string, any> | undefined;
  allFlagYesExpedisiResiNumbers: Set<string> | undefined;
}

export const useResiScanner = ({ 
  expedition, 
  selectedKarung, 
  formattedDate,
  allExpedisiDataUnfiltered,
  allResiForExpedition,
  initialTotalExpeditionItems,
  initialRemainingExpeditionItems,
  initialIdExpeditionScanCount,
  allFlagNoExpedisiData,
  allFlagYesExpedisiResiNumbers,
}: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [optimisticTotalExpeditionItems, setOptimisticTotalExpeditionItems] = React.useState(initialTotalExpeditionItems || 0);
  const [optimisticRemainingExpeditionItems, setOptimisticRemainingExpeditionItems] = React.useState(initialRemainingExpeditionItems || 0);
  const [optimisticIdExpeditionScanCount, setOptimisticIdExpeditionScanCount] = React.useState(initialIdExpeditionScanCount || 0);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { triggerSync: debouncedTriggerSync } = useBackgroundSync();
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedToday];
  const queryKeyForKarungSummary = ["karungSummary", expedition, formattedToday];
  const queryKeyForTotalExpeditionItems = ["totalExpeditionItems", expedition, formattedToday];
  const queryKeyForRemainingExpeditionItems = ["remainingExpeditionItems", expedition, formattedToday];
  const queryKeyForIdExpeditionScanCount = ["idExpeditionScanCount", formattedToday];

  const scannerInputBuffer = React.useRef<string>('');
  const lastKeyPressTime = React.useRef<number>(0);
  const SCANNER_TIMEOUT_MS = 500;

  React.useEffect(() => {
    setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
  }, [initialTotalExpeditionItems]);

  React.useEffect(() => {
    setOptimisticRemainingExpeditionItems(initialRemainingExpeditionItems || 0);
  }, [initialRemainingExpeditionItems]);

  React.useEffect(() => {
    setOptimisticIdExpeditionScanCount(initialIdExpeditionScanCount || 0);
  }, [initialIdExpeditionScanCount]);

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

  const processScannedResi = React.useCallback(async (scannedResi: string) => {
    playBeep(beepStart); 
    
    setIsProcessing(true); 

    if (isPending) { 
      console.warn("[useResiScanner] UI update pending. Ignoring rapid input.");
      setIsProcessing(false); 
      return;
    }

    dismissToast();
    const currentResi = scannedResi.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim();
    setResiNumber("");

    if (!validateInput(currentResi)) {
      setIsProcessing(false); 
      return;
    }

    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "MISMATCH_EXPEDISI" | "NOT_FOUND_IN_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierNameForResiTable: string | null = null;
    let actualScheduleForResiTable: string | null = null;
    let expedisiRecordFromCache: any = null;
    let wasFlagNo = false;

    try {
      if (allFlagYesExpedisiResiNumbers?.has(normalizedCurrentResi)) {
        validationStatus = 'DUPLICATE_PROCESSED';
        const { data: resiDetails, error: resiDetailsError } = await supabase
            .from("tbl_resi")
            .select("created, Keterangan, nokarung, schedule")
            .eq("Resi", currentResi)
            .maybeSingle();

        let processedDate = "Tidak Diketahui";
        let keterangan = "Tidak Diketahui";
        let nokarung = "Tidak Diketahui";

        if (resiDetails && !resiDetailsError) {
            processedDate = resiDetails.created ? format(new Date(resiDetails.created), "dd/MM/yyyy HH:mm") : processedDate;
            keterangan = resiDetails.Keterangan || keterangan;
            nokarung = resiDetails.nokarung || nokarung;
            if (resiDetails.schedule === "batal") {
              validationMessage = `BATAL! Resi ini sudah dibatalkan pada ${processedDate}.`;
            } else {
              validationMessage = `DOUBLE! Resi ini ${keterangan} sudah diproses pada ${processedDate} di karung ${nokarung}.`;
            }
        } else {
            const expedisiFromTodayCache = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);
            if (expedisiFromTodayCache) {
              processedDate = expedisiFromTodayCache.created ? format(new Date(expedisiFromTodayCache.created), "dd/MM/yyyy HH:mm") : processedDate;
              keterangan = expedisiFromTodayCache.couriername || keterangan;
            }
            validationMessage = `DOUBLE! Resi ini sudah diproses pada ${processedDate}.`;
        }
      } else if (allFlagNoExpedisiData?.has(normalizedCurrentResi)) {
        expedisiRecordFromCache = allFlagNoExpedisiData.get(normalizedCurrentResi);
        wasFlagNo = true;
        actualCourierNameForResiTable = normalizeExpeditionName(expedisiRecordFromCache.couriername);
        actualScheduleForResiTable = "ontime";
      } else {
        if (normalizeExpeditionName(expedition) === 'ID') {
          actualCourierNameForResiTable = "ID_REKOMENDASI";
          actualScheduleForResiTable = "idrek";
        } else {
          validationStatus = 'NOT_FOUND_IN_EXPEDISI';
          validationMessage = `Data resi ${currentResi} tidak ditemukan di database.`;
        }
      }

      if (validationStatus === 'OK' && expedisiRecordFromCache) {
        const normalizedExpedisiCourierName = normalizeExpeditionName(expedisiRecordFromCache.couriername);
        const normalizedSelectedExpedition = normalizeExpeditionName(expedition);

        const isIdMatch = (normalizedSelectedExpedition === 'ID' && (normalizedExpedisiCourierName === 'ID' || normalizedExpedisiCourierName === 'ID_REKOMENDASI'));
        const isDirectMatch = (normalizedSelectedExpedition === normalizedExpedisiCourierName);

        if (!isIdMatch && !isDirectMatch) {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini terdaftar untuk ekspedisi ${expedisiRecordFromCache.couriername}, bukan ${expedition}.`;
        }
      }

      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        if (validationStatus === 'MISMATCH_EXPEDISI' || validationStatus === 'NOT_FOUND_IN_EXPEDISI') {
          playBeep(beepFailure);
        } else {
          playBeep(beepDouble);
        }
        setIsProcessing(false);
        return;
      }

      setOptimisticTotalExpeditionItems(prev => {
        const isTrulyNewIdEntry = (normalizeExpeditionName(expedition) === 'ID' && !expedisiRecordFromCache);
        return prev + (isTrulyNewIdEntry ? 1 : 0);
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
          Keterangan: actualCourierNameForResiTable,
          schedule: actualScheduleForResiTable,
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
          couriername: actualCourierNameForResiTable,
        });
        return newMap;
      });

      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        newMap.delete(normalizedCurrentResi);
        return newMap;
      });

      queryClient.setQueryData(["allFlagYesExpedisiResiNumbers", format(today, "yyyy-MM-dd"), format(today, "yyyy-MM-dd")], (oldSet: Set<string> | undefined) => {
        const newSet = new Set(oldSet || []);
        newSet.add(normalizedCurrentResi);
        return newSet;
      });
      
      showSuccess(`Resi ${currentResi} Berhasil`);
      playBeep(beepSuccess);

      await addPendingOperation({
        id: `scan-${currentResi}-${Date.now()}`,
        type: "scan",
        payload: {
          resiNumber: currentResi,
          selectedKarung: selectedKarung,
          courierNameFromExpedisi: actualCourierNameForResiTable,
        },
        timestamp: Date.now(),
      });
      
      debouncedTriggerSync();

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

      setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
      setOptimisticRemainingExpeditionItems(initialRemainingExpeditionItems || 0);
      setOptimisticIdExpeditionScanCount(initialIdExpeditionScanCount || 0);

      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay });
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary });
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", formattedToday] });
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForRemainingExpeditionItems });
        queryClient.invalidateQueries({ queryKey: queryKeyForIdExpeditionScanCount });
        queryClient.invalidateQueries({ queryKey: ["allFlagYesExpedisiResiNumbers"] });
      });
    } finally {
      setIsProcessing(false);
    }
  }, [expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allFlagNoExpedisiData, allResiForExpedition, queryClient, debouncedTriggerSync, validateInput, startTransition, isPending, initialTotalExpeditionItems, initialRemainingExpeditionItems, initialIdExpeditionScanCount, queryKeyForInputPageDisplay, queryKeyForKarungSummary, queryKeyForTotalExpeditionItems, queryKeyForRemainingExpeditionItems, queryKeyForIdExpeditionScanCount, allFlagYesExpedisiResiNumbers]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (isProcessing || !expedition || !selectedKarung) {
        return;
      }

      const currentTime = Date.now();
      
      if (currentTime - lastKeyPressTime.current > SCANNER_TIMEOUT_MS) {
        scannerInputBuffer.current = '';
      }
      lastKeyPressTime.current = currentTime;

      if (event.key === 'Enter') {
        event.preventDefault();
        if (scannerInputBuffer.current.length > 0) {
          setResiNumber(scannerInputBuffer.current);
          processScannedResi(scannerInputBuffer.current);
          scannerInputBuffer.current = '';
        }
      } else if (event.key.length === 1) {
        scannerInputBuffer.current += event.key;
        setResiNumber(scannerInputBuffer.current);
      } else if (event.key === 'Backspace') {
        scannerInputBuffer.current = scannerInputBuffer.current.slice(0, -1);
        setResiNumber(scannerInputBuffer.current);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isProcessing, expedition, selectedKarung, processScannedResi]);


  return {
    resiNumber,
    setResiNumber,
    handleScanResi: processScannedResi,
    resiInputRef,
    isProcessing: isProcessing || isPending,
    isLoadingRecentScannedResiNumbers: false,
    isLoadingAllFlagNoExpedisiData: false,
    optimisticTotalExpeditionItems,
    optimisticRemainingExpeditionItems,
    optimisticIdExpeditionScanCount,
  };
};