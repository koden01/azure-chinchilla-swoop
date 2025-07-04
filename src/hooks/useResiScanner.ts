import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepStart } from "@/utils/audio";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
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

  // Buffer untuk input dari scanner
  const scannerInputBuffer = React.useRef<string>('');
  const lastKeyPressTime = React.useRef<number>(0);
  const SCANNER_TIMEOUT_MS = 50; // Waktu maksimum antar karakter untuk dianggap sebagai bagian dari satu scan

  React.useEffect(() => {
    setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
  }, [initialTotalExpeditionItems]);

  React.useEffect(() => {
    setOptimisticRemainingExpeditionItems(initialRemainingExpeditionItems || 0);
  }, [initialRemainingExpeditionItems]);

  React.useEffect(() => {
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
        "resino, couriername, created, flag, cekfu",
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
    setResiNumber(""); // Clear the displayed input immediately

    if (!validateInput(currentResi)) {
      setIsProcessing(false); 
      return;
    }

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];
    const queryKeyForKarungSummary = ["karungSummary", expedition, formattedDate];
    const queryKeyForTotalExpeditionItems = ["totalExpeditionItems", expedition, formattedDate];
    const queryKeyForRemainingExpeditionItems = ["remainingExpeditionItems", expedition, formattedDate];
    const queryKeyForIdExpeditionScanCount = ["idExpeditionScanCount", formattedDate];

    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "MISMATCH_EXPEDISI" | "NOT_FOUND_IN_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierNameForResiTable: string | null = null; // New variable for Keterangan in tbl_resi
    let actualScheduleForResiTable: string | null = null; // New variable for schedule in tbl_resi
    let expedisiRecord: any = null;
    let isNewExpedisiEntry = false;
    let wasFlagNo = false;

    try {
      // 1. Check for duplicate processed resi (flag 'YES' in tbl_expedisi or already in tbl_resi)
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
                validationMessage = `DOUBLE! Resi ini ${processedExpedisiRecord.couriername} sudah diproses pada ${processedDate}.`;
            } else {
                validationMessage = `DOUBLE! Resi ini sudah diproses.`;
            }
        }
      }

      // 2. If not a duplicate, try to find expedisi record
      if (validationStatus === 'OK') {
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        if (!expedisiRecord) {
            // Try RPC if not found in local caches
            const { data: directExpedisiDataArray, error: directExpedisiError } = await supabase.rpc("get_expedisi_by_resino_case_insensitive", {
              p_resino: currentResi,
            });

            if (directExpedisiError) {
                throw directExpedisiError;
            }
            
            if (directExpedisiDataArray && directExpedisiDataArray.length > 0) {
                expedisiRecord = directExpedisiDataArray[0];
                isNewExpedisiEntry = false;
                // Update local caches optimistically
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
              // Resi not found in tbl_expedisi at all
              isNewExpedisiEntry = true; 
              const normalizedSelectedExpedition = normalizeExpeditionName(expedition);
              if (normalizedSelectedExpedition !== 'ID') {
                validationStatus = 'NOT_FOUND_IN_EXPEDISI';
                validationMessage = `Resi ${currentResi} tidak ditemukan di database untuk ekspedisi ${expedition}.`;
              }
            }
        } else {
          if (expedisiRecord.flag === 'NO') {
            wasFlagNo = true;
          }
        }
      }

      // 3. Check for expedition mismatch if expedisiRecord was found and it's not a new entry
      if (validationStatus === 'OK' && expedisiRecord && !isNewExpedisiEntry) {
        const normalizedExpedisiCourierName = normalizeExpeditionName(expedisiRecord.couriername);
        const normalizedSelectedExpedition = normalizeExpeditionName(expedition);

        // Special handling for 'ID' which can match 'ID' or 'ID_REKOMENDASI'
        const isIdMatch = (normalizedSelectedExpedition === 'ID' && (normalizedExpedisiCourierName === 'ID' || normalizedExpedisiCourierName === 'ID_REKOMENDASI'));
        const isDirectMatch = (normalizedSelectedExpedition === normalizedExpedisiCourierName);

        if (!isIdMatch && !isDirectMatch) {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini terdaftar untuk ekspedisi ${expedisiRecord.couriername}, bukan ${expedition}.`;
        }
      }

      // Determine actualCourierNameForResiTable and actualScheduleForResiTable based on validation outcome
      if (validationStatus === 'OK') {
        if (expedition === 'ID' && isNewExpedisiEntry) {
          // For new 'ID' entries not found in tbl_expedisi
          actualCourierNameForResiTable = "ID_REKOMENDASI";
          actualScheduleForResiTable = "idrek";
        } else if (expedisiRecord) { // Resi found in tbl_expedisi
          actualCourierNameForResiTable = normalizeExpeditionName(expedisiRecord.couriername);
          actualScheduleForResiTable = "ontime"; // Default schedule for existing resi
        } else { // Should not happen if validationStatus is 'OK' and not a new ID entry
          actualCourierNameForResiTable = normalizeExpeditionName(expedition);
          actualScheduleForResiTable = "ontime";
        }
      }

      // Now, handle validation results
      if (validationStatus !== 'OK') {
        showError(validationMessage || "Validasi gagal.");
        if (validationStatus === 'MISMATCH_EXPEDISI' || validationStatus === 'NOT_FOUND_IN_EXPEDISI') {
          playBeep(beepFailure);
        } else { // DUPLICATE_PROCESSED
          playBeep(beepDouble);
        }
        setIsProcessing(false);
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
          Keterangan: actualCourierNameForResiTable, // Use the new variable
          schedule: actualScheduleForResiTable, // Use the new variable
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
          couriername: actualCourierNameForResiTable, // Use the new variable
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
          courierNameFromExpedisi: actualCourierNameForResiTable, // Use the new variable
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
    }
  }, [resiNumber, expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allFlagNoExpedisiData, allResiForExpedition, queryClient, debouncedTriggerSync, validateInput, derivedRecentProcessedResiNumbers, startTransition, isPending, initialTotalExpeditionItems, initialRemainingExpeditionItems, initialIdExpeditionScanCount]);

  // Global keydown listener for scanner input
  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Abaikan jika sedang memproses atau jika input dinonaktifkan
      if (isProcessing || !expedition || !selectedKarung) {
        return;
      }

      const currentTime = Date.now();
      // Jika ada jeda waktu yang signifikan antar penekanan tombol, reset buffer
      if (currentTime - lastKeyPressTime.current > SCANNER_TIMEOUT_MS) {
        scannerInputBuffer.current = '';
      }
      lastKeyPressTime.current = currentTime;

      if (event.key === 'Enter') {
        event.preventDefault(); // Mencegah perilaku default (misalnya submit form)
        if (scannerInputBuffer.current.length > 0) {
          setResiNumber(scannerInputBuffer.current); // Set the displayed value
          processScannedResi(scannerInputBuffer.current);
          scannerInputBuffer.current = ''; // Reset buffer setelah diproses
        }
      } else if (event.key.length === 1) { // Hanya tambahkan karakter tunggal (bukan Shift, Alt, Ctrl, dll.)
        scannerInputBuffer.current += event.key;
        setResiNumber(scannerInputBuffer.current); // Update displayed value as characters come in
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
    handleScanResi: processScannedResi, // Expose the new handler
    resiInputRef,
    isProcessing: isProcessing || isPending,
    isLoadingRecentScannedResiNumbers: false,
    isLoadingAllFlagNoExpedisiData,
    optimisticTotalExpeditionItems,
    optimisticRemainingExpeditionItems,
    optimisticIdExpeditionScanCount,
  };
};