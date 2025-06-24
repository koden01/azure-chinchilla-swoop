import React from "react";
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
}

export const useResiScanner = ({ expedition, selectedKarung, formattedDate, allExpedisiDataUnfiltered }: UseResiScannerProps) => {
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { triggerSync } = useBackgroundSync();

  // Calculate date range for today only
  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd"); // Use for query key and fetch arguments

  // Query to fetch tbl_resi data for today for local duplicate validation (general scan history)
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

  // NEW: Query to fetch ALL tbl_expedisi data with flag = 'NO' for comprehensive local validation
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
    staleTime: 1000 * 60 * 60 * 4, // Increased to 4 hours
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
    enabled: true, // Always enabled
  });

  const lastOptimisticIdRef = React.useRef<string | null>(null);

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
        console.error("[useResiScanner] Error playing beepFailure:", e);
      }
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Mohon pilih Expedisi dan No Karung terlebih dahulu.");
      try {
        beepFailure.play();
      } catch (e) {
        console.error("[useResiScanner] Error playing beepFailure:", e);
      }
      return false;
    }
    return true;
  };

  const handleScanResi = async () => {
    dismissToast();
    const currentResi = resiNumber.trim();
    const normalizedCurrentResi = currentResi.toLowerCase().trim();
    setResiNumber("");

    if (!validateInput(currentResi)) {
      setIsProcessing(false);
      keepFocus();
      return;
    }

    setIsProcessing(true);

    const queryKeyForInputPageDisplay = ["allResiForExpedition", expedition, formattedDate];
    const queryKeyForKarungSummary = ["karungSummary", expedition, formattedDate];

    const currentOptimisticId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    let validationStatus: "OK" | "DUPLICATE_PROCESSED" | "DUPLICATE_SCANNED" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";
    let validationMessage: string | null = null;
    let actualCourierName: string | null = null;
    let expedisiRecord: any = null;

    try {
      // 1. Check if resi has already been PROCESSED (flag = YES in tbl_expedisi)
      const derivedRecentProcessedResiNumbers = new Set<string>();
      if (allExpedisiDataUnfiltered) {
        for (const [resi, data] of allExpedisiDataUnfiltered.entries()) {
          if (data.flag === 'YES') {
            derivedRecentProcessedResiNumbers.add(resi);
          }
        }
      }

      if (derivedRecentProcessedResiNumbers.has(normalizedCurrentResi)) {
        validationStatus = 'DUPLICATE_PROCESSED';
        validationMessage = `DOUBLE! Resi ini sudah diproses.`;
      }

      // 2. Check if resi has already been SCANNED (in tbl_resi)
      if (validationStatus === 'OK') {
        if (recentScannedResiNumbers?.has(normalizedCurrentResi)) {
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
        // 3. Attempt to find expedisiRecord from caches or direct RPC call
        expedisiRecord = allExpedisiDataUnfiltered?.get(normalizedCurrentResi);

        if (!expedisiRecord) {
          expedisiRecord = allFlagNoExpedisiData?.get(normalizedCurrentResi);
        }

        if (!expedisiRecord) {
            const { data: directExpedisiDataArray, error: directExpedisiError } = await supabase.rpc("get_expedisi_by_resino_case_insensitive", {
              p_resino: currentResi,
            });

            if (directExpedisiError) {
                console.error(`[useResiScanner] Error during direct fetch:`, directExpedisiError);
                throw directExpedisiError;
            }
            
            if (directExpedisiDataArray && directExpedisiDataArray.length > 0) {
                expedisiRecord = directExpedisiDataArray[0];
                queryClient.setQueryData(
                    ["allExpedisiDataUnfiltered", formattedToday],
                    (oldMap: Map<string, any> | undefined) => {
                        const newMap = oldMap ? new Map(oldMap) : new Map();
                        newMap.set(normalizedCurrentResi, expedisiRecord);
                        return newMap;
                    }
                );
                if (expedisiRecord.flag === 'NO') {
                  queryClient.setQueryData(
                    ["allFlagNoExpedisiData"],
                    (oldMap: Map<string, any> | undefined) => {
                        const newMap = oldMap ? new Map(oldMap) : new Map();
                        newMap.set(normalizedCurrentResi, expedisiRecord);
                        return newMap;
                    }
                  );
                }
            }
        }
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
        try {
          switch (validationStatus) {
            case 'NOT_FOUND_EXPEDISI':
            case 'MISMATCH_EXPEDISI':
              beepFailure.play();
              break;
            case 'DUPLICATE_PROCESSED':
            case 'DUPLICATE_SCANNED':
              beepDouble.play();
              break;
            default:
              beepFailure.play();
              break;
          }
        } catch (e) {
          console.error("[useResiScanner] Error playing beep sound:", e);
        }
        setIsProcessing(false);
        keepFocus();
        return;
      }

      // --- If all OK, proceed with optimistic update and saving to IndexedDB ---
      const newResiEntry: ResiExpedisiData = {
        Resi: currentResi,
        nokarung: selectedKarung,
        created: new Date().toISOString(),
        Keterangan: actualCourierName,
        schedule: "ontime",
        optimisticId: currentOptimisticId,
      };

      queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
        const newData = [...(oldData || []), newResiEntry];
        return newData;
      });
      queryClient.setQueryData(["recentScannedResiNumbers", formattedToday], (oldSet: Set<string> | undefined) => {
        const newSet = oldSet ? new Set(oldSet) : new Set();
        newSet.add(normalizedCurrentResi);
        return newSet;
      });
      queryClient.setQueryData(["allExpedisiDataUnfiltered", formattedToday], (oldMap: Map<string, any> | undefined) => {
        const newMap = oldMap ? new Map(oldMap) : new Map();
        const existingExpedisi = newMap.get(normalizedCurrentResi);
        
        newMap.set(normalizedCurrentResi, {
          ...existingExpedisi,
          resino: currentResi,
          couriername: actualCourierName,
          flag: "YES",
          created: existingExpedisi?.created || new Date().toISOString(),
          cekfu: existingExpedisi?.cekfu || false,
          optimisticId: currentOptimisticId,
        });
        return newMap;
      });
      queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
        const newMap = oldMap ? new Map(oldMap) : new Map();
        newMap.delete(normalizedCurrentResi);
        return newMap;
      });

      queryClient.setQueryData(queryKeyForKarungSummary, (oldSummary: { karung_number: string; quantity: number; }[] | undefined) => {
        const newSummary = oldSummary ? [...oldSummary] : [];
        const existingKarungIndex = newSummary.findIndex(item => item.karung_number === selectedKarung);

        if (existingKarungIndex !== -1) {
          newSummary[existingKarungIndex] = {
            ...newSummary[existingKarungIndex],
            quantity: newSummary[existingKarungIndex].quantity + 1,
          };
        } else {
          newSummary.push({
            karung_number: selectedKarung,
            quantity: 1,
          });
        }
        return newSummary;
      });

      lastOptimisticIdRef.current = currentOptimisticId;
      
      showSuccess(`Resi ${currentResi} Berhasil`);
      try {
        beepSuccess.play();
      } catch (e) {
        console.error("[useResiScanner] Error playing beepSuccess:", e);
      }

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

      lastOptimisticIdRef.current = null;
      
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
      try {
        beepFailure.play();
      } catch (e) {
        console.error("[useResiScanner] Error playing beepFailure:", e);
      }

      if (lastOptimisticIdRef.current) {
          queryClient.setQueryData(queryKeyForInputPageDisplay, (oldData: ResiExpedisiData[] | undefined) => {
              const revertedData = (oldData || []).filter(item => item.optimisticId !== lastOptimisticIdRef.current);
              return revertedData;
          });
          queryClient.setQueryData(["recentScannedResiNumbers", formattedToday], (oldSet: Set<string> | undefined) => {
            const newSet = oldSet ? new Set(oldSet) : new Set();
            newSet.delete(normalizedCurrentResi);
            return newSet;
          });
          queryClient.setQueryData(["allExpedisiDataUnfiltered", formattedToday], (oldMap: Map<string, any> | undefined) => {
            const newMap = oldMap ? new Map(oldMap) : new Map();
            const existingExpedisi = newMap.get(normalizedCurrentResi);
            if (existingExpedisi && existingExpedisi.optimisticId === lastOptimisticIdRef.current) {
              const revertedExpedisi = { ...existingExpedisi };
              delete revertedExpedisi.optimisticId; 
              revertedExpedisi.flag = "NO";
              newMap.set(normalizedCurrentResi, revertedExpedisi);
            }
            return newMap;
          });
          queryClient.setQueryData(["allFlagNoExpedisiData"], (oldMap: Map<string, any> | undefined) => {
            const newMap = oldMap ? new Map(oldMap) : new Map();
            queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] }); 
            return newMap; 
          });
          queryClient.setQueryData(queryKeyForKarungSummary, (oldSummary: { karung_number: string; quantity: number; }[] | undefined) => {
            const newSummary = oldSummary ? [...oldSummary] : [];
            const existingKarungIndex = newSummary.findIndex(item => item.karung_number === selectedKarung);

            if (existingKarungIndex !== -1) {
              newSummary[existingKarungIndex] = {
                ...newSummary[existingKarungIndex],
                quantity: newSummary[existingKarungIndex].quantity - 1,
              };
              if (newSummary[existingKarungIndex].quantity <= 0) {
                newSummary.splice(existingKarungIndex, 1);
              }
            }
            return newSummary;
          });
      }
      lastOptimisticIdRef.current = null;
    } finally {
      setIsProcessing(false);
      keepFocus();
    }
  };

  return {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing,
    isLoadingRecentScannedResiNumbers,
    isLoadingAllFlagNoExpedisiData,
  };
};