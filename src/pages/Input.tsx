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
import KarungSummaryModal from "@/components/KarungSummaryModal"; // Import the new modal

const InputPage = () => {
  const { expedition, setExpedition } = useExpedition();
  const [selectedKarung, setSelectedKarung] = React.useState<string>("");
  const [isKarungSummaryModalOpen, setIsKarungSummaryModalOpen] = React.useState(false); // State for modal

  const {
    allResiForExpedition,
    isLoadingAllResiForExpedition,
    currentCount: getCountForSelectedKarung,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
    karungSummary, // Destructure karungSummary
  } = useResiInputData(expedition);

  const {
    resiNumber,
    setResiNumber,
    handleScanResi,
    resiInputRef,
    isProcessing,
  } = useResiScanner({ expedition, selectedKarung, formattedDate });

  const currentCount = getCountForSelectedKarung(selectedKarung);

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
    if (expedition && selectedKarung && resiInputRef.current && !isProcessing) {
      const timer = setTimeout(() => {
        if (resiInputRef.current) {
          resiInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expedition, selectedKarung, isProcessing]);

  console.log("InputPage State:", {
    expedition,
    selectedKarung,
    isLoadingAllResiForExpedition,
    allResiForExpeditionCount: allResiForExpedition?.length,
    currentCount,
    isProcessing,
    karungSummary, // Log karungSummary
  });

  return (
    <React.Fragment>
      <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 md:p-8 rounded-lg shadow-md text-white text-center space-y-4">
          <h2 className="text-2xl font-semibold">Input Data Resi</h2>
          <div className="text-6xl font-bold">
            {!expedition
              ? "Pilih Expedisi"
              : isLoadingAllResiForExpedition
              ? "..."
              : currentCount}
          </div>
          <div
            className="text-xl cursor-pointer hover:underline" // Make it clickable
            onClick={() => {
              if (expedition) { // Only open if an expedition is selected
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
              <Select onValueChange={setExpedition} value={expedition} disabled={isProcessing}>
                <SelectTrigger id="expedition-select" className="w-full bg-white text-gray-800 h-12 text-center justify-center">
                  <SelectValue placeholder="Pilih Expedisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JNE">JNE</SelectItem>
                  <SelectItem value="SPX">SPX</SelectItem>
                  <SelectItem value="INSTAN">INSTAN</SelectItem>
                  <SelectItem value="ID">ID</SelectItem>
                  <SelectItem value="SICEPAT">SICEPAT</SelectItem>
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
                <SelectContent>
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
        onClose={() => setIsKarungSummaryModalOpen(false)}
        expedition={expedition}
        date={formattedDate}
        summaryData={karungSummary}
      />
    </React.Fragment>
  );
};

export default InputPage;