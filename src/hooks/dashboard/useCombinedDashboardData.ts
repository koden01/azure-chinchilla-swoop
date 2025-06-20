import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";
import { supabase } from "@/integrations/supabase/client";
import { usePendingOperations } from "@/hooks/usePendingOperations";

// Import base data hooks
import { useFollowUpRecords } from "./useFollowUpRecords";
import { useExpedisiRecordsForSelectedDate } from "./useExpedisiRecordsForSelectedDate";
import { useAllResiRecords } from "./useAllResiRecords";
import { useAllExpedisiRecordsUnfiltered } from "./useAllExpedisiRecordsUnfiltered";

// Define the return type interface for useCombinedDashboardData
interface DashboardDataReturn {
  transaksiHariIni: number;
  isLoadingTransaksiHariIni: boolean;
  totalScan: number;
  isLoadingTotalScan: boolean;
  idRekCount: number;
  isLoadingIdRekCount: boolean;
  belumKirim: number;
  isLoadingBelumKirim: boolean;
  followUpFlagNoCount: number;
  isLoadingFollowUpFlagNoCount: boolean;
  scanFollowupLateCount: number;
  isLoadingScanFollowupLateCount: boolean;
  batalCount: number;
  isLoadingBatalCount: boolean;
  followUpData: any[] | undefined;
  isLoadingFollowUp: boolean;
  expeditionSummaries: any[];
  formattedDate: string;
  allExpedisiData: Map<string, any> | undefined;
  expedisiDataForSelectedDate: any[] | undefined;
  isLoadingExpedisiDataForSelectedDate: boolean;
  allResiData: any[] | undefined;
  isLoadingAllResi: boolean;
  isLoadingAllExpedisiUnfiltered: boolean;
}

