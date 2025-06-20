import { useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";
import { supabase } from "@/integrations/supabase/client";
import { PendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { usePendingOperations } from "@/hooks/usePendingOperations"; // NEW: Import usePendingOperations

// Import individual hooks
import { useTransaksiHariIniCount } from "./useTransaksiHariIniCount";
import { useTotalScanCount } from "./useTotalScanCount";
import { useIdRekCount } from "./useIdRekCount";
import { useBelumKirimCount } from "./useBelumKirimCount";
import { useFollowUpFlagNoCount } from "./useFollowUpFlagNoCount";
import { useScanFollowupLateCount } from "./useScanFollowupLateCount";
import { useBatalCount } from "./useBatalCount";
import { useFollowUpRecords } from "./useFollowUpRecords";
import { useExpedisiRecordsForSelectedDate } from "./useExpedisiRecordsForSelectedDate";
import { useAllResiRecords } from "./useAllResiRecords";
import { useAllExpedisiRecordsUnfiltered } from "./useAllExpedisiRecordsUnfiltered";

// Define the return type interface for useCombinedDashboardData
interface DashboardDataReturn {
  transaksiHariIni: number | undefined;
  isLoadingTransaksiHariIni: boolean;
  totalScan: number | undefined;
  isLoadingTotalScan: boolean;
  idRekCount: number | undefined;
  isLoadingIdRekCount: boolean;
  belumKirim: number | undefined;
  isLoadingBelumKirim: boolean;
  followUpFlagNoCount: number | undefined;
  isLoadingFollowUpFlagNoCount: boolean;
  scanFollowupLateCount: number | undefined;
  isLoadingScanFollowupLateCount: boolean;
  batalCount: number | undefined;
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

  const [expeditionSummaries, setExpeditionSummaries] = useState<any[]>([]);

  // Fetch data using individual hooks
  const { data: transaksiHariIni, isLoading: isLoadingTransaksiHariIni } = useTransaksiHariIniCount(date);
  const { data: totalScan, isLoading: isLoadingTotalScan } = useTotalScanCount(date);
  const { data: idRekCount, isLoading: isLoadingIdRekCount } = useIdRekCount(date);
  const { data: belumKirim, isLoading: isLoadingBelumKirim } = useBelumKirimCount(date);
  const { data: followUpFlagNoCount, isLoading: isLoadingFollowUpFlagNoCount } = useFollowUpFlagNoCount();
  const { data: scanFollowupLateCount, isLoading: isLoadingScanFollowupLateCount } = useScanFollowupLateCount(date);
  const { data: batalCount, isLoading: isLoadingBatalCount } = useBatalCount(date);
  const { data: followUpData, isLoading: isLoadingFollowUp } = useFollowUpRecords(date);
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useExpedisiRecordsForSelectedDate(date);
  const { data: allResiData, isLoading: isLoadingAllResi } = useAllResiRecords(date);
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useAllExpedisiRecordsUnfiltered();

  // NEW: Get pending operations from IndexedDB
  const { pendingOperations } = usePendingOperations();

  // Process data to create expedition summaries
  useEffect(() => {
    if (isLoadingAllExpedisiUnfiltered || isLoadingExpedisiDataForSelectedDate || isLoadingAllResi || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData || !date) {
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
        const opDate = format(new Date(op.timestamp), "yyyy-MM-dd");
        if (opDate === formattedDate) {
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

        // Remove from expedisiDataForSelectedDate if it was present and for current date
        const opDate = format(new Date(op.timestamp), "yyyy-MM-dd");
        if (opDate === formattedDate) {
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
        const opDate = format(new Date(op.timestamp), "yyyy-MM-dd");
        if (opDate === formattedDate) {
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
        const opDate = format(new Date(op.timestamp), "yyyy-MM-dd");
        if (opDate === formattedDate) {
          const indexInSelectedDate = expedisiDataForSelectedDate.findIndex(e => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            expedisiDataForSelectedDate[indexInSelectedDate].cekfu = op.payload.newCekfuStatus;
          }
        }
      }
    });

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
      const normalizedResi = resi.Resi?.trim().toLowerCase();
      let originalExpeditionName: string | null = null;

      // Try to get the original courier name from currentExpedisiData first
      if (normalizedResi) {
        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord && expedisiRecord.couriername) {
          originalExpeditionName = normalizeExpeditionName(expedisiRecord.couriername);
        }
      }

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
        // Attribute 'batal' to the original expedition if known, otherwise it's a global count
        if (originalExpeditionName && summaries[originalExpeditionName]) {
          summaries[originalExpeditionName].totalBatal++;
        } else {
          console.warn(`Resi ${resi.Resi} is 'batal' but original expedition could not be determined. Not counted in per-expedition 'totalBatal'.`);
        }
      }
      // Handle regular 'ontime' or 'late' scans for known original expeditions
      else if (originalExpeditionName && summaries[originalExpeditionName]) {
        if (resi.schedule === "ontime") {
          summaries[originalExpeditionName].totalScan++;
        }
        if (resi.schedule === "late") {
          summaries[originalExpeditionName].totalScanFollowUp++;
        }
        if (resi.nokarung) {
          summaries[originalExpeditionName].jumlahKarung.add(resi.nokarung);
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
    isLoadingTransaksiHariIni,
    totalScan,
    isLoadingTotalScan,
    idRekCount, 
    isLoadingIdRekCount,
    belumKirim,
    isLoadingBelumKirim,
    followUpFlagNoCount, 
    isLoadingFollowUpFlagNoCount, 
    scanFollowupLateCount, 
    isLoadingScanFollowupLateCount, 
    batalCount,
    isLoadingBatalCount,
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