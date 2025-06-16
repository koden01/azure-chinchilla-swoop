import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { useEffect, useState } from "react";

export const useDashboardData = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

  // State to hold expedition summaries
  const [expeditionSummaries, setExpeditionSummaries] = useState<any[]>([]);

  // Query for Transaksi Hari Ini (tbl_expedisi count for selected date)
  const { data: transaksiHariIni, isLoading: isLoadingTransaksiHariIni } = useQuery<number>({
    queryKey: ["transaksiHariIni", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      console.log(`Fetching transaksiHariIni for date: ${formattedDate}`);
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("*", { count: "exact" })
        .eq("created::date", formattedDate); // Correct for timestamp without time zone
      if (error) {
        console.error("Error fetching Transaksi Hari Ini:", error);
        throw error;
      }
      console.log("Transaksi Hari Ini (Summary Card):", count);
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for Total Scan (tbl_resi count where schedule = 'ontime' for selected date)
  const { data: totalScan, isLoading: isLoadingTotalScan } = useQuery<number>({
    queryKey: ["totalScan", formattedDate],
    queryFn: async () => {
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

  // Query for ID Rekomendasi (tbl_resi count where Keterangan = 'ID_REKOMENDASI' for selected date)
  const { data: idRekCount, isLoading: isLoadingIdRekCount } = useQuery<number>({
    queryKey: ["idRekCount", formattedDate],
    queryFn: async () => {
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

  // Query for Belum Kirim (tbl_expedisi count where flag = 'NO' for selected date)
  const { data: belumKirim, isLoading: isLoadingBelumKirim } = useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      console.log(`Fetching belumKirim for date: ${formattedDate}`);
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("*", { count: "exact" })
        .eq("flag", "NO")
        .eq("created::date", formattedDate); // Correct for timestamp without time zone
      if (error) {
        console.error("Error fetching Belum Kirim:", error);
        throw error;
      }
      console.log("Belum Kirim (Summary Card):", count);
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

  // Query for Scan Followup (tbl_resi count where schedule = 'late' for selected date)
  const { data: scanFollowupLateCount, isLoading: isLoadingScanFollowupLateCount } = useQuery<number>({
    queryKey: ["scanFollowupLateCount", formattedDate],
    queryFn: async () => {
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

  // Query for Batal (tbl_resi count where schedule = 'batal' for selected date)
  const { data: batalCount, isLoading: isLoadingBatalCount } = useQuery<number>({
    queryKey: ["batalCount", formattedDate],
    queryFn: async () => {
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

  // Query for Follow Up Data (RPC call)
  const { data: followUpData, isLoading: isLoadingFollowUp } = useQuery<any[]>({
    queryKey: ["followUpData", formattedDate],
    queryFn: async () => {
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

  // Fetch ALL tbl_expedisi data (unfiltered by date) to build a comprehensive resi-to-courier map
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useQuery<any[]>({
    queryKey: ["allExpedisiDataUnfiltered"], // No date in key, fetch all
    queryFn: async () => {
      console.log("Fetching allExpedisiDataUnfiltered.");
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("resino, couriername, flag, created, orderno, chanelsales, datetrans, cekfu");
      if (error) {
        console.error("Error fetching All Expedisi Data (unfiltered):", error);
        throw error;
      }
      console.log("All Expedisi Data (unfiltered):", data);
      return data || [];
    },
    enabled: true, // Always enabled to get all mappings
  });

  // NEW: Fetch tbl_expedisi data specifically for the selected date
  const { data: expedisiDataForSelectedDate, isLoading: isLoadingExpedisiDataForSelectedDate } = useQuery<any[]>({
    queryKey: ["expedisiDataForSelectedDate", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      console.log(`Fetching expedisiDataForSelectedDate for date: ${formattedDate}`);
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("resino, couriername, flag, created, orderno, chanelsales, datetrans, cekfu")
        .eq("created::date", formattedDate); // Correct for timestamp without time zone
      if (error) {
        console.error("Error fetching Expedisi Data for Selected Date (filtered):", error);
        throw error;
      }
      console.log("Expedisi Data for Selected Date (filtered):", data);
      return data || [];
    },
    enabled: !!date,
  });

  // Fetch tbl_resi data for the selected date range
  const { data: allResiData, isLoading: isLoadingAllResi } = useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      console.log(`Fetching allResiData for date: ${formattedDate}`);
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, nokarung, schedule, created, Keterangan")
        .gte("created", startOfDay(date).toISOString()) // Correct for timestamp with time zone
        .lt("created", endOfDay(date).toISOString()); // Correct for timestamp with time zone
      if (error) {
        console.error("Error fetching All Resi Data (filtered by selected date):", error);
        throw error;
      }
      console.log("All Resi Data (filtered by selected date):", data);
      return data || [];
    },
    enabled: !!date,
  });

  // Process data to create expedition summaries
  useEffect(() => {
    console.log("--- useEffect for expeditionSummaries calculation started ---");
    console.log("Dependencies status:");
    console.log(`  isLoadingAllExpedisiUnfiltered: ${isLoadingAllExpedisiUnfiltered}`);
    console.log(`  isLoadingExpedisiDataForSelectedDate: ${isLoadingExpedisiDataForSelectedDate}`);
    console.log(`  isLoadingAllResi: ${isLoadingAllResi}`);
    console.log(`  allExpedisiDataUnfiltered: ${allExpedisiDataUnfiltered ? 'Loaded (' + allExpedisiDataUnfiltered.length + ' items)' : 'Not Loaded'}`);
    console.log(`  expedisiDataForSelectedDate: ${expedisiDataForSelectedDate ? 'Loaded (' + expedisiDataForSelectedDate.length + ' items)' : 'Not Loaded'}`);
    console.log(`  allResiData: ${allResiData ? 'Loaded (' + allResiData.length + ' items)' : 'Not Loaded'}`);
    console.log(`  date: ${date ? date.toISOString() : 'null'}`);


    if (isLoadingAllExpedisiUnfiltered || isLoadingExpedisiDataForSelectedDate || isLoadingAllResi || !allExpedisiDataUnfiltered || !expedisiDataForSelectedDate || !allResiData || !date) {
      setExpeditionSummaries([]);
      console.log("Expedition summaries: Dependencies not ready or date is null. Setting summaries to empty.");
      return;
    }

    console.log("Starting detailed expedition summaries calculation...");
    console.log("allExpedisiDataUnfiltered for resiToExpeditionMap (count):", allExpedisiDataUnfiltered.length);
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
    console.log("Initial summaries structure (keys):", Object.keys(summaries));

    // Process expedisiDataForSelectedDate for totalTransaksi and sisa
    // This data is already filtered by date from Supabase using 'created::date'
    expedisiDataForSelectedDate.forEach(exp => {
      const normalizedCourierName = exp.couriername?.trim().toUpperCase(); // Normalize here

      console.log(`  Processing expedisiDataForSelectedDate record: Resi=${exp.resino}, Courier=${exp.couriername} (Normalized: ${normalizedCourierName}), Created (raw): ${exp.created}`);
      
      if (normalizedCourierName && summaries[normalizedCourierName]) {
        summaries[normalizedCourierName].totalTransaksi++;
        if (exp.flag === "NO") {
          summaries[normalizedCourierName].sisa++;
        }
        console.log(`    -> Matched courier for ${normalizedCourierName}. Current totalTransaksi: ${summaries[normalizedCourierName].totalTransaksi}, sisa: ${summaries[normalizedCourierName].sisa}`);
      } else {
        console.warn(`    -> expedisiDataForSelectedDate: Normalized Courier name '${normalizedCourierName}' not found in summaries or is null for resino: ${exp.resino}. Skipping.`);
      }
    });
    console.log("Summaries after processing expedisiDataForSelectedDate:", summaries);


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
          console.log(`Attributing Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' to ID expedition for summary (not found in tbl_expedisi map).`);
        } else if (normalizedKeterangan && ["JNE", "SPX", "INSTAN", "SICEPAT"].includes(normalizedKeterangan)) {
          targetCourierName = normalizedKeterangan;
          console.log(`Attributing Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' to ${targetCourierName} expedition for summary (not found in tbl_expedisi map).`);
        }
      }

      if (targetCourierName && summaries[targetCourierName]) {
        console.log(`Processing Resi: ${resi.Resi}, Target Courier: ${targetCourierName}, Schedule: ${resi.schedule}, Keterangan: ${resi.Keterangan}, Nokarung: ${resi.nokarung}`); 
        
        if (resi.schedule === "ontime") {
          summaries[targetCourierName].totalScan++;
        }
        // Count ID Rekomendasi based on Keterangan
        if (resi.Keterangan === "ID_REKOMENDASI") { // Keterangan itself is "ID_REKOMENDASI", no need to normalize here
          summaries[targetCourierName].idRekomendasi++;
          console.log(`Incremented ID Rekomendasi for ${targetCourierName}. Current: ${summaries[targetCourierName].idRekomendasi}`); 
        }
        if (resi.schedule === "batal") { 
          summaries[targetCourierName].totalBatal++;
        }
        if (resi.schedule === "late") { 
          summaries[targetCourierName].totalScanFollowUp++;
          console.log(`Incremented Scan Follow Up for ${targetCourierName}. Current: ${summaries[targetCourierName].totalScanFollowUp}`); 
        }
        if (resi.nokarung) {
          summaries[targetCourierName].jumlahKarung.add(resi.nokarung);
        }
      } else {
        console.warn(`Resi ${resi.Resi} has no matching courier in summaries or targetCourierName is null/undefined. Keterangan: ${resi.Keterangan}`);
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
  };
};