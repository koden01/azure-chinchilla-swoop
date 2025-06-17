import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation"; // Import the invalidation utility

export const useDashboardData = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const queryClient = useQueryClient(); // Get query client instance

  // State to hold expedition summaries
  const [expeditionSummaries, setExpeditionSummaries] = useState<any[]>([]);

  // Helper to format date for timestamp without time zone (tbl_expedisi)
  const getExpedisiDateRange = (selectedDate: Date) => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    // Format to 'YYYY-MM-DD HH:mm:ss' for timestamp without time zone comparison
    const startString = format(start, "yyyy-MM-dd HH:mm:ss");
    const endString = format(end, "yyyy-MM-dd HH:mm:ss");
    return { startString, endString };
  };

  // Query for Transaksi Hari Ini (tbl_expedisi count for selected date)
  const { data: transaksiHariIni, isLoading: isLoadingTransaksiHariIni } = useQuery<number>({
    queryKey: ["transaksiHariIni", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { startString, endString } = getExpedisiDateRange(date);
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("*", { count: "exact" })
        .gte("created", startString)
        .lt("created", endString); // Use lt for end of day to include all seconds up to 23:59:59
      if (error) {
        console.error("Error fetching Transaksi Hari Ini:", error.message);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for Total Scan (tbl_resi count where schedule = 'ontime' for selected date)
  const { data: totalScan, isLoading: isLoadingTotalScan } = useQuery<number>({
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
        console.error("Error fetching Total Scan:", error.message);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for ID Rekomendasi (tbl_resi count where Keterangan = 'ID_REKOMENDASI' for selected date)
  const { data: idRekCount, isLoading: isLoadingIdRekCount } = useQuery<number>({
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
        console.error("Error fetching ID Rekomendasi:", error.message);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for Belum Kirim (tbl_expedisi count where flag = 'NO' for selected date)
  const { data: belumKirim, isLoading: isLoadingBelumKirim } = useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { startString, endString } = getExpedisiDateRange(date);
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("*", { count: "exact" })
        .eq("flag", "NO")
        .gte("created", startString)
        .lt("created", endString);
      if (error) {
        console.error("Error fetching Belum Kirim:", error.message);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for Follow Up (tbl_expedisi count where flag = 'NO' and created date is NOT actual current date)
  const { data: followUpFlagNoCount, isLoading: isLoadingFollowUpFlagNoCount } = useQuery<number>({
    queryKey: ["followUpFlagNoCount", format(new Date(), 'yyyy-MM-dd')], // Query key based on actual current date
    queryFn: async () => {
      // Always use the actual current date for this specific query
      const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd');
      const { data: countData, error: rpcError } = await supabase.rpc("get_flag_no_except_today_count", {
        p_selected_date: actualCurrentFormattedDate,
      });
      if (rpcError) {
        console.error("Error fetching Follow Up (Flag NO except today):", rpcError.message);
        throw rpcError;
      }
      return countData || 0;
    },
    // This query should always be enabled as it's independent of the dashboard's selected date filter
    enabled: true,
  });

  // Query for Scan Followup (tbl_resi count where schedule = 'late' for selected date)
  const { data: scanFollowupLateCount, isLoading: isLoadingScanFollowupLateCount } = useQuery<number>({
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
        console.error("Error fetching Scan Followup (Late):", error.message);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for Batal (tbl_resi count where schedule = 'batal' for selected date)
  const { data: batalCount, isLoading: isLoadingBatalCount } = useQuery<number>({
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
        console.error("Error fetching Batal Count:", error.message);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for Follow Up Data (RPC call)
  const { data: followUpData, isLoading: isLoadingFollowUp } = useQuery<any[]>({
    queryKey: ["followUpData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase.rpc("get_scan_follow_up", {
        selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching Follow Up Data (RPC):", error.message);
        throw error;
      }
      return data || [];
    },
    enabled: !!date,
  });

  // Function to fetch all data from a table with pagination
  const fetchAllDataPaginated = async (tableName: string, dateFilterColumn?: string, startDate?: string, endDate?: string) => {
    let allRecords: any[] = [];
    let offset = 0;
    const limit = 1000; // Fetch 1000 records at a time
    let hasMore = true;

    while (hasMore) {
      let query = supabase.from(tableName).select("*").range(offset, offset + limit - 1);

      if (dateFilterColumn && startDate && endDate) {
        query = query.gte(dateFilterColumn, startDate).lt(dateFilterColumn, endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching paginated data from ${tableName}:`, error.message);
        throw error;
      }

      if (data && data.length > 0) {
        allRecords = allRecords.concat(data);
        offset += data.length;
        hasMore = data.length === limit; // If less than limit, no more data
      } else {
        hasMore = false;
      }
    }
    return allRecords;
  };

  // Fetch ALL tbl_expedisi data (unfiltered by date) to build a comprehensive resi-to-courier map
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useQuery<any[]>({
    queryKey: ["allExpedisiDataUnfiltered"], // No date in key, fetch all
    queryFn: async () => {
      const data = await fetchAllDataPaginated("tbl_expedisi");
      return data;
    },
    enabled: true, // Always enabled to get all mappings
  });

  // NEW: Fetch tbl_expedisi data specifically for the selected date (paginated)
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useQuery<any[]>({
    queryKey: ["expedisiDataForSelectedDate", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { startString, endString } = getExpedisiDateRange(date);
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", startString, endString);
      return data;
    },
    enabled: !!date,
  });

  // Fetch tbl_resi data for the selected date range (paginated)
  const { data: allResiData, isLoading: isLoadingAllResi } = useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const data = await fetchAllDataPaginated("tbl_resi", "created", startOfDay(date).toISOString(), endOfDay(date).toISOString());
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
      // Normalize resino for map key: trim spaces and convert to lowercase
      const normalizedResino = exp.resino?.trim().toLowerCase();
      if (normalizedResino) {
        resiToExpeditionMap.set(normalizedResino, exp.couriername?.trim().toUpperCase() || ""); // Normalize couriername here too
      }
    });

    const summaries: { [key: string]: any } = {};

    // Initialize summaries for all unique courier names from tbl_expedisi (unfiltered)
    const uniqueCourierNames = new Set(allExpedisiDataUnfiltered.map(e => e.couriername?.trim().toUpperCase()).filter(Boolean));
    uniqueCourierNames.add("ID"); // Ensure 'ID' is always initialized
    uniqueCourierNames.forEach(name => {
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
    // This data is already filtered by date from Supabase using 'created::date'
    expedisiDataForSelectedDate.forEach(exp => {
      const normalizedCourierName = exp.couriername?.trim().toUpperCase(); // Normalize here
      
      if (normalizedCourierName && summaries[normalizedCourierName]) {
        summaries[normalizedCourierName].totalTransaksi++;
        if (exp.flag === "NO") {
          summaries[normalizedCourierName].sisa++;
        }
      } else {
        // console.warn(`expedisiDataForSelectedDate: Normalized Courier name '${normalizedCourierName}' not found in summaries or is null/empty for resino: ${exp.resino}. This record will not be counted in expedition summaries.`); // Removed
      }
    });

    // Process tbl_resi data (already filtered by selected date)
    allResiData.forEach(resi => {
      // Normalize resi.Resi for lookup: trim spaces and convert to lowercase
      const normalizedResi = resi.Resi?.trim().toLowerCase();
      let targetCourierName = null;

      // First, try to get from the comprehensive map
      if (normalizedResi) {
        targetCourierName = resiToExpeditionMap.get(normalizedResi);
      }

      // Fallback for ID or other couriers if not found in map but Keterangan matches
      if (!targetCourierName) {
        const normalizedKeterangan = resi.Keterangan?.trim().toUpperCase();
        if (normalizedKeterangan === "ID" || normalizedKeterangan === "ID_REKOMENDASI") {
          targetCourierName = "ID";
        } else if (normalizedKeterangan && ["JNE", "SPX", "INSTAN", "SICEPAT"].includes(normalizedKeterangan)) {
          targetCourierName = normalizedKeterangan;
        }
      }

      if (targetCourierName && summaries[targetCourierName]) {
        if (resi.schedule === "ontime") {
          summaries[targetCourierName].totalScan++;
        }
        // Count ID Rekomendasi based on Keterangan
        if (resi.Keterangan === "ID_REKOMENDASI") { // Keterangan itself is "ID_REKOMENDASI", no need to normalize here
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
        // console.warn(`Resi ${resi.Resi} has no matching courier in summaries or targetCourierName is null/undefined. Keterangan: ${resi.Keterangan}`); // Removed
      }
    });

    // Convert Set size to number for final jumlahKarung
    const finalSummaries = Object.values(summaries).map(summary => ({
      ...summary,
      jumlahKarung: summary.jumlahKarung.size,
    }));

    setExpeditionSummaries(finalSummaries);
  }, [date, allExpedisiDataUnfiltered, expedisiDataForSelectedDate, allResiData, isLoadingAllExpedisiUnfiltered, isLoadingExpedisiDataForSelectedDate, isLoadingAllResi]);

  // Real-time subscription for dashboard data
  useEffect(() => {
    const handleRealtimeEvent = (payload: any) => {
      invalidateDashboardQueries(queryClient, date);
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
  }, [queryClient, date]); // Re-subscribe if date changes

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
  };
};