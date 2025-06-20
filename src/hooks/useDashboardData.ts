import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useEffect, useState } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils"; // Import new utility

// Define the return type interface for useDashboardData
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
  allExpedisiData: Map<string, any> | undefined; // This is the aliased allExpedisiDataUnfiltered
  expedisiDataForSelectedDate: any[] | undefined; // Explicitly added
  isLoadingExpedisiDataForSelectedDate: boolean; // Explicitly added
  allResiData: any[] | undefined; // Explicitly added
  isLoadingAllResi: boolean; // Explicitly added
}

export const useDashboardData = (date: Date | undefined): DashboardDataReturn => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const queryClient = useQueryClient();

  // State to hold expedition summaries
  const [expeditionSummaries, setExpeditionSummaries] = useState<any[]>([]);

  // Calculate date range for 2 days back for allExpedisiDataUnfiltered
  const today = new Date();
  const twoDaysAgo = subDays(today, 2); // Covers today, yesterday, and the day before yesterday
  const twoDaysAgoFormatted = format(twoDaysAgo, "yyyy-MM-dd");
  const endOfTodayFormatted = format(today, "yyyy-MM-dd"); // For the end of the range key

  // Query for Transaksi Hari Ini (tbl_expedisi count for selected date) using RPC
  const { data: transaksiHariIni, isLoading: isLoadingTransaksiHariIni, error: transaksiHariIniError } = useQuery<number>({
    queryKey: ["transaksiHariIni", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { data: countData, error } = await supabase.rpc("get_transaksi_hari_ini_count", {
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching Transaksi Hari Ini count:", error);
        throw error;
      }
      console.log("Transaksi Hari Ini (Summary Card):", countData);
      return countData || 0;
    },
    enabled: !!date,
  });


  // Query for Total Scan (tbl_resi count where schedule = 'ontime' for selected date)
  const { data: totalScan, isLoading: isLoadingTotalScan, error: totalScanError } = useQuery<number>({
    queryKey: ["totalScan", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("schedule", "ontime")
        .gte("created", startOfDay(date).toISOString()) // Correct for timestamp with time zone
        .lt("created", endOfDay(date).toISOString()); // Correct for timestamp with time zone
      if (error) {
        console.error("Error fetching Total Scan:", error);
        throw error;
      }
      console.log("Total Scan (Summary Card):", count);
      return count || 0;
    },
    enabled: !!date,
  });


  // Query for ID Rekomendasi (tbl_resi count where Keterangan = 'ID_REKOMENDASI' for selected date)
  const { data: idRekCount, isLoading: isLoadingIdRekCount, error: idRekCountError } = useQuery<number>({
    queryKey: ["idRekCount", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("Keterangan", "ID_REKOMENDASI") // Changed to Keterangan
        .gte("created", startOfDay(date).toISOString()) // Correct for timestamp with time zone
        .lt("created", endOfDay(date).toISOString()); // Correct for timestamp with time zone
      if (error) {
        console.error("Error fetching ID Rekomendasi:", error);
        throw error;
      }
      console.log("ID Rekomendasi (Summary Card):", count);
      return count || 0;
    },
    enabled: !!date,
  });


  // Query for Belum Kirim (tbl_expedisi count where flag = 'NO' for selected date) using RPC
  const { data: belumKirim, isLoading: isLoadingBelumKirim, error: belumKirimError } = useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { data: countData, error } = await supabase.rpc("get_belum_kirim_count", {
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching Belum Kirim count:", error);
        throw error;
      }
      console.log("Belum Kirim (Summary Card):", countData);
      return countData || 0;
    },
    enabled: !!date,
  });


  // Query for Follow Up (tbl_expedisi count where flag = 'NO' and created date is NOT actual current date)
  const { data: followUpFlagNoCount, isLoading: isLoadingFollowUpFlagNoCount, error: followUpFlagNoCountError } = useQuery<number>({
    queryKey: ["followUpFlagNoCount", format(new Date(), 'yyyy-MM-dd')], // Query key based on actual current date
    queryFn: async () => {
      // Always use the actual current date for this specific query
      const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd');
      const { data: countData, error: rpcError } = await supabase.rpc("get_flag_no_except_today_count", {
        p_selected_date: actualCurrentFormattedDate,
      });
      if (rpcError) {
        console.error("Error fetching Follow Up (Flag NO except today):", rpcError);
        throw rpcError;
      }
      console.log("Follow Up (Flag NO except actual today - Summary Card):", countData);
      return countData || 0;
    },
    // This query should always be enabled as it's independent of the dashboard's selected date filter
    enabled: true,
  });


  // Query for Scan Followup (tbl_resi count where schedule = 'late' for selected date)
  const { data: scanFollowupLateCount, isLoading: isLoadingScanFollowupLateCount, error: scanFollowupLateCountError } = useQuery<number>({
    queryKey: ["scanFollowupLateCount", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("schedule", "late")
        .gte("created", startOfDay(date).toISOString()) // Correct for timestamp with time zone
        .lt("created", endOfDay(date).toISOString()); // Correct for timestamp with time zone
      if (error) {
        console.error("Error fetching Scan Followup (Late):", error);
        throw error;
      }
      console.log("Scan Followup (Late - Summary Card):", count);
      return count || 0;
    },
    enabled: !!date,
  });


  // Query for Batal (tbl_resi count where schedule = 'batal' for selected date)
  const { data: batalCount, isLoading: isLoadingBatalCount, error: batalCountError } = useQuery<number>({
    queryKey: ["batalCount", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("schedule", "batal")
        .gte("created", startOfDay(date).toISOString()) // Correct for timestamp with time zone
        .lt("created", endOfDay(date).toISOString()); // Correct for timestamp with time zone
      if (error) {
        console.error("Error fetching Batal Count:", error);
        throw error;
      }
      console.log("Batal Count (Summary Card):", count);
      return count || 0;
    },
    enabled: !!date,
  });


  // Query for Follow Up Data (RPC call)
  const { data: followUpData, isLoading: isLoadingFollowUp, error: followUpDataError } = useQuery<any[]>({
    queryKey: ["followUpData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase.rpc("get_scan_follow_up", {
        selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching Follow Up Data (RPC):", error);
        throw error;
      }
      console.log("Follow Up Data (RPC):", data);
      return data || [];
    },
    enabled: !!date,
  });


  // Fetch tbl_expedisi data for the last 3 days to build a comprehensive resi-to-courier map for local validation
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered, error: allExpedisiDataUnfilteredError } = useQuery<Map<string, any>>({ // Changed type to Map
    queryKey: ["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted], // New query key with 3-day range
    queryFn: async () => {
      // Pass the 3-day range to fetchAllDataPaginated
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", twoDaysAgo, today);
      console.log("All Expedisi Data (unfiltered, paginated, 3-day range):", data.length, "items");
      // Convert array to Map for faster lookups
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true, // Always enabled for local validation
    staleTime: 1000 * 60 * 60, // Changed to 60 minutes
    gcTime: 1000 * 60 * 60 * 24 * 2, // Garbage collect after 2 days
  });


  // NEW: Fetch tbl_expedisi data specifically for the selected date using RPC
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate, error: expedisiDataForSelectedDateError } = useQuery<any[]>({
    queryKey: ["expedisiDataForSelectedDate", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase.rpc("get_transaksi_hari_ini_records", {
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching expedisiDataForSelectedDate via RPC:", error);
        throw error;
      }
      console.log("Expedisi Data for Selected Date (from RPC):", data.length, "items.");
      return data || [];
    },
    enabled: !!date,
  });


  // Fetch tbl_resi data for the selected date range (paginated)
  const { data: allResiData, isLoading: isLoadingAllResi, error: allResiDataError } = useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const data = await fetchAllDataPaginated("tbl_resi", "created", date, date); // Use the new date filtering logic
      console.log("All Resi Data (filtered by selected date, paginated):", data.length, "items");
      return data;
    },
    enabled: !!date,
  });


  // Process data to create expedition summaries
  useEffect(() => {
    if (isLoadingAllExpedisiUnfiltered || isLoadingExpedisiDataForSelectedDate || isLoadingAllResi || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData || !date) {
      setExpeditionSummaries([]);
      return;
    }

    // Build a comprehensive map from all expedisi data (unfiltered)
    const resiToExpeditionMap = new Map<string, string>();
    allExpedisiDataUnfiltered.forEach(exp => {
      const normalizedResino = exp.resino?.trim().toLowerCase();
      if (normalizedResino) {
        resiToExpeditionMap.set(normalizedResino, normalizeExpeditionName(exp.couriername) || "");
      }
    });

    const summaries: { [key: string]: any } = {};

    // Initialize summaries for all unique courier names from tbl_expedisi (unfiltered)
    const uniqueCourierNames = new Set(Array.from(allExpedisiDataUnfiltered.values()).map(e => normalizeExpeditionName(e.couriername)).filter(Boolean));
    KNOWN_EXPEDITIONS.forEach(name => { // Ensure all known expeditions are initialized
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

    // Process expedisiDataForSelectedDate for totalTransaksi and sisa
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

    // Process tbl_resi data (already filtered by selected date)
    allResiData.forEach(resi => {
      const normalizedResi = resi.Resi?.trim().toLowerCase();
      let targetCourierName = null;

      if (normalizedResi) {
        targetCourierName = resiToExpeditionMap.get(normalizedResi);
      }

      if (!targetCourierName) {
        targetCourierName = normalizeExpeditionName(resi.Keterangan);
      }

      if (targetCourierName && summaries[targetCourierName]) {
        if (resi.schedule === "ontime") {
          summaries[targetCourierName].totalScan++;
        }
        if (resi.Keterangan === "ID_REKOMENDASI") { 
          summaries[targetCourierName].idRekomendasi++;
        }
        if (resi.schedule === "batal") { 
          summaries[targetCourierName].totalBatal++;
        }
        if (resi.schedule === "late") { 
          summaries[targetCourierName].totalScanFollowUp++;
        }
        if (resi.nokarung) {
          summaries[targetCourierName].jumlahKarung.add(resi.nokarung);
        }
      } else {
        console.warn(`Resi ${resi.Resi} has no matching courier in summaries or targetCourierName is null/undefined. Keterangan: ${resi.Keterangan}. This resi will not be counted in expedition summaries.`);
      }
    });

    // Convert Set size to number for final jumlahKarung
    const finalSummaries = Object.values(summaries).map(summary => ({
      ...summary,
      jumlahKarung: summary.jumlahKarung.size,
    }));

    setExpeditionSummaries(finalSummaries);
  }, [date, allExpedisiDataUnfiltered, expedisiDataForSelectedDate, allResiData, isLoadingAllExpedisiUnfiltered, isLoadingExpedisiDataForSelectedDate, isLoadingAllResi]);

  // Debounced function to invalidate dashboard queries
  const debouncedInvalidateDashboardQueries = useDebouncedCallback(() => {
    console.log("Debounced invalidation triggered from Realtime!");
    invalidateDashboardQueries(queryClient, new Date(), expedition);
  }, 150); // Debounce for 150ms

  // Real-time subscription for dashboard data
  useEffect(() => {
    const handleRealtimeEvent = (payload: any) => {
      console.log("Realtime event received for Dashboard:", payload);
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
      console.log("Unsubscribing Supabase Realtime channels for Dashboard data.");
      supabase.removeChannel(resiChannel);
      supabase.removeChannel(expedisiChannel);
    };
  }, [debouncedInvalidateDashboardQueries, expedition]); // Added expedition to dependencies

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
    allExpedisiData: allExpedisiDataUnfiltered, // Return the unfiltered data for other uses if needed
    expedisiDataForSelectedDate, // Explicitly returned
    isLoadingExpedisiDataForSelectedDate, // Explicitly returned
    allResiData, // Explicitly returned
    isLoadingAllResi, // Explicitly returned
  };
};