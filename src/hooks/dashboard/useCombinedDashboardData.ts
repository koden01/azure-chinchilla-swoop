import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { useEffect, useState } from "react";
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
import { useTransaksiHariIniCount as useActualTransaksiHariIniCount } from "@/hooks/dashboard/useTransaksiHariIniCount"; // NEW: Import the dedicated hook

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

  // State for derived summary counts
  // const [transaksiHariIni, setTransaksiHariIni] = useState<number>(0); // Dihapus, akan menggunakan data dari hook khusus
  const [totalScan, setTotalScan] = useState<number>(0);
  const [idRekCount, setIdRekCount] = useState<number>(0);
  const [belumKirim, setBelumKirim] = useState<number>(0);
  const [scanFollowupLateCount, setScanFollowupLateCount] = useState<number>(0);
  const [batalCount, setBatalCount] = useState<number>(0);
  const [expeditionSummaries, setExpeditionSummaries] = useState<any[]>([]);

  // Fetch base data using individual hooks
  const { data: followUpData, isLoading: isLoadingFollowUp } = useFollowUpRecords(date);
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useExpedisiRecordsForSelectedDate(date);
  const { data: allResiData, isLoading: isLoadingAllResi } = useAllResiRecords(date);
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useAllExpedisiRecordsUnfiltered();
  const { data: actualFollowUpFlagNoCount, isLoading: isLoadingActualFollowUpFlagNoCount } = useActualFollowUpFlagNoCount();
  const { data: actualTransaksiHariIniCount, isLoading: isLoadingActualTransaksiHariIniCount } = useActualTransaksiHariIniCount(date); // NEW: Use the dedicated hook

  // Get pending operations from IndexedDB
  const { pendingOperations } = usePendingOperations();

  // Process data to create all dashboard summaries and counts
  useEffect(() => {
    console.time("useCombinedDashboardData_useEffect_processing");
    if (!date || isLoadingAllExpedisiUnfiltered || isLoadingExpedisiDataForSelectedDate || isLoadingAllResi || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData) {
      // setTransaksiHariIni(0); // Dihapus
      setTotalScan(0);
      setIdRekCount(0);
      setBelumKirim(0);
      setScanFollowupLateCount(0);
      setBatalCount(0);
      setExpeditionSummaries([]);
      console.timeEnd("useCombinedDashboardData_useEffect_processing");
      return;
    }

    // Create mutable copies of data for merging
    const currentExpedisiData = new Map(allExpedisiDataUnfiltered);
    const currentResiData: ModalDataItem[] = [...allResiData];

    // Apply pending operations to the data
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
          const existingExpedisiForSelectedDate = expedisiDataForSelectedDate.find((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (!existingExpedisiForSelectedDate) {
            expedisiDataForSelectedDate.push({
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
          const indexInSelectedDate = expedisiDataForSelectedDate.findIndex((e: ModalDataItem) => (e.resino || "").toLowerCase() === normalizedResi);
          if (indexInSelectedDate !== -1) {
            expedisiDataForSelectedDate[indexInSelectedDate].flag = "YES";
          }
        }

      } else if (op.type === 'cekfu') {
        const expedisiRecord = currentExpedisiData.get(normalizedResi);
        if (expedisiRecord) {
          currentExpedisiData.set(normalizedResi, { ...expedisiRecord, cekfu: op.payload.newCekfuStatus });
        }

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
    // let currentTransaksiHariIni = 0; // Dihapus
    let currentBelumKirim = 0;
    let currentTotalScan = 0;
    let currentIdRekCount = 0;
    let currentBatalCount = 0;
    let currentScanFollowupLateCount = 0;

    const today = new Date();
    const startOfSelectedDate = date ? startOfDay(date) : null;
    const endOfSelectedDate = date ? endOfDay(date) : null;

    // Calculate Belum Kirim (for selected date)
    expedisiDataForSelectedDate.forEach((exp: ModalDataItem) => {
      // currentTransaksiHariIni++; // Dihapus, karena sudah diambil dari hook khusus
      if (exp.flag === "NO") {
        currentBelumKirim++;
      }
    });

    // Calculate Total Scan, ID Rek, Batal, Scan Follow Up Late (for selected date)
    currentResiData.forEach((resi: ModalDataItem) => {
      const resiCreatedDate = resi.created ? new Date(resi.created) : null;

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

    // setTransaksiHariIni(currentTransaksiHariIni); // Dihapus
    setTotalScan(currentTotalScan);
    setIdRekCount(currentIdRekCount);
    setBelumKirim(currentBelumKirim);
    setScanFollowupLateCount(currentScanFollowupLateCount);
    setBatalCount(currentBatalCount);

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

    expedisiDataForSelectedDate.forEach((exp: ModalDataItem) => {
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
    transaksiHariIni: actualTransaksiHariIniCount || 0, // NEW: Menggunakan data dari hook khusus
    isLoadingTransaksiHariIni: isLoadingActualTransaksiHariIniCount, // NEW: Menggunakan loading state dari hook khusus
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
    allExpedisiData: allExpedisiDataUnfiltered,
    expedisiDataForSelectedDate,
    isLoadingExpedisiDataForSelectedDate,
    allResiData,
    isLoadingAllResi,
    isLoadingAllExpedisiUnfiltered,
  };
};