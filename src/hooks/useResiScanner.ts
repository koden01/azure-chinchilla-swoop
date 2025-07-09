import React, { useTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, dismissToast } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble, beepStart } from "@/utils/audio";
import { useQueryClient, useQuery, QueryKey } from "@tanstack/react-query";
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { ResiExpedisiData } from "@/hooks/useResiInputData";
import { HistoryData } from "@/components/columns/historyColumns";

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
  const fiveDaysAgo = subDays(today, 4);
  const formattedFiveDaysAgo = format(fiveDaysAgo, "yyyy-MM-dd");

  // Buffer untuk input dari scanner
  const scannerInputBuffer = React.useRef<string>('');
  const lastKeyPressTime = React.useRef<number>(0);
  const SCANNER_TIMEOUT_MS = 500; // Waktu maksimum antar karakter untuk dianggap sebagai bagian dari satu scan (ditingkatkan lagi)

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

  // `derivedRecentProcessedResiNumbers` is still useful for general UI updates,
  // but for immediate duplicate checks, we'll directly query the cache.
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

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedFiveDaysAgo, formattedToday];
    const queryKeyForKarungSummary = ["karungSummary", expedition, formattedToday];
    const queryKeyForTotalExpeditionItems = ["totalExpeditionItems", expedition, formattedToday];
    // const queryKeyForRemainingExpeditionItems = ["remainingExpeditionItems", expedition, formattedToday]; // Dihapus karena tidak digunakan
    const queryKeyForIdExpeditionScanCount = ["idExpeditionScanCount", formattedToday];

    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "MISMATCH_EXPEDISI" | "NOT_FOUND_IN_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierNameForResiTable: string | null = null; // New variable for Keterangan in tbl_resi
    let actualScheduleForResiTable: string | null = null; // New variable for schedule in tbl_resi
    let expedisiRecord: any = null;
    let wasFlagNo = false;

    try {
      // --- IMMEDIATE OPTIMISTIC DUPLICATE CHECK ---
      // Check the current state of allExpedisiDataUnfiltered in cache
      const currentExpedisiDataInCache = queryClient.getQueryData(["allExpedisiDataUnfiltered", formattedToday]) as Map<string, any> | undefined;
      if (currentExpedisiDataInCache?.has(normalizedCurrentResi) && currentExpedisiDataInCache.get(normalizedCurrentResi)?.flag === 'YES') {
        const processedExpedisiRecord = currentExpedisiDataInCache.get(normalizedCurrentResi);
        let processedDate = processedExpedisiRecord?.created ? format(new Date(processedExpedisiRecord.created), "dd/MM/yyyy HH:mm") : "Tidak Diketahui";
        let keterangan = processedExpedisiRecord?.couriername || "Tidak Diketahui";
        showError(`DOUBLE! Resi ini ${keterangan} sudah diproses pada ${processedDate}.`);
        playBeep(beepDouble);
        setIsProcessing(false);
        return; // Stop processing immediately
      }

      // 1. Check for duplicate processed resi (flag 'YES' in tbl_expedisi or already in tbl_resi)
      // This check is now secondary to the immediate cache check above, but still useful for initial load state.
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

      // 2. If not a duplicate, try to find expedisi record in local caches
      if (validationStatus === 'OK') {
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        const normalizedSelectedExpedition = normalizeExpeditionName(expedition);

        if (!expedisiRecord) {
          // If resi not found in local caches at all
          // Special handling for 'ID' expedition: allow new entries
          if (normalizedSelectedExpedition === 'ID') {
            actualCourierNameForResiTable = "ID_REKOMENDASI";
            actualScheduleForResiTable = "idrek";
            // validationStatus remains 'OK'
          } else {
            validationStatus = 'NOT_FOUND_IN_EXPEDISI';
            validationMessage = `Data resi ${currentResi} tidak ditemukan di database.`;
          }
        } else {
          // Resi found in expedisi, check flag
          if (expedisiRecord.flag === 'NO') {
            wasFlagNo = true;
          }
          // Check for expedition mismatch if expedisiRecord was found
          const normalizedExpedisiCourierName = normalizeExpeditionName(expedisiRecord.couriername);
          const isIdMatch = (normalizedSelectedExpedition === 'ID' && (normalizedExpedisiCourierName === 'ID' || normalizedExpedisiCourierName === 'ID_REKOMENDASI'));
          const isDirectMatch = (normalizedSelectedExpedition === normalizedExpedisiCourierName);

          if (!isIdMatch && !isDirectMatch) {
            validationStatus = 'MISMATCH_EXPEDISI';
            validationMessage = `Resi ini terdaftar untuk ekspedisi ${expedisiRecord.couriername}, bukan ${expedition}.`;
          } else {
            // If it's a match, set actual courier name and schedule
            actualCourierNameForResiTable = normalizedExpedisiCourierName;
            actualScheduleForResiTable = "ontime"; // Default schedule for existing resi
          }
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

      // Optimistic updates for Input page display
      setOptimisticTotalExpeditionItems(prev => {
        // Increment total if it's a new 'ID_REKOMENDASI' entry (not found in expedisiRecord)
        const isTrulyNewIdEntry = (normalizeExpeditionName(expedition) === 'ID' && !expedisiRecord);
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

      // --- APPLY OPTIMISTIC UPDATES TO CACHE IMMEDIATELY FOR allExpedisiDataUnfiltered ---
      queryClient.setQueryData(["allExpedisiDataUnfiltered", formattedToday], (oldMap: Map<string, any> | undefined) => {
        const newMap = new Map(oldMap || []);
        const existingExpedisi = newMap.get(normalizedCurrentResi);
        newMap.set(normalizedCurrentResi, {
          ...(existingExpedisi || { resino: currentResi, created: new Date().toISOString() }),
          flag: "YES", // Set flag to YES optimistically
          cekfu: false, // Reset cekfu on scan
          couriername: actualCourierNameForResiTable, // Ensure couriername is set
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
      
      // Optimistically update historyData cache for any active history queries
      queryClient.setQueriesData({
        queryKey: ["historyData"],
        exact: false, // Match any historyData query regardless of date range
        updater: (oldData: HistoryData[] | undefined, queryKey: QueryKey) => {
          if (!oldData) return undefined;

          const [, queryStartDateStr, queryEndDateStr] = queryKey;
          const queryStartDate = queryStartDateStr ? new Date(queryStartDateStr as string) : undefined;
          const queryEndDate = queryEndDateStr ? new Date(queryEndDateStr as string) : undefined;

          const newResiEntry: HistoryData = {
            Resi: currentResi,
            nokarung: selectedKarung,
            created: new Date().toISOString(), // Use current timestamp for optimistic entry
            Keterangan: actualCourierNameForResiTable,
            schedule: actualScheduleForResiTable,
          };

          // Check if the history query's date range includes today
          const isTodayIncluded = queryStartDate && queryEndDate &&
                                 isWithinInterval(today, { start: startOfDay(queryStartDate), end: endOfDay(queryEndDate) });

          if (isTodayIncluded) {
            // Add the new entry to the beginning (assuming history is sorted by created DESC)
            // Ensure no duplicates are added if the item already exists (e.g., from a previous optimistic update)
            const existingIndex = oldData.findIndex(item => item.Resi === newResiEntry.Resi);
            if (existingIndex !== -1) {
              // Update existing entry
              const newData = [...oldData];
              newData[existingIndex] = newResiEntry;
              return newData;
            } else {
              // Add new entry
              return [newResiEntry, ...oldData];
            }
          }
          return oldData; // Return original data if date range doesn't match
        },
      });

      queryClient.invalidateQueries({ queryKey: ["historyData"] }, {});
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

      // Revert optimistic updates on error
      setOptimisticTotalExpeditionItems(initialTotalExpeditionItems || 0);
      setOptimisticRemainingExpeditionItems(initialTotalExpeditionItems || 0); // Revert to initial
      setOptimisticIdExpeditionScanCount(initialIdExpeditionScanCount || 0);

      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: queryKeyForInputPageDisplay }, {});
        queryClient.invalidateQueries({ queryKey: queryKeyForKarungSummary }, {});
        queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", formattedToday] }, {});
        queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] }, {});
        queryClient.invalidateQueries({ queryKey: queryKeyForTotalExpeditionItems }, {});
        queryClient.invalidateQueries({ queryKey: ["remainingExpeditionItems"] }, {});
        queryClient.invalidateQueries({ queryKey: queryKeyForIdExpeditionScanCount }, {});
        // Invalidate historyData on error to ensure it refetches correct state
        queryClient.invalidateQueries({ queryKey: ["historyData"] }, {});
      });
    } finally {
      setIsProcessing(false);
    }
  }, [resiNumber, expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered, allFlagNoExpedisiData, allResiForExpedition, queryClient, debouncedTriggerSync, validateInput, derivedRecentProcessedResiNumbers, startTransition, isPending, initialTotalExpeditionItems, initialRemainingExpeditionItems, initialIdExpeditionScanCount, formattedFiveDaysAgo, formattedToday]);

  // Global keydown listener for scanner input
  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Abaikan jika sedang memproses atau jika input dinonaktifkan
      if (isProcessing || !expedition || !selectedKarung) {
        return;
      }

      const currentTime = Date.now();
      
      // Jika ada jeda waktu yang signifikan antar penekanan tombol DAN buffer TIDAK KOSONG,
      // berarti urutan scan sebelumnya telah berakhir, jadi reset buffer untuk scan baru.
      // Jika buffer KOSONG, ini adalah karakter pertama dari scan baru, jadi jangan reset.
      if (scannerInputBuffer.current.length > 0 && (currentTime - lastKeyPressTime.current > SCANNER_TIMEOUT_MS)) {
        scannerInputBuffer.current = '';
      }
      lastKeyPressTime.current = currentTime; // Perbarui waktu penekanan tombol terakhir untuk karakter saat ini

      if (event.key === 'Enter') {
        event.preventDefault(); // Mencegah perilaku default (misalnya submit form)
        if (scannerInputBuffer.current.length > 0) {
          setResiNumber(scannerInputBuffer.current); // Set nilai yang ditampilkan (sekali saja saat Enter)
          processScannedResi(scannerInputBuffer.current);
          scannerInputBuffer.current = ''; // Reset buffer setelah diproses
        }
      } else if (event.key.length === 1) { // Hanya tambahkan karakter tunggal (bukan Shift, Alt, Ctrl, dll.)
        scannerInputBuffer.current += event.key;
        // Hapus baris ini: setResiNumber(scannerInputBuffer.current); // Tidak lagi memperbarui state di setiap karakter
      } else if (event.key === 'Backspace') {
        scannerInputBuffer.current = scannerInputBuffer.current.slice(0, -1);
        setResiNumber(scannerInputBuffer.current); // Tetap perbarui untuk umpan balik backspace manual
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isProcessing, expedition, selectedKarung, processScannedResi]);


  return {
    resiNumber,
    // setResiNumber, // Dihapus karena tidak lagi digunakan secara langsung di sini
    // handleScanResi, // Tidak lagi dipanggil langsung dari sini
    resiInputRef,
    isProcessing: isProcessing || isPending,
    isLoadingRecentScannedResiNumbers: false,
    isLoadingAllFlagNoExpedisiData,
    optimisticTotalExpeditionItems,
    optimisticRemainingExpeditionItems,
    optimisticIdExpeditionScanCount,
  };
};