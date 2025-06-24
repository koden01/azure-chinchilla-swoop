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
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import KarungSummaryModal from "@/components/KarungSummaryModal";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";

const InputPage = () => {
  const { expedition, setExpedition } = useExpedition();
  const [selectedKarung, setSelectedKarung] = React.useState<string>("1"); // Default to "1"

  const [isKarungSummaryModalOpen, setIsKarungSummaryModalOpen] = React.useState(false);

  // Calculate date range for today only
  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd"); // Hanya hari ini

  // NEW: Query to fetch tbl_expedisi data for today for local validation
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", formattedToday], // Query key hanya untuk hari ini
    queryFn: async () => {
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", today, today); // Hanya ambil data untuk hari ini
      const expedisiMap = new Map<string, any>();
      data.forEach((item: { resino: string | null }) => { // Tipe 'item' ditambahkan di sini
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true, // Always enabled for local validation
    staleTime: 1000 * 60 * 5, // Keep this data fresh for 5 minutes
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
  });

  const {
    allResiForExpedition, // NEW: Get this data from useResiInputData
    isLoadingAllResiForExpedition,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
    karungSummary,
    expeditionOptions,
  } = useResiInputData(expedition, false);

  const {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing,
    isLoadingRecentScannedResiNumbers,
    isLoadingAllFlagNoExpedisiData,
    currentCount, // Now directly from useResiScanner
  } = useResiScanner({ 
    expedition, 
    selectedKarung, 
    formattedDate,
    allExpedisiDataUnfiltered,
    allResiForExpedition, // NEW: Pass the data here
  });

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
    if (expedition && selectedKarung && resiInputRef.current && !isProcessing && !isLoadingRecentScannedResiNumbers && !isLoadingAllFlagNoExpedisiData) {
      const timer = setTimeout(() => {
        if (resiInputRef.current) {
          resiInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expedition, selectedKarung, isProcessing, isLoadingRecentScannedResiNumbers, isLoadingAllFlagNoExpedisiData]);

  const isInputDisabled = !expedition || !selectedKarung || isProcessing || isLoadingAllExpedisiUnfiltered || isLoadingRecentScannedResiNumbers || isLoadingAllFlagNoExpedisiData;

  return (
    <React.Fragment>
      <div className="flex flex-col items-center justify-center p-4 md:p-6 bg-gray-50">
        <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 p-6 md:p-8 rounded-lg shadow-md text-white text-center space-y-4">
          <h2 className="text-2xl font-semibold">Input Data Resi</h2>
          <div className="text-6xl font-bold">
            {!expedition
              ? "Pilih Expedisi"
              : isLoadingAllResiForExpedition || isLoadingAllExpedisiUnfiltered || isLoadingRecentScannedResiNumbers || isLoadingAllFlagNoExpedisiData
              ? "..."
              : currentCount}
          </div>
          <div
            className="text-xl cursor-pointer hover:underline"
            onClick={() => {
              if (expedition) {
                setIsKarungSummaryModalOpen(true);
              }
            }}
          >
            {expedition ? `${expedition} - Karung ${selectedKarung || '?'}` : "Pilih Expedisi"}
          </div>
          <p className="text-sm opacity-80">
            No Karung (Last: {isLoadingAllResiForExpedition ? "..." : lastKarung}, Highest: {isLoadingAllResiForExpedition ? "..." : highestKarung})
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div>
              <label htmlFor="expedition-select" className="block text-left text-sm font-medium mb-2">
                Expedisi
              </label>
              <Select onValueChange={setExpedition} value={expedition} disabled={isProcessing || isLoadingRecentScannedResiNumbers || isLoadingAllFlagNoExpedisiData}>
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
              <Select onValueChange={setSelectedKarung} value={selectedKarung} disabled={!expedition || isProcessing || isLoadingRecentScannedResiNumbers || isLoadingAllFlagNoExpedisiData}>
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
                onChange={(e) => setResiNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleScanResi();
                  }
                }}
                ref={resiInputRef}
                className={cn(
                  "w-full bg-white text-gray-800 h-16 text-2xl text-center pr-10",
                  isInputDisabled && "opacity-70 cursor-not-allowed"
                )}
                disabled={isInputDisabled}
                inputMode="none"
              />
              {isProcessing && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 animate-spin text-gray-500" />
              )}
              {(isLoadingRecentScannedResiNumbers || isLoadingAllFlagNoExpedisiData) && !isProcessing && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm">Memuat validasi...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <KarungSummaryModal
        isOpen={isKarungSummaryModalOpen}
        onClose={() => setIsKarungSummaryModalOpen(false)}
        expedition={expedition}
        date={formattedDate}
        summaryData={karungSummary}
      />
    </React.Fragment>
  );
};

export default InputPage;