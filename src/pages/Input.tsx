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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { showSuccess, showError } from "@/utils/toast";

// Define types for Supabase data
interface TblExpedisi {
  datetrans: string | null;
  chanelsales: string | null;
  orderno: string;
  couriername: string | null;
  resino: string;
  created: string | null;
  flag: string | null;
  cekfu: boolean | null;
}

interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  couriername: string | null; // This will now come directly from the RPC function
}

const beepSuccess = new Audio('/sounds/beep-success.mp3'); // Pastikan file ini ada di public/sounds/
const beepFailure = new Audio('/sounds/beep-failure.mp3'); // Pastikan file ini ada di public/sounds/
const beepDouble = new Audio('/sounds/beep-double.mp3'); // Pastikan file ini ada di public/sounds/

const InputPage = () => {
  const [expedition, setExpedition] = React.useState<string>("");
  const [selectedKarung, setSelectedKarung] = React.useState<string>("");
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const resiInputRef = React.useRef<HTMLInputElement>(null);
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");
  const queryClient = useQueryClient();

  // Query to get all resi for the selected expedition for today using RPC
  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];

      const { data, error } = await supabase.rpc("get_resi_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });

      if (error) {
        console.error("Error fetching all resi for expedition:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!expedition,
  });

  // Calculate current count, last karung, highest karung based on fetched data
  const currentCount = React.useMemo(() => {
    if (!allResiForExpedition || !selectedKarung) return 0;
    return allResiForExpedition.filter(
      (item) => item.nokarung === selectedKarung
    ).length;
  }, [allResiForExpedition, selectedKarung]);

  const lastKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return 0;
    const sortedByCreated = [...allResiForExpedition].sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA; // Descending
    });
    return parseInt(sortedByCreated[0].nokarung || "0") || 0;
  }, [allResiForExpedition]);

  const highestKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return 0;
    const validKarungNumbers = allResiForExpedition
      .map(item => parseInt(item.nokarung || "0"))
      .filter(num => !isNaN(num) && num > 0);
    return validKarungNumbers.length > 0 ? Math.max(...validKarungNumbers) : 0;
  }, [allResiForExpedition]);

  // Dynamically generate karung options: from 1 up to max(100, highestKarung)
  const karungOptions = React.useMemo(() => {
    const maxKarung = Math.max(1, highestKarung, 100); // Ensure at least 1, and up to 100 or highestKarung if greater
    return Array.from({ length: maxKarung }, (_, i) => (i + 1).toString());
  }, [highestKarung]);

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


  // Auto-focus logic
  React.useEffect(() => {
    if (expedition && selectedKarung && resiInputRef.current) {
      resiInputRef.current.focus();
    }
  }, [expedition, selectedKarung]);

  // Keep focus on resi input
  const keepFocus = () => {
    setTimeout(() => { // Use setTimeout to ensure focus after state updates
      if (resiInputRef.current) {
        resiInputRef.current.focus();
      }
    }, 0);
  };

  const handleScanResi = async () => {
    if (!resiNumber) {
      showError("Nomor resi tidak boleh kosong.");
      beepFailure.play();
      keepFocus();
      return;
    }
    if (!expedition || !selectedKarung) {
      showError("Pilih Expedisi dan No Karung terlebih dahulu.");
      beepFailure.play();
      keepFocus();
      return;
    }

    const currentResi = resiNumber.trim();
    setResiNumber(""); // Clear input immediately

    try {
      // 1. Validate if resi exists in tbl_expedisi and belongs to selected expedition
      const { data: expedisiData, error: expError } = await supabase
        .from("tbl_expedisi")
        .select("resino, couriername")
        .eq("resino", currentResi)
        .single();

      if (expError || !expedisiData) {
        showError("Resi tidak ditemukan di database ekspedisi.");
        beepFailure.play();
        return;
      }

      if (expedisiData.couriername !== expedition) {
        showError(`Resi ini bukan milik ekspedisi ${expedition}. Ini milik ${expedisiData.couriername}.`);
        beepFailure.play();
        return;
      }

      // 2. Validate for duplicate resi in tbl_resi for the current day, expedition, and karung
      // Use the RPC function to check for duplicates as well, for consistency
      const { data: duplicateResi, error: dupError } = await supabase.rpc("get_resi_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      }).eq("Resi", currentResi).eq("nokarung", selectedKarung);


      if (dupError) throw dupError;

      if (duplicateResi && duplicateResi.length > 0) {
        showError("Resi duplikat! Data sudah ada.");
        beepDouble.play();
        return;
      }

      // 3. Insert into tbl_resi
      const { error: insertError } = await supabase
        .from("tbl_resi")
        .insert({
          Resi: currentResi,
          nokarung: selectedKarung,
          Keterangan: "MASUK", // Assuming 'MASUK' is the status for successful scan
        });

      if (insertError) {
        showError(`Gagal menginput resi: ${insertError.message}`);
        beepFailure.play();
      } else {
        showSuccess(`Resi ${currentResi} berhasil diinput.`);
        beepSuccess.play();
        // Invalidate queries to refresh counts and history
        queryClient.invalidateQueries({ queryKey: ["allResiForExpedition", expedition, formattedDate] });
        queryClient.invalidateQueries({ queryKey: ["totalScan", formattedDate] });
        queryClient.invalidateQueries({ queryKey: ["allResi", formattedDate] });
        queryClient.invalidateQueries({ queryKey: ["historyData"] }); // Invalidate history data as well
      }
    } catch (error: any) {
      showError(`Terjadi kesalahan: ${error.message || "Unknown error"}`);
      beepFailure.play();
      console.error("Error during resi input:", error);
    } finally {
      keepFocus(); // Ensure focus remains after operation
    }
  };

  // Console log for debugging
  console.log("InputPage State:", {
    expedition,
    selectedKarung,
    isLoadingAllResiForExpedition,
    allResiForExpeditionCount: allResiForExpedition?.length,
    currentCount,
  });

  return (
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
              <SelectTrigger className="w-full bg-white text-gray-800">
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
              <SelectTrigger className="w-full bg-white text-gray-800">
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
              className="w-full bg-white text-gray-800"
              disabled={!expedition || !selectedKarung}
            />
          </div>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default InputPage;