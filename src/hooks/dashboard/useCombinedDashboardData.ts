import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";
import { supabase } from "@/integrations/supabase/client";
import { usePendingOperations } from "@/hooks/usePendingOperations";
import { ModalDataItem } from "@/types/data"; // Import ModalDataItem
import { useFollowUpRecords } from "@/hooks/dashboard/useFollowUpRecords"; // Import missing hook
import { useExpedisiRecordsForSelectedDate } from "@/hooks/dashboard/useExpedisiRecordsForSelectedDate"; // Import missing hook
import { useAllResiRecords } from "@/hooks/dashboard/useAllResiRecords"; // Import missing hook
import { useAllExpedisiRecordsUnfiltered } from "@/hooks/dashboard/useAllExpedisiRecordsUnfiltered"; // Import missing hook
import { useFollowUpFlagNoCount as useActualFollowUpFlagNoCount } from "@/hooks/dashboard/useFollowUpFlagNoCount"; // Import the dedicated hook

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
  expedisiDataForSelectedDate: ModalDataItem[] | undefined; // Explicitly type as ModalDataItem[]
  isLoadingExpedisiDataForSelectedDate: boolean;
  allResiData: ModalDataItem[] | undefined; // Explicitly type as ModalDataItem[]
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
  // const [followUpFlagNoCount, setFollowUpFlagNoCount] = useState<number>(0); // Dihapus, akan menggunakan data dari hook khusus
  const [scanFollowupLateCount, setScanFollowupLateCount] = useState<number>(0);
  const [batalCount, setBatalCount] = useState<number>(0);
  const [expeditionSummaries, setExpeditionSummaries] = useState<any[]>([]);

  // Fetch base data using individual hooks
  const { data: followUpData, isLoading: isLoadingFollowUp } = useFollowUpRecords(date);
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useExpedisiRecordsForSelectedDate(date);
  const { data: allResiData, isLoading: isLoadingAllResi } = useAllResiRecords(date);
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useAllExpedisiRecordsUnfiltered();
  // NEW: Fetch Follow Up (Flag NO except today) directly from its dedicated hook
  const { data: actualFollowUpFlagNoCount, isLoading: isLoadingActualFollowUpFlagNoCount } = useActualFollowUpFlagNoCount();


  // Get pending operations from IndexedDB
  const { pendingOperations } = usePendingOperations();

  // Process data to create all dashboard summaries and counts
  useEffect(() => {
    console.time("useCombinedDashboardData_useEffect_processing");
    if (!date || isLoadingAllExpedisiUnfiltered || isLoadingExpedisiDataForSelectedDate || isLoadingAllResi || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData) {
      setTransaksiHariIni(0);
      setTotalScan(0);
      setIdRekCount(0);
      setBelumKirim(0);
      // setFollowUpFlagNoCount(0); // Dihapus
      setScanFollowupLateCount(0);
      setBatalCount(0);
      setExpeditionSummaries([]);
      console.timeEnd("useCombinedDashboardData_useEffect_processing");
      return;
    }

    // Create mutable copies of data for merging
    const currentExpedisiData = new Map(allExpedisiDataUnfiltered);
    const currentResiData: ModalDataItem[] = [...allResiData]; // Cast to ModalDataItem[]

    // Apply pending operations to the data
    pendingOperations.forEach(op => {
      const normalizedResi = (op.payload.resiNumber || "").toLowerCase().trim();
      if (!normalizedResi) return;

      if (op.type === 'scan') {
        // Add new resi to currentResiData
        const newResiEntry: ModalDataItem = {
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
          ...(existingExpedisi || {}), // Ensure existingExpedisi is an object
          resino: op.payload.resiNumber,
          couriername: op.payload.courierNameFromExpedisi,
          flag: "YES", // Optimistically set to YES (akan dikelola trigger)
          created: existingExpedisi?.created || new Date(op.timestamp).toISOString(), // Keep original or use new
          cekfu: existingExpedisi?.cekfu || false, // Keep existing cekfu or default
        });

        // Update expedisiDataForSelectedDate if it's for the current date
        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const existingExpedisiForSelectedDate = expedisiDataForSelectedDate.find((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (!existingExpedisiForSelectedDate) {
            expedisiDataForSelectedDate.push({
              resino: op.payload.resiNumber,
              orderno: null, // Default for new scans
              chanelsales: null, // Default for new scans
              couriername: op.payload.courierNameFromExpedisi,
              created: new Date(op.timestamp).toISOString(),
              flag: "YES", // Optimistically set to YES
              datetrans: null, // Default for new scans
              cekfu: false,
            });
          } else {
            existingExpedisiForSelectedDate.flag = "YES";
          }
        }

      } else if (op.type === 'batal') {
        // Update resi schedule to 'batal' and Keterangan to original courier name
        const resiIndex = currentResiData.findIndex(r => (r.Resi || "").toLowerCase() === normalizedResi);
        if (resiIndex !== -1) {
          currentResiData[resiIndex] = { 
            ...currentResiData[resiIndex], 
            schedule: "batal", 
            Keterangan: op.payload.keteranganValue, // Now this is the original courier name
          };
        } else {
          // If resi not found in currentResiData, add it as a 'batal' entry
          currentResiData.push({
            Resi: op.payload.resiNumber,
            nokarung: "0", // Set nokarung to "0" for batal
            created: op.payload.createdTimestampFromExpedisi || new Date(op.timestamp).toISOString(),
            Keterangan: op.payload.keteranganValue, // Now this is the original courier name
            schedule: "batal",
          });
        }

        // No direct flag update on tbl_expedisi here, as it's handled by trigger.
        // The expedisi record's flag should remain 'YES' if the resi exists in tbl_resi.
        // If the resi is deleted from tbl_resi, the trigger will set flag to 'NO'.
        // For optimistic UI, we assume it's still 'YES' in tbl_expedisi unless explicitly deleted.

      } else if (op.type === 'confirm') {
        // Update resi schedule to 'ontime' and Keterangan to original courier name
        const resiIndex = currentResiData.findIndex(r => (r.Resi || "").toLowerCase() === normalizedResi);
        if (resiIndex !== -1) {
          currentResiData[resiIndex] = { 
            ...currentResiData[resiIndex], 
            schedule: "ontime", 
            Keterangan: op.payload.keteranganValue, // Should be original courier name
          };
        } else {
          // If resi not found in currentResiData, add it (e.g., if it was deleted but then confirmed)
          currentResiData.push({
            Resi: op.payload.resiNumber,
            nokarung: "0", // Set nokarung to "0" for confirm
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
          const indexInSelectedDate = expedisiDataForSelectedDate.findIndex((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
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
          const indexInSelectedDate = expedisiDataForSelectedDate.findIndex((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
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
    // let currentFollowUpFlagNoCount = 0; // Dihapus

    const today = new Date();
    const startOfSelectedDate = date ? startOfDay(date) : null;
    const endOfSelectedDate = date ? endOfDay(date) : null;

    // Calculate Transaksi Hari Ini and Belum Kirim (for selected date)
    expedisiDataForSelectedDate.forEach((exp: ModalDataItem) => { // Explicitly type exp
      currentTransaksiHariIni++;
      if (exp.flag === "NO") { // Tetap "NO" karena ini adalah status 'belum dikirim'
        currentBelumKirim++;
      }
    });

    // Calculate Total Scan, ID Rek, Batal, Scan Follow Up Late (for selected date)
    currentResiData.forEach((resi: ModalDataItem) => { // Explicitly type resi
      // Ensure resi.created is a valid date string before creating a Date object
      const resiCreatedDate = resi.created ? new Date(resi.created) : null;

      // Only consider resi records for the selected date for overall counts
      if (resiCreatedDate && startOfSelectedDate && endOfSelectedDate && 
          resiCreatedDate >= startOfSelectedDate && resiCreatedDate <= endOfSelectedDate) {
        if (resi.schedule === "ontime") {
          currentTotalScan++;
        }
        if (resi.Keterangan === "ID_REKOMENDASI") {
          currentIdRekCount++;
        }
        if (resi.schedule === "batal") {
          currentBatalCount++;
        }
        if (resi.schedule === "late") {
          currentScanFollowupLateCount++;
        }
      }
    });

    // Calculate Follow Up (Flag NO except today) - THIS IS NOW HANDLED BY DEDICATED HOOK
    // currentExpedisiData.forEach((exp: ModalDataItem) => { // Explicitly type exp as ModalDataItem
    //   const expedisiCreatedDate = exp.created ? new Date(exp.created) : null;
    //   if (exp.flag === "NO" && expedisiCreatedDate && !isSameDay(expedisiCreatedDate, today)) {
    //     currentFollowUpFlagNoCount++;
    //   }
    // });

    setTransaksiHariIni(currentTransaksiHariIni);
    setTotalScan(currentTotalScan);
    setIdRekCount(currentIdRekCount);
    setBelumKirim(currentBelumKirim);
    // setFollowUpFlagNoCount(currentFollowUpFlagNoCount); // Dihapus
    setScanFollowupLateCount(currentScanFollowupLateCount);
    setBatalCount(currentBatalCount);

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
    expedisiDataForSelectedDate.forEach((exp: ModalDataItem) => { // Explicitly type exp
      const normalizedCourierName = normalizeExpeditionName(exp.couriername);
      
      if (normalizedCourierName && summaries[normalizedCourierName]) {
        summaries[normalizedCourierName].totalTransaksi++;
        if (exp.flag === "NO") { // Tetap "NO" karena ini adalah status 'belum dikirim'
          summaries[normalizedCourierName].sisa++;
        }
      } else {
        console.warn(`expedisiDataForSelectedDate: Normalized Courier name '${normalizedCourierName}' not found in summaries or is null/empty for resino: ${exp.resino}. This record will not be counted in expedition summaries.`);
      }
    });

    // Populate totalScan, idRekomendasi, totalBatal, totalScanFollowUp, jumlahKarung from currentResiData (already filtered by date and potentially modified by pending ops)
    currentResiData.forEach((resi: ModalDataItem) => { // Explicitly type resi
      const resiCreatedDate = resi.created ? new Date(resi.created) : null;
      let attributedExpeditionName: string | null = null;

      // Only consider resi records for the selected date for per-expedition summaries
      if (!resiCreatedDate || !date || !isSameDay(resiCreatedDate, date)) {
        return; // Skip if not for the selected date or date is invalid
      }

      // Determine the expedition name for attribution
      // Now, Keterangan directly holds the original courier name for 'batal' items
      attributedExpeditionName = normalizeExpeditionName(resi.Keterangan);
      
      // Handle ID_REKOMENDASI special case for 'ID' expedition
      if (resi.Keterangan === "ID_REKOMENDASI") {
        if (summaries["ID"]) {
          summaries["ID"].idRekomendasi++;
          if (resi.nokarung) {
            summaries["ID"].jumlahKarung.add(resi.nokarung);
          }
          if (resi.schedule === "ontime") {
            summaries["ID"].totalScan++;
          }
          if (resi.schedule === "late") {
            summaries["ID"].totalScanFollowUp++;
          }
        }
      }
      // Handle BATAL special case
      else if (resi.schedule === "batal") {
        if (attributedExpeditionName && summaries[attributedExpeditionName]) {
          summaries[attributedExpeditionName].totalBatal++;
        } else {
          console.warn(`Resi ${resi.Resi} is 'batal' but original expedition '${attributedExpeditionName}' not found in summaries or is null/empty. Not counted in per-expedition 'totalBatal'.`);
        }
      }
      // Handle regular 'ontime' or 'late' scans for known original expeditions
      else if (attributedExpeditionName && summaries[attributedExpeditionName]) {
        if (resi.schedule === "ontime") {
          summaries[attributedExpeditionName].totalScan++;
        }
        if (resi.schedule === "late") {
          summaries[attributedExpeditionName].totalScanFollowUp++;
        }
        if (resi.nokarung) {
          summaries[attributedExpeditionName].jumlahKarung.add(resi.nokarung);
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
    console.timeEnd("useCombinedDashboardData_useEffect_processing");
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
    followUpFlagNoCount: actualFollowUpFlagNoCount || 0, // Menggunakan data dari hook khusus
    isLoadingFollowUpFlagNoCount: isLoadingActualFollowUpFlagNoCount, // Menggunakan loading state dari hook khusus
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