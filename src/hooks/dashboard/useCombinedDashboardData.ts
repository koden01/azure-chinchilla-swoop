import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
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
import { safeParseDate } from "@/lib/utils"; // Import safeParseDate

// Import individual count hooks
import { useTransaksiHariIniCount } from "@/hooks/dashboard/useTransaksiHariIniCount";
import { useTotalScanCount } from "@/hooks/dashboard/useTotalScanCount";
import { useIdRekCount } from "@/hooks/dashboard/useIdRekCount";
import { useBelumKirimCount } from "@/hooks/dashboard/useBelumKirimCount";
import { useFollowUpFlagNoCount } from "@/hooks/dashboard/useFollowUpFlagNoCount";
import { useScanFollowupLateCount } from "@/hooks/dashboard/useScanFollowupLateCount";
import { useBatalCount } from "@/hooks/dashboard/useBatalCount";


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

  // Fetch base data using individual hooks (for main summary cards)
  const { data: transaksiHariIni, isLoading: isLoadingTransaksiHariIni } = useTransaksiHariIniCount(date);
  const { data: totalScan, isLoading: isLoadingTotalScan } = useTotalScanCount(date);
  const { data: idRekCount, isLoading: isLoadingIdRekCount } = useIdRekCount(date);
  const { data: belumKirim, isLoading: isLoadingBelumKirim } = useBelumKirimCount(date);
  const { data: followUpFlagNoCount, isLoading: isLoadingFollowUpFlagNoCount } = useFollowUpFlagNoCount(); // This hook already uses actual current date
  const { data: scanFollowupLateCount, isLoading: isLoadingScanFollowupLateCount } = useScanFollowupLateCount(date);
  const { data: batalCount, isLoading: isLoadingBatalCount } = useBatalCount(date);

  // Fetch data needed for detail modals and expedition summaries
  const { data: followUpData, isLoading: isLoadingFollowUp } = useFollowUpRecords(date);
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useExpedisiRecordsForSelectedDate(date);
  const { data: allResiData, isLoading: isLoadingAllResi } = useAllResiRecords(date);
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useAllExpedisiRecordsUnfiltered();

  // Get pending operations from IndexedDB
  const { pendingOperations } = usePendingOperations();

  // Memoized data with optimistic updates applied and all counts calculated
  const {
    currentResiDataWithOptimisticUpdates,
    currentExpedisiDataWithOptimisticUpdates,
    expedisiDataForSelectedDateWithOptimisticUpdates,
    expeditionSummaries
  } = React.useMemo(() => {
    if (!date || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData) {
      return {
        currentResiDataWithOptimisticUpdates: [],
        currentExpedisiDataWithOptimisticUpdates: new Map(),
        expedisiDataForSelectedDateWithOptimisticUpdates: [],
        expeditionSummaries: []
      };
    }

    // Ensure allExpedisiDataUnfiltered is a Map instance
    const currentExpedisiData = (allExpedisiDataUnfiltered instanceof Map)
      ? new Map(allExpedisiDataUnfiltered)
      : new Map();
    
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
          created: safeParseDate(op.timestamp)?.toISOString() || new Date().toISOString(), // Use safeParseDate
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
          created: safeParseDate(existingExpedisi?.created)?.toISOString() || safeParseDate(op.timestamp)?.toISOString() || new Date().toISOString(), // Use safeParseDate
          cekfu: existingExpedisi?.cekfu || false,
        });

        const opDate = safeParseDate(op.timestamp); // Use safeParseDate
        if (opDate && date && isSameDay(opDate, date)) { // Add null/undefined check for opDate and date
          const existingExpedisiForSelectedDate = currentExpedisiDataForSelectedDate.find((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (!existingExpedisiForSelectedDate) {
            currentExpedisiDataForSelectedDate.push({
              resino: op.payload.resiNumber,
              orderno: null,
              chanelsales: null,
              couriername: op.payload.courierNameFromExpedisi,
              created: safeParseDate(op.timestamp)?.toISOString() || new Date().toISOString(), // Use safeParseDate
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
            created: safeParseDate(op.payload.createdTimestampFromExpedisi)?.toISOString() || safeParseDate(op.timestamp)?.toISOString() || new Date().toISOString(), // Use safeParseDate
            Keterangan: op.payload.keteranganValue,
            schedule: "batal",
          });
        }

      } else if (op.type === 'confirm') {
        const createdDateString = safeParseDate(op.payload.expedisiCreatedTimestamp)?.toISOString() || safeParseDate(op.timestamp)?.toISOString() || new Date().toISOString(); // Use safeParseDate
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
            created: createdDateString,
            Keterangan: op.payload.courierNameFromExpedisi,
            schedule: "ontime",
          });
        }

        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord) {
          currentExpedisiData.set(normalizedResi, { ...expedisiRecord, flag: "YES" });
        }

        const opDate = safeParseDate(op.timestamp); // Use safeParseDate
        if (opDate && date && isSameDay(opDate, date)) { // Add null/undefined check for opDate and date
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

        const opDate = safeParseDate(op.timestamp); // Use safeParseDate
        if (opDate && date && isSameDay(opDate, date)) { // Add null/undefined check for opDate and date
          const indexInSelectedDate = currentExpedisiDataForSelectedDate.findIndex((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            currentExpedisiDataForSelectedDate[indexInSelectedDate].cekfu = op.payload.newCekfuStatus;
          }
        }
      }
    });

    // --- Calculate per-expedition summaries based on optimistically updated data ---
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
      }
    });

    currentResiData.forEach((resi: ModalDataItem) => {
      const resiCreatedDate = safeParseDate(resi.created); // Use safeParseDate
      let attributedExpeditionName: string | null = null;

      if (!resiCreatedDate || !date || !isSameDay(resiCreatedDate, date)) { // Add null/undefined check for resiCreatedDate and date
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
    transaksiHariIni: transaksiHariIni || 0,
    isLoadingTransaksiHariIni,
    totalScan: totalScan || 0,
    isLoadingTotalScan,
    idRekCount: idRekCount || 0, 
    isLoadingIdRekCount,
    belumKirim: belumKirim || 0,
    isLoadingBelumKirim,
    followUpFlagNoCount: followUpFlagNoCount || 0,
    isLoadingFollowUpFlagNoCount,
    scanFollowupLateCount: scanFollowupLateCount || 0, 
    isLoadingScanFollowupLateCount,
    batalCount: batalCount || 0,
    isLoadingBatalCount,
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