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
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("*", { count: "exact" })
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("Transaksi Hari Ini:", count);
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
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("Total Scan:", count);
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
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("ID Rekomendasi:", count);
      return count || 0;
    },
    enabled: !!date,
  });

  // Query for Belum Kirim (tbl_expedisi count where flag = 'NO' for selected date)
  const { data: belumKirim, isLoading: isLoadingBelumKirim } = useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("*", { count: "exact" })
        .eq("flag", "NO")
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("Belum Kirim:", count);
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
      if (rpcError) throw rpcError;
      console.log("Follow Up (Flag NO except actual today):", countData);
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
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("Scan Followup (Late):", count);
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
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("Batal Count:", count);
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
      if (error) throw error;
      console.log("Follow Up Data (RPC):", data);
      return data || [];
    },
    enabled: !!date,
  });

  // NEW: Fetch all tbl_expedisi data (without date filter)
  const { data: allExpedisiData, isLoading: isLoadingAllExpedisi } = useQuery<any[]>({
    queryKey: ["allExpedisiData"], // Removed formattedDate from queryKey
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("resino, couriername, flag, created, orderno, chanelsales, datetrans, cekfu");
      if (error) throw error;
      console.log("All Expedisi Data (unfiltered):", data);
      return data || [];
    },
    enabled: true, // Always enabled to get all mappings
  });

  // NEW: Fetch all tbl_resi data for the selected date range
  const { data: allResiData, isLoading: isLoadingAllResi } = useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, nokarung, schedule, created, Keterangan")
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("All Resi Data (filtered by selected date):", data);
      return data || [];
    },
    enabled: !!date,
  });

  // Process data to create expedition summaries
  useEffect(() => {
    if (isLoadingAllExpedisi || isLoadingAllResi || !allExpedisiData || !allResiData || !date) {
      setExpeditionSummaries([]);
      return;
    }

    console.log("Starting expedition summaries calculation...");
    console.log("allExpedisiData for summary (full set):", allExpedisiData);
    console.log("allResiData for summary (filtered by selected date):", allResiData);

    // Format the selected date to a 'yyyy-MM-dd' string for direct comparison
    const selectedDateFormatted = format(date, "yyyy-MM-dd");
    console.log("Selected Date Formatted (for comparison):", selectedDateFormatted);

    // Build a comprehensive map from all expedisi data
    const resiToExpeditionMap = new Map<string, string>();
    allExpedisiData.forEach(exp => {
      resiToExpeditionMap.set(exp.resino, exp.couriername);
    });
    console.log("resiToExpeditionMap (comprehensive):", resiToExpeditionMap);

    const summaries: { [key: string]: any } = {};

    // Initialize summaries for all unique courier names from tbl_expedisi
    const uniqueCourierNames = new Set(allExpedisiData.map(e => e.couriername).filter(Boolean));
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
    console.log("Initial summaries structure:", summaries);

    // Process tbl_expedisi data for totalTransaksi and sisa (filtered by selected date string)
    allExpedisiData.forEach(exp => {
      // Format the 'created' date from tbl_expedisi to a 'yyyy-MM-dd' string
      // Assuming exp.created is a string like 'YYYY-MM-DD HH:MM:SS'
      const expCreatedDateFormatted = format(new Date(exp.created), "yyyy-MM-dd");
      console.log(`Expedisi Resi: ${exp.resino}, Created Date: ${exp.created}, Formatted: ${expCreatedDateFormatted}`);

      if (expCreatedDateFormatted === selectedDateFormatted) { // Compare date strings
        const courierName = exp.couriername;
        if (courierName && summaries[courierName]) {
          summaries[courierName].totalTransaksi++;
          if (exp.flag === "NO") {
            summaries[courierName].sisa++;
          }
        }
      }
    });
    console.log("Summaries after processing tbl_expedisi (date-filtered by string):", summaries);


    // Process tbl_resi data (already filtered by selected date)
    allResiData.forEach(resi => {
      // Determine the target courier name for this resi
      let targetCourierName = resiToExpeditionMap.get(resi.Resi);

      // If resi not found in tbl_expedisi map, but Keterangan is 'ID' or 'ID_REKOMENDASI',
      // attribute it to 'ID' expedition. This handles cases where tbl_resi exists
      // but no corresponding tbl_expedisi entry (e.g., direct ID scans).
      if (!targetCourierName && (resi.Keterangan === "ID" || resi.Keterangan === "ID_REKOMENDASI")) {
        targetCourierName = "ID";
        console.log(`Attributing Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' to ID expedition for summary (not found in tbl_expedisi map).`);
      } else if (!targetCourierName && resi.Keterangan && ["JNE", "SPX", "INSTAN", "SICEPAT"].includes(resi.Keterangan)) {
        // Also handle other couriers if they exist in tbl_resi but not in tbl_expedisi map
        targetCourierName = resi.Keterangan;
        console.log(`Attributing Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' to ${targetCourierName} expedition for summary (not found in tbl_expedisi map).`);
      }


      if (targetCourierName && summaries[targetCourierName]) {
        console.log(`Processing Resi: ${resi.Resi}, Target Courier: ${targetCourierName}, Schedule: ${resi.schedule}, Keterangan: ${resi.Keterangan}, Nokarung: ${resi.nokarung}`); 
        
        if (resi.schedule === "ontime") {
          summaries[targetCourierName].totalScan++;
        }
        // Count ID Rekomendasi based on Keterangan
        if (resi.Keterangan === "ID_REKOMENDASI") {
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
  }, [date, allExpedisiData, allResiData, isLoadingAllExpedisi, isLoadingAllResi]);


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
    allExpedisiData, 
  };
};