import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
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
import { Button } from "@/components/ui/button"; 

const InputPage = () => {
  const { expedition, setExpedition } = useExpedition();
  const [selectedKarung, setSelectedKarung] = React.useState<string>("1"); // Default to "1"
  const [isKarungSummaryModalOpen, setIsKarungSummaryModalOpen] = React.useState(false);
  const [showAllExpeditionSummary, setShowAllExpeditionSummary] = React.useState(false); // NEW state

  const {
    allResiForExpedition,
    isLoadingAllResiForExpedition,
    allExpedisiDataUnfiltered,
    allResiDataComprehensive,
    currentCount: getCountForSelectedKarung,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
    karungSummary,
    allExpeditionKarungSummary, // NEW: Get all expedition summary
    isLoadingAllKarungSummaries, // NEW: Loading state for all summaries
    expeditionOptions,
  } = useResiInputData(expedition, showAllExpeditionSummary); // Pass new state to hook

  const {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing,
  } = useResiScanner({ 
    expedition, 
    selectedKarung, 
    formattedDate,
    allResiForExpedition,
    allResiDataComprehensive,
    allExpedisiDataUnfiltered,
  });

  const currentCount = getCountForSelectedKarung(selectedKarung);

  React.useEffect(() => {
    if (expedition) {
      if (highestKarung > 0) {
        setSelectedKarung(highestKarung.toString());
      } else {
        setSelectedKarung("1");
      }
    } else {
      setSelectedKarung("1"); // Ensure a default is set even if no expedition
    }
  }, [expedition, highestKarung]);

  React.useEffect(() => {
    if (expedition && selectedKarung && resiInputRef.current && !isProcessing) {
      const timer = setTimeout(() => {
        if (resiInputRef.current) {
          resiInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expedition, selectedKarung, isProcessing]);

  const handleOpenKarungSummaryModal = (showAll: boolean) => {
    setShowAllExpeditionSummary(showAll);
    setIsKarungSummaryModalOpen(true);
  };

  const handleCloseKarungSummaryModal = () => {
    setIsKarungSummaryModalOpen(false);
    setShowAllExpeditionSummary(false); // Reset state when modal closes
  };

  console.log("InputPage State:", {
    expedition,
    selectedKarung,
    isLoadingAllResiForExpedition,
    allResiForExpeditionCount: allResiForExpedition?.length,
    currentCount,
    isProcessing,
    karungSummary,
    allExpeditionKarungSummary,
    expeditionOptions,
    showAllExpeditionSummary,
  });

  console.log("InputPage rendered."); // Added this line

  return (
    <React.Fragment>
      <div className="flex flex-col items-center justify-center p-4 md:p-6 bg-gray-50 h-[calc(100vh-64px)] mt-16 overflow-hidden">
        <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 p-6 md:p-8 rounded-lg shadow-md text-white text-center space-y-4">
          <h2 className="text-2xl font-semibold">Input Data Resi</h2>
          <div className="text-6xl font-bold">
            {!expedition
              ? "Pilih Expedisi"
              : isLoadingAllResiForExpedition
              ? "..."
              : currentCount}
          </div>
          <div
            className="text-xl cursor-pointer hover:underline"
            onClick={() => handleOpenKarungSummaryModal(false)} // Open for specific expedition
          >
            {expedition ? `${expedition} - Karung ${selectedKarung || '?'}` : "Pilih Expedisi"}
          </div>
          <p className="text-sm opacity-80">
            No Karung (Last: {isLoadingAllResiForExpedition ? "..." : lastKarung}, Highest: {isLoadingAllResiForExpedition ? "..." : highestKarung})
          </p>
          <Button
            onClick={() => handleOpenKarungSummaryModal(true)} // Open for all expeditions
            className="mt-4 bg-white text-blue-600 hover:bg-gray-100 hover:text-blue-700"
            disabled={isLoadingAllKarungSummaries}
          >
            {isLoadingAllKarungSummaries ? "Memuat Ringkasan Semua Expedisi..." : "Lihat Ringkasan Semua Expedisi"}
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div>
              <label htmlFor="expedition-select" className="block text-left text-sm font-medium mb-2">
                Expedisi
              </label>
              <Select onValueChange={setExpedition} value={expedition} disabled={isProcessing}>
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
              <Select onValueChange={setSelectedKarung} value={selectedKarung} disabled={!expedition || isProcessing}>
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
                  isProcessing && "opacity-70 cursor-not-allowed"
                )}
                disabled={!expedition || !selectedKarung || isProcessing}
                inputMode="none"
              />
              {isProcessing && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 animate-spin text-gray-500" />
              )}
            </div>
          </div>
        </div>
        <MadeWithDyad />
      </div>

      <KarungSummaryModal
        isOpen={isKarungSummaryModalOpen}
        onClose={handleCloseKarungSummaryModal}
        expedition={showAllExpeditionSummary ? undefined : expedition} {/* Pass expedition only if not showing all */}
        date={formattedDate}
        summaryData={showAllExpeditionSummary ? allExpeditionKarungSummary : karungSummary}
        showAllExpeditions={showAllExpeditionSummary} {/* NEW prop */}
      />
    </React.Fragment>
  );
};

export default InputPage;