export const useCombinedDashboardData = (date: Date | undefined): DashboardDataReturn => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const queryClient = useQueryClient();

  // State for derived summary counts
  const [transaksiHariIni, setTransaksiHariIni] = useState<number>(0);
  const [totalScan, setTotalScan] = useState<number>(0);
  const [idRekCount, setIdRekCount] = useState<number>(0);
  const [belumKirim, setBelumKirim] = useState<number>(0);
  const [followUpFlagNoCount, setFollowUpFlagNoCount] = useState<number>(0);
  const [scanFollowupLateCount, setScanFollowupLateCount] = useState<number>(0);
  const [batalCount, setBatalCount] = useState<number>(0);
  const [expeditionSummaries, setExpeditionSummaries] = useState<any[]>([]);

  // Fetch base data using individual hooks
  const { data: followUpData, isLoading: isLoadingFollowUp } = useFollowUpRecords(date);
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useExpedisiRecordsForSelectedDate(date);
  const { data: allResiData, isLoading: isLoadingAllResi } = useAllResiRecords(date);
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useAllExpedisiRecordsUnfiltered();

  // Get pending operations from IndexedDB
  const { pendingOperations } = usePendingOperations();

  // Process data to create all dashboard summaries and counts
  useEffect(() => {
    if (!date || isLoadingAllExpedisiUnfiltered || isLoadingExpedisiDataForSelectedDate || isLoadingAllResi || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData) {
      setTransaksiHariIni(0);
      setTotalScan(0);
      setIdRekCount(0);
      setBelumKirim(0);
      setFollowUpFlagNoCount(0);
      setScanFollowupLateCount(0);
      setBatalCount(0);
      setExpeditionSummaries([]);
      return;
    }

    // Create mutable copies of data for merging
    const currentExpedisiData = new Map(allExpedisiDataUnfiltered);
    const currentResiData = [...allResiData];

    // Apply pending operations to the data
    pendingOperations.forEach(op => {
      const normalizedResi = (op.payload.resiNumber || "").toLowerCase().trim();
      if (!normalizedResi) return;

      if (op.type === 'scan') {
        // Add new resi to currentResiData
        const newResiEntry = {
          Resi: op.payload.resiNumber,
          nokarung: op.payload.selectedKarung,
          created: new Date(op.timestamp).toISOString(), // Use operation timestamp for consistency
          Keterangan: op.payload.courierNameFromExpedisi,
          schedule: "ontime", // Optimistic schedule
        };
        currentResiData.push(newResiEntry);

        // Update or add expedisi record in currentExpedisiData
        const existingExpedisi = currentExpedisiData.get(normalizedResi);
        currentExpedisiData.set(normalizedResi, {
          ...existingExpedisi,
          resino: op.payload.resiNumber,
          couriername: op.payload.courierNameFromExpedisi,
          flag: "YES", // Optimistically set to YES
          created: existingExpedisi?.created || new Date(op.timestamp).toISOString(), // Keep original or use new
          cekfu: existingExpedisi?.cekfu || false, // Keep existing cekfu or default
        });

        // Update expedisiDataForSelectedDate if it's for the current date
        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const existingExpedisiForSelectedDate = expedisiDataForSelectedDate.find(e => (e.resino || "").toLowerCase() === normalizedResi);
          if (!existingExpedisiForSelectedDate) {
            expedisiDataForSelectedDate.push({
              resino: op.payload.resiNumber,
              orderno: null, // Default for new scans
              chanelsales: null, // Default for new scans
              couriername: op.payload.courierNameFromExpedisi,
              created: new Date(op.timestamp).toISOString(),
              flag: "YES",
              datetrans: null, // Default for new scans
              cekfu: false,
            });
          } else {
            existingExpedisiForSelectedDate.flag = "YES";
          }
        }

      } else if (op.type === 'batal') {
        // Update resi schedule to 'batal'
        const resiIndex = currentResiData.findIndex(r => (r.Resi || "").toLowerCase() === normalizedResi);
        if (resiIndex !== -1) {
          currentResiData[resiIndex] = { ...currentResiData[resiIndex], schedule: "batal" };
        }

        // Update expedisi flag to 'BATAL'
        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord) {
          currentExpedisiData.set(normalizedResi, { ...expedisiRecord, flag: "BATAL" });
        }

        // Update expedisiDataForSelectedDate if it was present and for current date
        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const indexInSelectedDate = expedisiDataForSelectedDate.findIndex(e => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            expedisiDataForSelectedDate[indexInSelectedDate].flag = "BATAL";
          }
        }

      } else if (op.type === 'confirm') {
        // Update resi schedule to 'ontime'
        const resiIndex = currentResiData.findIndex(r => (r.Resi || "").toLowerCase() === normalizedResi);
        if (resiIndex !== -1) {
          currentResiData[resiIndex] = { ...currentResiData[resiIndex], schedule: "ontime" };
        } else {
          // If resi not found in currentResiData, add it (e.g., if it was deleted but then confirmed)
          currentResiData.push({
            Resi: op.payload.resiNumber,
            nokarung: null, // Assuming no karung for confirmed items if not provided
            created: op.payload.expedisiCreatedTimestamp || new Date(op.timestamp).toISOString(),
            Keterangan: op.payload.courierNameFromExpedisi,
            schedule: "ontime",
          });
        }

        // Update expedisi flag to 'YES'
        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord) {
          currentExpedisiData.set(normalizedResi, { ...expedisiRecord, flag: "YES" });
        }

        // Update expedisiDataForSelectedDate if it was present and for current date
        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const indexInSelectedDate = expedisiDataForSelectedDate.findIndex(e => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            expedisiDataForSelectedDate[indexInSelectedDate].flag = "YES";
          }
        }

      } else if (op.type === 'cekfu') {
        // Update expedisi cekfu status
        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord) {
          currentExpedisiData.set(normalizedResi, { ...expedisiRecord, cekfu: op.payload.newCekfuStatus });
        }

        // Update expedisiDataForSelectedDate if it was present and for current date
        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const indexInSelectedDate = expedisiDataForSelectedDate.findIndex(e => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            expedisiDataForSelectedDate[indexInSelectedDate].cekfu = op.payload.newCekfuStatus;
          }
        }
      }
    });

    // --- Calculate overall summary counts ---
    let currentTransaksiHariIni = 0;
    let currentBelumKirim = 0;
    let currentTotalScan = 0;
    let currentIdRekCount = 0;
    let currentBatalCount = 0;
    let currentScanFollowupLateCount = 0;
    let currentFollowUpFlagNoCount = 0; // This one is special, it's for *except today*

    const today = new Date();
    const startOfSelectedDate = startOfDay(date);
    const endOfSelectedDate = endOfDay(date);

    // Calculate Transaksi Hari Ini and Belum Kirim (for selected date)
    expedisiDataForSelectedDate.forEach(exp => {
      currentTransaksiHariIni++;
      if (exp.flag === "NO") {
        currentBelumKirim++;
      }
    });

    // Calculate Total Scan, ID Rek, Batal, Scan Follow Up Late (for selected date)
    currentResiData.forEach(resi => {
      const resiCreatedDate = new Date(resi.created);
      if (resiCreatedDate >= startOfSelectedDate && resiCreatedDate <= endOfSelectedDate) {
        if (resi.schedule === "ontime") {
          currentTotalScan++;
        }
        if (resi.Keterangan === "ID_REKOMENDASI") { // Fixed typo here
          currentIdRekCount++;
        }
        if (resi.schedule === "batal") {
          currentBatalCount++;
          console.log(`[DEBUG] Resi ${resi.Resi} is 'batal'. currentBatalCount: ${currentBatalCount}`);
        }
        if (resi.schedule === "late") {
          currentScanFollowupLateCount++;
        }
      }
    });

    // Calculate Follow Up (Flag NO except today)
    // This count needs to iterate through allExpedisiDataUnfiltered and check dates
    currentExpedisiData.forEach(exp => {
      const expedisiCreatedDate = new Date(exp.created);
      if (exp.flag === "NO" && !isSameDay(expedisiCreatedDate, today)) {
        currentFollowUpFlagNoCount++;
      }
    });

    setTransaksiHariIni(currentTransaksiHariIni);
    setTotalScan(currentTotalScan);
    setIdRekCount(currentIdRekCount);
    setBelumKirim(currentBelumKirim);
    setFollowUpFlagNoCount(currentFollowUpFlagNoCount);
    setScanFollowupLateCount(currentScanFollowupLateCount);
    setBatalCount(currentBatalCount);
    console.log(`[DEBUG] Final overall batalCount: ${currentBatalCount}`);

    // --- Calculate per-expedition summaries ---
    const summaries: { [key: string]: any } = {};

    // Initialize summaries for all known expeditions
    KNOWN_EXPEDITIONS.forEach(name => {
      summaries[name] = {
        name,
        totalTransaksi: 0,
        totalScan: 0,
        sisa: 0,
        jumlahKarung: new Set<string>(),
        idRekomendasi: 0,
        totalBatal: 0,
        totalScanFollowUp: 0,
      };
    });

    // Populate totalTransaksi and sisa from expedisiDataForSelectedDate (already filtered by date and potentially modified by pending ops)
    expedisiDataForSelectedDate.forEach(exp => {
      const normalizedCourierName = normalizeExpeditionName(exp.couriername);
      
      if (normalizedCourierName && summaries[normalizedCourierName]) {
        summaries[normalizedCourierName].totalTransaksi++;
        if (exp.flag === "NO") {
          summaries[normalizedCourierName].sisa++;
        }
      } else {
        console.warn(`expedisiDataForSelectedDate: Normalized Courier name '${normalizedCourierName}' not found in summaries or is null/empty for resino: ${exp.resino}. This record will not be counted in expedition summaries.`);
      }
    });

    // Populate totalScan, idRekomendasi, totalBatal, totalScanFollowUp, jumlahKarung from currentResiData (already filtered by date and potentially modified by pending ops)
    currentResiData.forEach(resi => {
      const resiCreatedDate = new Date(resi.created);
      
      // Only consider resi records for the selected date for per-expedition summaries
      if (!isSameDay(resiCreatedDate, date)) {
        return; // Skip if not for the selected date
      }

      const normalizedResiKeterangan = normalizeExpeditionName(resi.Keterangan);

      if (normalizedResiKeterangan && summaries[normalizedResiKeterangan]) {
        if (resi.schedule === "ontime") {
          summaries[normalizedResiKeterangan].totalScan++;
        }
        if (resi.schedule === "late") {
          summaries[normalizedResiKeterangan].totalScanFollowUp++;
        }
        if (resi.schedule === "batal") {
          summaries[normalizedResiKeterangan].totalBatal++;
          console.log(`[DEBUG] Expedition ${normalizedResiKeterangan} totalBatal incremented. Current: ${summaries[normalizedResiKeterangan].totalBatal}`);
        }
        if (resi.Keterangan === "ID_REKOMENDASI") { // Specific check for ID_REKOMENDASI
          summaries[normalizedResiKeterangan].idRekomendasi++;
        }
        if (resi.nokarung) {
          summaries[normalizedResiKeterangan].jumlahKarung.add(resi.nokarung);
        }
      } else {
        console.warn(`Resi ${resi.Resi} (Keterangan: ${resi.Keterangan}, Schedule: ${resi.schedule}) not attributed to any known expedition summary.`);
      }
    });

    const finalSummaries = Object.values(summaries).map(summary => ({
      ...summary,
      jumlahKarung: summary.jumlahKarung.size,
    }));

    setExpeditionSummaries(finalSummaries);
  }, [date, allExpedisiDataUnfiltered, expedisiDataForSelectedDate, allResiData, pendingOperations, isLoadingAllExpedisiUnfiltered, isLoadingExpedisiDataForSelectedDate, isLoadingAllResi]);

  const debouncedInvalidateDashboardQueries = useDebouncedCallback(() => {
    invalidateDashboardQueries(queryClient, new Date(), undefined); 
  }, 150);

  useEffect(() => {
    const handleRealtimeEvent = (_payload: any) => {
      debouncedInvalidateDashboardQueries();
    };

    const resiChannel = supabase
      .channel('dashboard_resi_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tbl_resi' }, handleRealtimeEvent)
      .subscribe();

    const expedisiChannel = supabase
      .channel('dashboard_expedisi_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tbl_expedisi' }, handleRealtimeEvent)
      .subscribe();

    return () => {
      supabase.removeChannel(resiChannel);
      supabase.removeChannel(expedisiChannel);
    };
  }, [debouncedInvalidateDashboardQueries]);

  return {
    transaksiHariIni,
    isLoadingTransaksiHariIni: isLoadingExpedisiDataForSelectedDate, // Now depends on expedisiDataForSelectedDate
    totalScan,
    isLoadingTotalScan: isLoadingAllResi, // Now depends on allResiData
    idRekCount, 
    isLoadingIdRekCount: isLoadingAllResi, // Now depends on allResiData
    belumKirim,
    isLoadingBelumKirim: isLoadingExpedisiDataForSelectedDate, // Now depends on expedisiDataForSelectedDate
    followUpFlagNoCount, 
    isLoadingFollowUpFlagNoCount: isLoadingAllExpedisiUnfiltered, // Now depends on allExpedisiDataUnfiltered
    scanFollowupLateCount, 
    isLoadingScanFollowupLateCount: isLoadingAllResi, // Now depends on allResiData
    batalCount,
    isLoadingBatalCount: isLoadingAllResi, // Now depends on allResiData
    followUpData,
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate,
    allExpedisiData: allExpedisiDataUnfiltered,
    expedisiDataForSelectedDate,
    isLoadingExpedisiDataForSelectedDate,
    allResiData,
    isLoadingAllResi,
    isLoadingAllExpedisiUnfiltered,
  };
};