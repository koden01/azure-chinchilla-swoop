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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { beepSuccess, beepFailure, beepDouble } from "@/utils/audio";
import { useResiInputData } from "@/hooks/useResiInputData";
import { useDebounce } from "@/hooks/useDebounce"; // Import useDebounce
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation"; // Import utility

const InputPage = () => {
  const [expedition, setExpedition] = React.useState<string>("");
  const [selectedKarung, setSelectedKarung] = React.useState<string>("");
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const {
    allResiForExpedition,
    isLoadingAllResiForExpedition,
    currentCount: getCountForSelectedKarung,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
  } = useResiInputData(expedition);

  const currentCount = getCountForSelectedKarung(selectedKarung);

  // Debounced invalidate function
  const debouncedInvalidate = useDebounce(() => {
    console.log("Debounced invalidation triggered!");
    // Invalidate all relevant dashboard and input-related queries for today's date
    invalidateDashboardQueries(queryClient, new Date());
  }, 500); // 500ms debounce delay

  // Auto-select highest karung when expedition changes
  React.useEffect(() => {
    if (expedition) {
      if (highestKarung > 0) {
        setSelectedKarung(highestKarung.toString());
      } else {
        setSelectedKarung("1"); // Default to 1 if no karung found for this expedition today
      }
    } else {
      setSelectedKarung(""); // Clear selected karung if no expedition is selected
    }
  }, [expedition, highestKarung]);

  // Auto-focus logic: Ensure focus after expedition and karung are selected
  React.useEffect(() => {
    if (expedition && selectedKarung && resiInputRef.current) {
      const timer = setTimeout(() => {
        if (resiInputRef.current) {
          resiInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expedition, selectedKarung]);

  // Keep focus on resi input after an action
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
      beepFailure.play();
      return false;
    }
    if (!expedition || !selectedKarung) {
      showError("Pilih Expedisi dan No Karung terlebih dahulu.");
      beepFailure.play();
      return false;
    }
    return true;
  };

  interface ValidationResult {
    success: boolean;
    actualCourierName?: string | null; // Will be null if not found in tbl_expedisi but allowed (for ID)
  }

  const checkExpeditionAndDuplicates = async (currentResi: string): Promise<ValidationResult> => {
    // 1. Validate if resi exists in tbl_expedisi and belongs to selected expedition
    const { data: expedisiData, error: expError } = await supabase
      .from("tbl_expedisi")
      .select("resino, couriername")
      .eq("resino", currentResi)
      .single();

    if (expError && expError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw expError; // Actual database error
    }

    let actualCourierNameFromExpedisi: string | null = expedisiData?.couriername || null;

    if (expedition === "ID") {
        if (!expedisiData) {
            // Resi not found in tbl_expedisi, but it's "ID" expedition, so allow it to proceed.
            // actualCourierNameFromExpedisi remains null, indicating it wasn't found.
        } else if (expedisiData.couriername !== "ID") {
            // Resi found, but belongs to a different courier, even if it's ID.
            showError(`Resi ini bukan milik ekspedisi ID. Ini milik ${expedisiData.couriername}.`);
            beepFailure.play();
            return { success: false };
        }
    } else { // For non-ID expeditions
        if (expError || !expedisiData) { // If resi not found or error
            showError("Resi tidak ditemukan di database ekspedisi.");
            beepFailure.play();
            return { success: false };
        }
        if (expedisiData.couriername !== expedition) {
            showError(`Resi ini bukan milik ekspedisi ${expedition}. Ini milik ${expedisiData.couriername}.`);
            beepFailure.play();
            return { success: false };
        }
    }

    // 2. Validate for duplicate resi in tbl_resi for the current day, expedition, and karung
    const { data: duplicateResi, error: dupError } = await supabase.rpc("get_resi_for_expedition_and_date", {
      p_couriername: expedition, // Use the selected expedition for duplicate check
      p_selected_date: formattedDate,
    }).eq("Resi", currentResi).eq("nokarung", selectedKarung);

    if (dupError) throw dupError;

    if (duplicateResi && duplicateResi.length > 0) {
      showError("Resi duplikat! Data sudah ada.");
      beepDouble.play();
      return { success: false };
    }

    return { success: true, actualCourierName: actualCourierNameFromExpedisi };
  };

  const insertResi = async (currentResi: string, actualCourierNameFromExpedisi: string | null) => {
    let insertPayload: any = {
        Resi: currentResi,
        nokarung: selectedKarung,
    };

    if (expedition === "ID") {
        if (actualCourierNameFromExpedisi === null) { // Resi not found in tbl_expedisi
            insertPayload.Keterangan = "ID_REKOMENDASI";
            insertPayload.schedule = "idrek";
        } else { // Resi found in tbl_expedisi (and it must be 'ID' based on checkExpeditionAndDuplicates)
            insertPayload.Keterangan = actualCourierNameFromExpedisi; // Use actual courier name from tbl_expedisi
            // schedule will be handled by the trigger update_schedule_if_null
        }
    } else { // For non-ID expeditions
        insertPayload.Keterangan = expedition; // Use selected expedition name
        // schedule will be handled by the trigger update_schedule_if_null
    }

    const { error: insertError } = await supabase
      .from("tbl_resi")
      .insert(insertPayload);

    if (insertError) {
      showError(`Gagal menginput resi: ${insertError.message}`);
      beepFailure.play();
      return false;
    }
    showSuccess(`Resi ${currentResi} berhasil diinput.`);
    beepSuccess.play();
    return true;
  };

  const handleScanResi = async () => {
    const currentResi = resiNumber.trim();
    setResiNumber(""); // Clear input immediately

    if (!validateInput(currentResi)) {
      return;
    }

    try {
      const validationResult = await checkExpeditionAndDuplicates(currentResi);
      if (!validationResult.success) {
        return;
      }

      const isInserted = await insertResi(currentResi, validationResult.actualCourierName || null);
      if (isInserted) {
        // Call the debounced invalidation instead of direct invalidation
        debouncedInvalidate();
      }
    } catch (error: any) {
      showError(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
      beepFailure.play();
      console.error("Error during resi input:", error);
    } finally {
      keepFocus();
    }
  };

  console.log("InputPage State:", {
    expedition,
    selectedKarung,
    isLoadingAllResiForExpedition,
    allResiForExpeditionCount: allResiForExpedition?.length,
    currentCount,
  });

  return (
    <React.Fragment>
      <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg shadow-md text-white text-center space-y-4">
          <h2 className="text-2xl font-semibold">Input Data Resi</h2>
          <div className="text-6xl font-bold">
            {!expedition
              ? "Pilih Expedisi"
              : isLoadingAllResiForExpedition
              ? "..."
              : currentCount}
          </div>
          <p className="text-xl">
            {expedition ? `${expedition} - Karung ${selectedKarung || '?'}` : "Pilih Expedisi"}
          </p>
          <p className="text-sm opacity-80">
            No Karung (Last: {isLoadingAllResiForExpedition ? "..." : lastKarung}, Highest: {isLoadingAllResiForExpedition ? "..." : highestKarung})
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div>
              <label htmlFor="expedition" className="block text-left text-sm font-medium mb-2">
                Expedisi
              </label>
              <Select onValueChange={setExpedition} value={expedition}>
                <SelectTrigger className="w-full bg-white text-gray-800 h-20 text-center justify-center">
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
              <label htmlFor="no-karung" className="block text-left text-sm font-medium mb-2">
                No Karung
              </label>
              <Select onValueChange={setSelectedKarung} value={selectedKarung} disabled={!expedition}>
                <SelectTrigger className="w-full bg-white text-gray-800 h-20 text-center justify-center">
                  <SelectValue placeholder="Pilih No Karung" />
                </SelectTrigger>
                <SelectContent>
                  {karungOptions.map((num) => (
                    <SelectItem key={num} value={num}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
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
                className="w-full bg-white text-gray-800 h-40 text-2xl text-center"
                disabled={!expedition || !selectedKarung}
              />
            </div>
          </div>
        </div>
        <MadeWithDyad />
      </div>
    </React.Fragment>
  );
};

export default InputPage;