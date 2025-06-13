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

  // Query for ID Rekomendasi (tbl_resi count where schedule = 'idrek' for selected date)
  const { data: idRekCount, isLoading: isLoadingIdRekCount } = useQuery<number>({
    queryKey: ["idRekCount", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("schedule", "idrek")
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

  // NEW: Fetch all tbl_expedisi data for the selected date range with all necessary columns
  const { data: allExpedisiData, isLoading: isLoadingAllExpedisi } = useQuery<any[]>({
    queryKey: ["allExpedisiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("resino, couriername, flag, created, orderno, chanelsales, datetrans, cekfu") // Added orderno, chanelsales, datetrans, cekfu
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("All Expedisi Data:", data);
      return data || [];
    },
    enabled: !!date,
  });

  // NEW: Fetch all tbl_resi data for the selected date range
  const { data: allResiData, isLoading: isLoadingAllResi } = useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, nokarung, schedule, created")
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) throw error;
      console.log("All Resi Data:", data);
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

    const startOfSelectedDay = startOfDay(date).getTime();
    const endOfSelectedDay = endOfDay(date).getTime();

    const resiToExpeditionMap = new Map<string, string>(); // Map Resi to Couriername
    allExpedisiData.forEach(exp => {
      resiToExpeditionMap.set(exp.resino, exp.couriername);
    });

    const summaries: { [key: string]: any } = {};

    // Initialize summaries for all unique courier names from tbl_expedisi
    const uniqueCourierNames = new Set(allExpedisiData.map(e => e.couriername).filter(Boolean));
    uniqueCourierNames.forEach(name => {
      summaries[name] = {
        name,
        totalTransaksi: 0,
        totalScan: 0,
        sisa: 0,
        jumlahKarung: new Set<string>(), // Use a Set to count unique karung numbers
        idRekomendasi: 0,
        totalBatal: 0, // Initialize new field
        totalScanFollowUp: 0, // Initialize new field
      };
    });

    // Process tbl_expedisi data
    allExpedisiData.forEach(exp => {
      const createdDate = new Date(exp.created).getTime();
      if (createdDate >= startOfSelectedDay && createdDate <= endOfSelectedDay) {
        const courierName = exp.couriername;
        if (courierName && summaries[courierName]) {
          summaries[courierName].totalTransaksi++;
          if (exp.flag === "NO") {
            summaries[courierName].sisa++;
          }
        }
      }
    });

    // Process tbl_resi data
    allResiData.forEach(resi => {
      const createdDate = new Date(resi.created).getTime();
      if (createdDate >= startOfSelectedDay && createdDate <= endOfSelectedDay) {
        const courierName = resiToExpeditionMap.get(resi.Resi);
        if (courierName && summaries[courierName]) {
          if (resi.schedule === "ontime") {
            summaries[courierName].totalScan++;
          }
          if (resi.schedule === "idrek") {
            summaries[courierName].idRekomendasi++;
          }
          if (resi.schedule === "batal") { // Count 'batal'
            summaries[courierName].totalBatal++;
          }
          if (resi.schedule === "late") { // Count 'late' for scan follow up
            summaries[courierName].totalScanFollowUp++;
          }
          if (resi.nokarung) {
            // Add nokarung to the Set for unique counting
            summaries[courierName].jumlahKarung.add(resi.nokarung);
          }
        }
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


  return {
    transaksiHariIni,
    isLoadingTransaksiHariIni,
    totalScan,
    isLoadingTotalScan,
    idRekCount, // Renamed for clarity
    isLoadingIdRekCount,
    belumKirim,
    isLoadingBelumKirim,
    followUpFlagNoCount, // New
    isLoadingFollowUpFlagNoCount, // New
    scanFollowupLateCount, // New
    isLoadingScanFollowupLateCount, // New
    batalCount,
    isLoadingBatalCount,
    followUpData,
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate,
    allExpedisiData, // Return allExpedisiData
  };
};