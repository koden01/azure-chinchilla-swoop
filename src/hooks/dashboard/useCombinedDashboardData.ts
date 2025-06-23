import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import React, { useEffect } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";
import { supabase } from "@/integrations/supabase/client";
import { usePendingOperations } from "@/hooks/usePendingOperations";
import { ModalDataItem } from "@/types/data";
import { useFollowUpRecords } from "@/hooks/dashboard/useFollowUpRecords";
import { useExpedisiRecordsForSelectedDate } from "@/hooks/dashboard/useExpedisiRecordsForSelectedDate";
import { useAllResiRecords } from "@/hooks/dashboard/useAllResiRecords";
import { useAllExpedisiRecordsUnfiltered } from "@/hooks/dashboard/useAllExpedisiRecordsUnfiltered";
import { useFollowUpFlagNoCount as useActualFollowUpFlagNoCount } from "@/hooks/dashboard/useFollowUpFlagNoCount";

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
  expedisiDataForSelectedDate: ModalDataItem[] | undefined;
  isLoadingExpedisiDataForSelectedDate: boolean;
  allResiData: ModalDataItem[] | undefined;
  isLoadingAllResi: boolean;
  isLoadingAllExpedisiUnfiltered: boolean;
}

export const useCombinedDashboardData = (date: Date | undefined): DashboardDataReturn => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const queryClient = useQueryClient();

  // Fetch base data using individual hooks
  const { data: followUpData, isLoading: isLoadingFollowUp } = useFollowUpRecords(date);
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useExpedisiRecordsForSelectedDate(date);
  const { data: allResiData, isLoading: isLoadingAllResi } = useAllResiRecords(date);
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useAllExpedisiRecordsUnfiltered();
  const { data: actualFollowUpFlagNoCount, isLoading: isLoadingActualFollowUpFlagNoCount } = useActualFollowUpFlagNoCount();

  // Get pending operations from IndexedDB
  const { pendingOperations } = usePendingOperations();

  // Memoized data with optimistic updates applied and all counts calculated
  const {
    currentResiDataWithOptimisticUpdates,
    currentExpedisiDataWithOptimisticUpdates,
    expedisiDataForSelectedDateWithOptimisticUpdates,
    transaksiHariIni,
    totalScan,
    idRekCount,
    belumKirim,
    scanFollowupLateCount,
    batalCount,
    expeditionSummaries
  } = React.useMemo(() => {
    if (!date || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData) {
      return {
        currentResiDataWithOptimisticUpdates: [],
        currentExpedisiDataWithOptimisticUpdates: new Map(),
        expedisiDataForSelectedDateWithOptimisticUpdates: [],
        transaksiHariIni: 0,
        totalScan: 0,
        idRekCount: 0,
        belumKirim: 0,
        scanFollowupLateCount: 0,
        batalCount: 0,
        expeditionSummaries: []
      };
    }

    const currentExpedisiData = new Map(allExpedisiDataUnfiltered);
    const currentResiData: ModalDataItem[] = [...allResiData];
    const currentExpedisiDataForSelectedDate: ModalDataItem[] = [...expedisiDataForSelectedDate];

    // Apply optimistic updates
    pendingOperations.forEach(op => {
      const normalizedResi = (op.payload.resiNumber || "").toLowerCase().trim();
      if (!normalizedResi) return;

      if (op.type === 'scan') {
        const newResiEntry: ModalDataItem = {
          Resi: op.payload.resiNumber,
          nokarung: op.payload.selectedKarung,
          created: new Date(op.timestamp).toISOString(),
          Keterangan: op.payload.courierNameFromExpedisi,
          schedule: "ontime",
        };
        currentResiData.push(newResiEntry);

        const existingExpedisi = currentExpedisiData.get(normalizedResi);
        currentExpedisiData.set(normalizedResi, {
          ...(existingExpedisi || {}),
          resino: op.payload.resiNumber,
          couriername: op.payload.courierNameFromExpedisi,
          flag: "YES",
          created: existingExpedisi?.created || new Date(op.timestamp).toISOString(),
          cekfu: existingExpedisi?.cekfu || false,
        });

        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const existingExpedisiForSelectedDate = currentExpedisiDataForSelectedDate.find((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (!existingExpedisiForSelectedDate) {
            currentExpedisiDataForSelectedDate.push({
              resino: op.payload.resiNumber,
              orderno: null,
              chanelsales: null,
              couriername: op.payload.courierNameFromExpedisi,
              created: new Date(op.timestamp).toISOString(),
              flag: "YES",
              datetrans: null,
              cekfu: false,
            });
          } else {
            existingExpedisiForSelectedDate.flag = "YES";
          }
        }

      } else if (op.type === 'batal') {
        const resiIndex = currentResiData.findIndex(r => (r.Resi || "").toLowerCase() === normalizedResi);
        if (resiIndex !== -1) {
          currentResiData[resiIndex] = { 
            ...currentResiData[resiIndex], 
            schedule: "batal", 
            Keterangan: op.payload.keteranganValue,
          };
        } else {
          currentResiData.push({
            Resi: op.payload.resiNumber,
            nokarung: "0",
            created: op.payload.createdTimestampFromExpedisi || new Date(op.timestamp).toISOString(),
            Keterangan: op.payload.keteranganValue,
            schedule: "batal",
          });
        }

      } else if (op.type === 'confirm') {
        const resiIndex = currentResiData.findIndex(r => (r.Resi || "").toLowerCase() === normalizedResi);
        if (resiIndex !== -1) {
          currentResiData[resiIndex] = { 
            ...currentResiData[resiIndex], 
            schedule: "ontime", 
            Keterangan: op.payload.keteranganValue,
          };
        } else {
          currentResiData.push({
            Resi: op.payload.resiNumber,
            nokarung: "0",
            created: op.payload.expedisiCreatedTimestamp || new Date(op.timestamp).toISOString(),
            Keterangan: op.payload.courierNameFromExpedisi,
            schedule: "ontime",
          });
        }

        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord) {
          currentExpedisiData.set(normalizedResi, { ...expedisiRecord, flag: "YES" });
        }

        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const indexInSelectedDate = currentExpedisiDataForSelectedDate.findIndex((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            currentExpedisiDataForSelectedDate[indexInSelectedDate].flag = "YES";
          }
        }

      } else if (op.type === 'cekfu') {
        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord) {
          currentExpedisiData.set(normalizedResi, { ...expedisiRecord, cekfu: op.payload.newCekfuStatus });
        }

        const opDate = new Date(op.timestamp);
        if (isSameDay(opDate, date)) {
          const indexInSelectedDate = currentExpedisiDataForSelectedDate.findIndex((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            currentExpedisiDataForSelectedDate[indexInSelectedDate].cekfu = op.payload.newCekfuStatus;
          }
        }
      }
    });

    // --- Calculate all counts and summaries based on optimistically updated data ---
    let currentBelumKirim = 0;
    let currentTotalScan = 0;
    let currentIdRekCount = 0;
    let currentBatalCount = 0;
    let currentScanFollowupLateCount = 0;
    let currentTransaksiHariIni = 0;

    const startOfSelectedDate = date ? startOfDay(date) : null;
    const endOfSelectedDate = date ? endOfDay(date) : null;

    // Calculate Transaksi Hari Ini and Belum Kirim (for selected date)
    currentExpedisiDataForSelectedDate.forEach((exp: ModalDataItem) => { // Corrected variable name here
      currentTransaksiHariIni++;
      if (exp.flag === "NO") {
        currentBelumKirim++;
      }
    });

    // Calculate Total Scan, ID Rek, Batal, Scan Follow Up Late (for selected date)
    currentResiData.forEach((resi: ModalDataItem) => {
      const resiCreatedDate = resi.created ? new Date(resi.created) : null;

      if (resiCreatedDate && startOfSelectedDate && endOfSelectedDate && resiCreatedDate >= startOfSelectedDate && resiCreatedDate <= endOfSelectedDate) {
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

    // --- Calculate per-expedition summaries ---
    const summaries: { [key: string]: any } = {};

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

    currentExpedisiDataForSelectedDate.forEach((exp: ModalDataItem) => { // Corrected variable name here
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

    currentResiData.forEach((resi: ModalDataItem) => {
      const resiCreatedDate = resi.created ? new Date(resi.created) : null;
      let attributedExpeditionName: string | null = null;

      if (!resiCreatedDate || !date || !isSameDay(resiCreatedDate, date)) {
        return;
      }

      attributedExpeditionName = normalizeExpeditionName(resi.Keterangan);

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
      else if (resi.schedule === "batal") {
        if (attributedExpeditionName && summaries[attributedExpeditionName]) {
          summaries[attributedExpeditionName].totalBatal++;
        } else {
          console.warn(`Resi ${resi.Resi} is 'batal' but original expedition '${attributedExpeditionName}' not found in summaries or is null/empty. Not counted in per-expedition 'totalBatal'.`);
        }
      }
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

    return {
      currentResiDataWithOptimisticUpdates: currentResiData,
      currentExpedisiDataWithOptimisticUpdates: currentExpedisiData,
      expedisiDataForSelectedDateWithOptimisticUpdates: currentExpedisiDataForSelectedDate,
      transaksiHariIni: currentTransaksiHariIni,
      totalScan: currentTotalScan,
      idRekCount: currentIdRekCount,
      belumKirim: currentBelumKirim,
      scanFollowupLateCount: currentScanFollowupLateCount,
      batalCount: currentBatalCount,
      expeditionSummaries: finalSummaries
    };
  }, [date, allExpedisiDataUnfiltered, expedisiDataForSelectedDate, allResiData, pendingOperations]);


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
    isLoadingTransaksiHariIni: isLoadingExpedisiDataForSelectedDate,
    totalScan,
    isLoadingTotalScan: isLoadingAllResi,
    idRekCount, 
    isLoadingIdRekCount: isLoadingAllResi,
    belumKirim,
    isLoadingBelumKirim: isLoadingExpedisiDataForSelectedDate,
    followUpFlagNoCount: actualFollowUpFlagNoCount || 0,
    isLoadingFollowUpFlagNoCount: isLoadingActualFollowUpFlagNoCount,
    scanFollowupLateCount, 
    isLoadingScanFollowupLateCount: isLoadingAllResi,
    batalCount,
    isLoadingBatalCount: isLoadingAllResi,
    followUpData,
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate,
    allExpedisiData: currentExpedisiDataWithOptimisticUpdates,
    expedisiDataForSelectedDate: expedisiDataForSelectedDateWithOptimisticUpdates,
    isLoadingExpedisiDataForSelectedDate,
    allResiData: currentResiDataWithOptimisticUpdates,
    isLoadingAllResi,
    isLoadingAllExpedisiUnfiltered,
  };
};