import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useEffect, useState } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

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
      console.log("QueryFn: transaksiHariIni");
      if (!date) return 0;
      console.log(`Fetching transaksiHariIni count for date: ${formattedDate} using RPC.`);
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
  // console.log("useDashboardData: Transaksi Hari Ini - isLoading:", isLoadingTransaksiHariIni, "data:", transaksiHariIni, "error:", transaksiHariIniError);


  // Query for Total Scan (tbl_resi count where schedule = 'ontime' for selected date)
  const { data: totalScan, isLoading: isLoadingTotalScan, error: totalScanError } = useQuery<number>({
    queryKey: ["totalScan", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: totalScan");
      if (!date) return 0;
      console.log(`Fetching totalScan for date: ${formattedDate}`);
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
  // console.log("useDashboardData: Total Scan - isLoading:", isLoadingTotalScan, "data:", totalScan, "error:", totalScanError);


  // Query for ID Rekomendasi (tbl_resi count where Keterangan = 'ID_REKOMENDASI' for selected date)
  const { data: idRekCount, isLoading: isLoadingIdRekCount, error: idRekCountError } = useQuery<number>({
    queryKey: ["idRekCount", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: idRekCount");
      if (!date) return 0;
      console.log(`Fetching idRekCount for date: ${formattedDate}`);
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
  // console.log("useDashboardData: ID Rekomendasi - isLoading:", isLoadingIdRekCount, "data:", idRekCount, "error:", idRekCountError);


  // Query for Belum Kirim (tbl_expedisi count where flag = 'NO' for selected date) using RPC
  const { data: belumKirim, isLoading: isLoadingBelumKirim, error: belumKirimError } = useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: belumKirim");
      if (!date) return 0;
      console.log(`Fetching belumKirim count for date: ${formattedDate} using RPC.`);
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
  // console.log("useDashboardData: Belum Kirim - isLoading:", isLoadingBelumKirim, "data:", belumKirim, "error:", belumKirimError);


  // Query for Follow Up (tbl_expedisi count where flag = 'NO' and created date is NOT actual current date)
  const { data: followUpFlagNoCount, isLoading: isLoadingFollowUpFlagNoCount, error: followUpFlagNoCountError } = useQuery<number>({
    queryKey: ["followUpFlagNoCount", format(new Date(), 'yyyy-MM-dd')], // Query key based on actual current date
    queryFn: async () => {
      console.log("QueryFn: followUpFlagNoCount");
      // Always use the actual current date for this specific query
      const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd');
      console.log(`Fetching followUpFlagNoCount for actual current date: ${actualCurrentFormattedDate}`);
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
  // console.log("useDashboardData: Follow Up Flag No Count - isLoading:", isLoadingFollowUpFlagNoCount, "data:", followUpFlagNoCount, "error:", followUpFlagNoCountError);


  // Query for Scan Followup (tbl_resi count where schedule = 'late' for selected date)
  const { data: scanFollowupLateCount, isLoading: isLoadingScanFollowupLateCount, error: scanFollowupLateCountError } = useQuery<number>({
    queryKey: ["scanFollowupLateCount", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: scanFollowupLateCount");
      if (!date) return 0;
      console.log(`Fetching scanFollowupLateCount for date: ${formattedDate}`);
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
  // console.log("useDashboardData: Scan Followup Late Count - isLoading:", isLoadingScanFollowupLateCount, "data:", scanFollowupLateCount, "error:", scanFollowupLateCountError);


  // Query for Batal (tbl_resi count where schedule = 'batal' for selected date)
  const { data: batalCount, isLoading: isLoadingBatalCount, error: batalCountError } = useQuery<number>({
    queryKey: ["batalCount", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: batalCount");
      if (!date) return 0;
      console.log(`Fetching batalCount for date: ${formattedDate}`);
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
  // console.log("useDashboardData: Batal Count - isLoading:", isLoadingBatalCount, "data:", batalCount, "error:", batalCountError);


  // Query for Follow Up Data (RPC call)
  const { data: followUpData, isLoading: isLoadingFollowUp, error: followUpDataError } = useQuery<any[]>({
    queryKey: ["followUpData", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: followUpData");
      if (!date) return [];
      console.log(`Fetching followUpData for date: ${formattedDate}`);
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
  // console.log("useDashboardData: Follow Up Data - isLoading:", isLoadingFollowUp, "data length:", followUpData?.length, "error:", followUpDataError);


  // Fetch tbl_expedisi data for the last 3 days to build a comprehensive resi-to-courier map for local validation
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered, error: allExpedisiDataUnfilteredError } = useQuery<Map<string, any>>({ // Changed type to Map
    queryKey: ["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted], // New query key with 3-day range
    queryFn: async () => {
      console.log("QueryFn: allExpedisiDataUnfiltered");
      console.log(`Fetching allExpedisiDataUnfiltered (paginated) for last 3 days: ${twoDaysAgoFormatted} to ${endOfTodayFormatted} using fetchAllDataPaginated.`);
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
  // console.log("useDashboardData: All Expedisi Data Unfiltered - isLoading:", isLoadingAllExpedisiUnfiltered, "data size:", allExpedisiDataUnfiltered?.size, "error:", allExpedisiDataUnfilteredError);


  // NEW: Fetch tbl_expedisi data specifically for the selected date using RPC
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate, error: expedisiDataForSelectedDateError } = useQuery<any[]>({
    queryKey: ["expedisiDataForSelectedDate", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: expedisiDataForSelectedDate");
      if (!date) return [];
      console.log(`RPC Call: get_transaksi_hari_ini_records for date: ${formattedDate}`);
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
  // console.log("useDashboardData: Expedisi Data For Selected Date - isLoading:", isLoadingExpedisiDataForSelectedDate, "data length:", expedisiDataForSelectedDate?.length, "error:", expedisiDataForSelectedDateError);


  // Fetch tbl_resi data for the selected date range (paginated)
  const { data: allResiData, isLoading: isLoadingAllResi, error: allResiDataError } = useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      console.log("QueryFn: allResiData");
      if (!date) return [];
      console.log(`Fetching allResiData for date (paginated): ${formattedDate} using fetchAllDataPaginated.`);
      const data = await fetchAllDataPaginated("tbl_resi", "created", date, date); // Use the new date filtering logic
      console.log("All Resi Data (filtered by selected date, paginated):", data.length, "items");
      return data;
    },
    enabled: !!date,
  });
  // console.log("useDashboardData: All Resi Data - isLoading:", isLoadingAllResi, "data length:", allResiData?.length, "error:", allResiDataError);


  // Process data to create expedition summaries
  useEffect(() => {
    console.log("--- useEffect for expeditionSummaries calculation started ---");
    console.log("Dependencies status:");
    console.log(`  isLoadingAllExpedisiUnfiltered: ${isLoadingAllExpedisiUnfiltered}`);
    console.log(`  isLoadingExpedisiDataForSelectedDate: ${isLoadingExpedisiDataForSelectedDate}`);
    console.log(`  isLoadingAllResi: ${isLoadingAllResi}`);
    console.log(`  allExpedisiDataUnfiltered: ${allExpedisiDataUnfiltered ? 'Loaded (' + allExpedisiDataUnfiltered.size + ' items)' : 'Not Loaded'}`); // Changed .length to .size
    console.log(`  expedisiDataForSelectedDate: ${expedisiDataForSelectedDate ? 'Loaded (' + expedisiDataForSelectedDate.length + ' items)' : 'Not Loaded'}`);
    console.log(`  allResiData: ${allResiData ? 'Loaded (' + allResiData.length + ' items)' : 'Not Loaded'}`);
    console.log(`  date: ${date ? date.toISOString() : 'null'}`);


    if (isLoadingAllExpedisiUnfiltered || isLoadingExpedisiDataForSelectedDate || isLoadingAllResi || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData || !date) {
      setExpeditionSummaries([]);
      console.log("Expedition summaries: Dependencies not ready or date is null. Setting summaries to empty.");
      return;
    }

    console.log("Starting detailed expedition summaries calculation...");
    console.log("allExpedisiDataUnfiltered for resiToExpeditionMap (size):", allExpedisiDataUnfiltered.size); // Changed .length to .size
    console.log("expedisiDataForSelectedDate for totalTransaksi/sisa (count):", expedisiDataForSelectedDate.length);
    console.log("allResiData for other counts (count, already date-filtered):", allResiData.length);

    // Build a comprehensive map from all expedisi data (unfiltered)
    const resiToExpeditionMap = new Map<string, string>();
    allExpedisiDataUnfiltered.forEach(exp => {
      // Normalize resino for map key: trim spaces and convert to lowercase
      const normalizedResino = exp.resino?.trim().toLowerCase();
      if (normalizedResino) {
        resiToExpeditionMap.set(normalizedResino, exp.couriername?.trim().toUpperCase() || ""); // Normalize couriername here too
      }
    });
    console.log("resiToExpeditionMap (comprehensive, size):", resiToExpeditionMap.size);

    const summaries: { [key: string]: any } = {};

    // Initialize summaries for all unique courier names from tbl_expedisi (unfiltered)
    // Corrected: Use Array.from(allExpedisiDataUnfiltered.values()) to iterate over Map values
    const uniqueCourierNames = new Set(Array.from(allExpedisiDataUnfiltered.values()).map(e => e.couriername?.trim().toUpperCase()).filter(Boolean));
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
    console.log("Initial summaries structure (keys):", Object.keys(summaries));

    // --- START: Debugging for discrepancy ---
    const uncountedExpedisiRecords: any[] = [];
    // --- END: Debugging for discrepancy ---

    // Process expedisiDataForSelectedDate for totalTransaksi and sisa
    // This data is already filtered by date from Supabase using 'created::date'
    expedisiDataForSelectedDate.forEach(exp => {
      const normalizedCourierName = exp.couriername?.trim().toUpperCase(); // Normalize here

      // console.log(`  Processing expedisiDataForSelectedDate record: Resi=${exp.resino}, Courier (raw)=${exp.couriername} (Normalized: ${normalizedCourierName}), Created (raw): ${exp.created}`); // REMOVED
      
      if (normalizedCourierName && summaries[normalizedCourierName]) {
        summaries[normalizedCourierName].totalTransaksi++;
        if (exp.flag === "NO") {
          summaries[normalizedCourierName].sisa++;
        }
        // console.log(`    -> Matched courier for ${normalizedCourierName}. Current totalTransaksi: ${summaries[normalizedCourierName].totalTransaksi}, sisa: ${summaries[normalizedCourierName].sisa}`); // REMOVED
      } else {
        console.warn(`    -> expedisiDataForSelectedDate: Normalized Courier name '${normalizedCourierName}' not found in summaries or is null/empty for resino: ${exp.resino}. This record will not be counted in expedition summaries.`);
        uncountedExpedisiRecords.push(exp); // Add to uncounted list
      }
    });
    console.log("Summaries after processing expedisiDataForSelectedDate:", summaries);
    console.log("Uncounted expedisi records (due to missing/unrecognized couriername):", uncountedExpedisiRecords);


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
        // *** PERBAIKAN DI SINI: Tambahkan 'JNT' ke daftar ekspedisi yang dikenali ***
        if (normalizedKeterangan === "ID" || normalizedKeterangan === "ID_REKOMENDASI") {
          targetCourierName = "ID";
          // console.log(`  [Resi Attr] Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' attributed to ID expedition (not found in tbl_expedisi map).`); // REMOVED
        } else if (normalizedKeterangan && ["JNE", "SPX", "INSTAN", "SICEPAT", "JNT"].includes(normalizedKeterangan)) { // Added JNT
          targetCourierName = normalizedKeterangan;
          // console.log(`  [Resi Attr] Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' attributed to ${targetCourierName} expedition (not found in tbl_expedisi map).`); // REMOVED
        } else {
          console.warn(`  [Resi Attr] Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' could not be attributed to any known expedition. Skipping.`);
        }
      } else {
        // console.log(`  [Resi Attr] Resi ${resi.Resi} attributed to ${targetCourierName} expedition (found in tbl_expedisi map).`); // REMOVED
      }

      if (targetCourierName && summaries[targetCourierName]) {
        // console.log(`  Processing Resi: ${resi.Resi}, Target Courier: ${targetCourierName}, Schedule: ${resi.schedule}, Keterangan: ${resi.Keterangan}, Nokarung: ${resi.nokarung}`); // REMOVED
        
        if (resi.schedule === "ontime") {
          summaries[targetCourierName].totalScan++;
          // console.log(`    -> Incremented totalScan for ${targetCourierName}. Current: ${summaries[targetCourierName].totalScan}`); // REMOVED
        }
        // Count ID Rekomendasi based on Keterangan
        if (resi.Keterangan === "ID_REKOMENDASI") { // Keterangan itself is "ID_REKOMENDASI", no need to normalize here
          summaries[targetCourierName].idRekomendasi++;
          // console.log(`    -> Incremented ID Rekomendasi for ${targetCourierName}. Current: ${summaries[targetCourierName].idRekomendasi}`); // REMOVED
        }
        if (resi.schedule === "batal") { 
          summaries[targetCourierName].totalBatal++;
          // console.log(`    -> Incremented totalBatal for ${targetCourierName}. Current: ${summaries[targetCourierName].totalBatal}`); // REMOVED
        }
        if (resi.schedule === "late") { 
          summaries[targetCourierName].totalScanFollowUp++;
          // console.log(`    -> Incremented Scan Follow Up for ${targetCourierName}. Current: ${summaries[targetCourierName].totalScanFollowUp}`); // REMOVED
        }
        if (resi.nokarung) {
          summaries[targetCourierName].jumlahKarung.add(resi.nokarung);
          // console.log(`    -> Added karung ${resi.nokarung} to ${targetCourierName}. Current unique karungs: ${summaries[targetCourierName].jumlahKarung.size}`); // REMOVED
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
    console.log("Final Expedition Summaries:", finalSummaries);
    console.log("--- useEffect for expeditionSummaries calculation finished ---");
  }, [date, allExpedisiDataUnfiltered, expedisiDataForSelectedDate, allResiData, isLoadingAllExpedisiUnfiltered, isLoadingExpedisiDataForSelectedDate, isLoadingAllResi]);

  // Debounced function to invalidate dashboard queries
  const debouncedInvalidateDashboardQueries = useDebouncedCallback(() => {
    console.log("Debounced invalidation triggered from Realtime!");
    invalidateDashboardQueries(queryClient, new Date(), expedition);
  }, 150); // Debounce for 150ms

  // Real-time subscription for dashboard data
  useEffect(() => {
    console.log("Setting up Supabase Realtime subscription for Dashboard data...");

    const handleRealtimeEvent = (payload: any) => {
      console.log("Realtime event received for Dashboard:", payload);
      // Call the debounced invalidation function
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
  }, [debouncedInvalidateDashboardQueries]);

  console.log("useDashboardData returning expeditionSummaries:", expeditionSummaries); // Debug log

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