"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResiInputData } from "@/hooks/useResiInputData";
import { useExpedition } from "@/context/ExpeditionContext";
import { useResiScanner } from "@/hooks/useResiScanner";
import { Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import KarungSummaryModal from "@/components/KarungSummaryModal";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { useAllFlagYesExpedisiResiNumbers } from "@/hooks/useAllFlagYesExpedisiResiNumbers";
import { Button } from "@/components/ui/button";
import BarcodeScannerQuagga from "@/components/BarcodeScannerQuagga";

const InputPage = () => {
  const { expedition, setExpedition } = useExpedition();
  const [selectedKarung, setSelectedKarung] = React.useState<string>("1");
  const [isKarungSummaryModalOpen, setIsKarungSummaryModal] = React.useState(false);
  const [isCameraActive, setIsCameraActive] = React.useState(false);

  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", formattedToday],
    queryFn: async () => {
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", today, today);
      const expedisiMap = new Map<string, any>();
      data.forEach((item: { resino: string | null }) => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
  });

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

  const { data: allFlagYesExpedisiResiNumbers, isLoading: isLoadingAllFlagYesExpedisiResiNumbers } = useAllFlagYesExpedisiResiNumbers();

  const {
    allResiForExpedition,
    highestKarung,
    karungOptions,
    formattedDate: formattedDateFromHook,
    karungSummary,
    expeditionOptions,
    totalExpeditionItems,
    remainingExpeditionItems,
    currentCount: getResiCountForKarung,
  } = useResiInputData(expedition, false);

  const {
    resiNumber,
    resiInputRef,
    isProcessing,
    optimisticTotalExpeditionItems,
    optimisticRemainingExpeditionItems,
    handleScanResi, // FIX: Destructure handleScanResi instead of processScannedResi
  } = useResiScanner({ 
    expedition, 
    selectedKarung, 
    formattedDate: formattedDateFromHook,
    allExpedisiDataUnfiltered,
    allResiForExpedition,
    initialTotalExpeditionItems: totalExpeditionItems,
    initialRemainingExpeditionItems: remainingExpeditionItems,
    allFlagNoExpedisiData,
    allFlagYesExpedisiResiNumbers,
    isCameraActive,
  });

  const currentCountForDisplay = React.useMemo(() => {
    return getResiCountForKarung(selectedKarung);
  }, [getResiCountForKarung, selectedKarung]);

  const scanCountToDisplay = React.useMemo(() => {
    return optimisticTotalExpeditionItems - optimisticRemainingExpeditionItems;
  }, [optimisticTotalExpeditionItems, optimisticRemainingExpeditionItems]);

  React.useEffect(() => {
    if (expedition) {
      if (highestKarung > 0) {
        setSelectedKarung(highestKarung.toString());
      } else {
        setSelectedKarung("1");
      }
    } else {
      setSelectedKarung("");
    }
  }, [expedition, highestKarung]);

  React.useEffect(() => {
    if (expedition && selectedKarung && resiInputRef.current && !isCameraActive) {
      resiInputRef.current.focus();
    }
  }, [expedition, selectedKarung, resiInputRef, isCameraActive]);

  const isInputDisabled = !expedition || !selectedKarung || isProcessing || isLoadingAllExpedisiUnfiltered || isLoadingAllFlagNoExpedisiData || isLoadingAllFlagYesExpedisiResiNumbers;

  const handleCameraScan = (decodedText: string) => {
    handleScanResi(decodedText); // FIX: Call handleScanResi
  };

  return (
    <React.Fragment>
      <div className="flex flex-col items-center justify-center p-4 md:p-6 bg-gray-50">
        <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 p-6 md:p-8 rounded-lg shadow-md text-white text-center space-y-4">
          <div className="flex items-center justify-center mb-4">
            <h2 className="text-2xl font-semibold mr-4">Input Data Resi</h2>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsCameraActive(prev => !prev)}
              disabled={isInputDisabled && !isCameraActive}
            >
              <Camera className={cn("h-6 w-6", isCameraActive ? "text-green-400" : "text-white")} />
            </Button>
          </div>

          <div className="text-6xl font-bold">
            {isInputDisabled
              ? "..."
              : currentCountForDisplay}
          </div>
          <div
            className="text-xl cursor-pointer hover:underline"
            onClick={() => {
              if (expedition) {
                setIsKarungSummaryModal(true);
              }
            }}
          >
            {expedition ? `${expedition} - Karung ${selectedKarung || '?'}` : "Pilih Expedisi"}
          </div>
          <p className="text-sm opacity-80">
            Total: {isInputDisabled ? "..." : optimisticTotalExpeditionItems} - Scan: {isInputDisabled ? "..." : scanCountToDisplay} - Sisa: {isInputDisabled ? "..." : optimisticRemainingExpeditionItems}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div>
              <label htmlFor="expedition-select" className="block text-left text-sm font-medium mb-2">
                Expedisi
              </label>
              <Select onValueChange={setExpedition} value={expedition} disabled={isInputDisabled || isCameraActive}>
                <SelectTrigger id="expedition-select" className="w-full bg-white text-gray-800 h-12 text-center justify-center">
                  <SelectValue placeholder="Pilih Expedisi" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {expeditionOptions.map((expName) => (
                    <SelectItem key={expName} value={expName}>{expName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="no-karung-select" className="block text-left text-sm font-medium mb-2">
                No Karung
              </label>
              <Select onValueChange={setSelectedKarung} value={selectedKarung} disabled={!expedition || isInputDisabled || isCameraActive}>
                <SelectTrigger id="no-karung-select" className="w-full bg-white text-gray-800 h-12 text-center justify-center">
                  <SelectValue placeholder="Pilih No Karung" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {karungOptions.map((num) => (
                    <SelectItem key={num} value={num}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 relative">
              <label htmlFor="scan-resi" className="block text-left text-sm font-medium mb-2">
                Scan Resi
              </label>
              <Input
                id="scan-resi"
                type="text"
                placeholder="Scan nomor resi"
                value={resiNumber}
                ref={resiInputRef}
                className={cn(
                  "w-full bg-white text-gray-800 h-16 text-2xl text-center pr-10",
                  (isInputDisabled || isCameraActive) && "opacity-70 cursor-not-allowed"
                )}
                disabled={isInputDisabled || isCameraActive}
                inputMode="none"
              />
              {isProcessing && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 animate-spin text-gray-500" />
              )}
              {(isLoadingAllExpedisiUnfiltered || isLoadingAllFlagNoExpedisiData || isLoadingAllFlagYesExpedisiResiNumbers) && !isProcessing && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm">Memuat validasi...</span>
                </div>
              )}
            </div>
          </div>

          {/* Camera view appears below the input fields */}
          {isCameraActive && (
            <div className="mt-6">
              <BarcodeScannerQuagga onScan={handleCameraScan} onClose={() => setIsCameraActive(false)} />
            </div>
          )}
        </div>
      </div>

      <KarungSummaryModal
        isOpen={isKarungSummaryModalOpen}
        onClose={() => setIsKarungSummaryModal(false)}
        expedition={expedition}
        date={formattedDateFromHook}
        summaryData={karungSummary}
      />
    </React.Fragment>
  );
};

export default InputPage;