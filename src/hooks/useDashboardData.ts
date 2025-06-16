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

  // Fetch ALL tbl_expedisi data (unfiltered by date) to build a comprehensive resi-to-courier map
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useQuery<any[]>({
    queryKey: ["allExpedisiDataUnfiltered"], // No date in key, fetch all
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

  // Fetch tbl_resi data for the selected date range
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
    console.log("--- useEffect for expeditionSummaries calculation started ---");
    console.log("Dependencies status:");
    console.log(`  isLoadingAllExpedisiUnfiltered: ${isLoadingAllExpedisiUnfiltered}`);
    console.log(`  isLoadingAllResi: ${isLoadingAllResi}`);
    console.log(`  allExpedisiDataUnfiltered: ${allExpedisiDataUnfiltered ? 'Loaded (' + allExpedisiDataUnfiltered.length + ' items)' : 'Not Loaded'}`);
    console.log(`  allResiData: ${allResiData ? 'Loaded (' + allResiData.length + ' items)' : 'Not Loaded'}`);
    console.log(`  date: ${date ? date.toISOString() : 'null'}`);


    if (isLoadingAllExpedisiUnfiltered || isLoadingAllResi || !allExpedisiDataUnfiltered || !allResiData || !date) {
      setExpeditionSummaries([]);
      console.log("Expedition summaries: Dependencies not ready or date is null. Setting summaries to empty.");
      return;
    }

    console.log("Starting detailed expedition summaries calculation...");
    console.log("allExpedisiDataUnfiltered for summary (count):", allExpedisiDataUnfiltered.length);
    console.log("allResiData for summary (count, already date-filtered):", allResiData.length);

    // Build a comprehensive map from all expedisi data (unfiltered)
    const resiToExpeditionMap = new Map<string, string>();
    allExpedisiDataUnfiltered.forEach(exp => {
      // Normalize resino for map key: trim spaces and convert to lowercase
      const normalizedResino = exp.resino?.trim().toLowerCase();
      if (normalizedResino) {
        resiToExpeditionMap.set(normalizedResino, exp.couriername);
      }
    });
    console.log("resiToExpeditionMap (comprehensive, size):", resiToExpeditionMap.size);
    // console.log("resiToExpeditionMap content (first 5):", Array.from(resiToExpeditionMap.entries()).slice(0, 5)); // Too verbose, enable if needed

    const summaries: { [key: string]: any } = {};

    // Initialize summaries for all unique courier names from tbl_expedisi (unfiltered)
    const uniqueCourierNames = new Set(allExpedisiDataUnfiltered.map(e => e.couriername).filter(Boolean));
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

    // Process tbl_expedisi data for totalTransaksi and sisa (apply date filter client-side here)
    const startOfSelectedDay = startOfDay(date).getTime();
    const endOfSelectedDay = endOfDay(date).getTime();
    console.log(`Selected Date Range (timestamps): ${startOfSelectedDay} - ${endOfSelectedDay}`);

    allExpedisiDataUnfiltered.forEach(exp => {
      const expCreatedDate = new Date(exp.created);
      const expCreatedTimestamp = expCreatedDate.getTime();
      const courierName = exp.couriername;

      console.log(`  Processing tbl_expedisi record: Resi=${exp.resino}, Courier=${courierName}, Created=${exp.created}`);
      console.log(`    Parsed Timestamp: ${expCreatedTimestamp}`);
      console.log(`    Selected Day Range: ${startOfSelectedDay} - ${endOfSelectedDay}`);
      console.log(`    Is within range? ${expCreatedTimestamp >= startOfSelectedDay && expCreatedTimestamp <= endOfSelectedDay}`);

      if (expCreatedTimestamp >= startOfSelectedDay && expCreatedTimestamp <= endOfSelectedDay) {
        if (courierName && summaries[courierName]) {
          summaries[courierName].totalTransaksi++;
          if (exp.flag === "NO") {
            summaries[courierName].sisa++;
          }
          console.log(`    -> Matched date and courier for ${courierName}. Current totalTransaksi: ${summaries[courierName].totalTransaksi}, sisa: ${summaries[courierName].sisa}`);
        } else {
          console.warn(`    -> tbl_expedisi: Courier name '${courierName}' not found in summaries or is null for resino: ${exp.resino}. Skipping.`);
        }
      } else {
        console.log(`    -> tbl_expedisi: Resino ${exp.resino} created date ${exp.created} is outside selected range. Skipping.`);
      }
    });
    console.log("Summaries after processing tbl_expedisi (client-side date-filtered):", summaries);


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
        if (resi.Keterangan === "ID" || resi.Keterangan === "ID_REKOMENDASI") {
          targetCourierName = "ID";
          console.log(`Attributing Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' to ID expedition for summary (not found in tbl_expedisi map).`);
        } else if (resi.Keterangan && ["JNE", "SPX", "INSTAN", "SICEPAT"].includes(resi.Keterangan)) {
          targetCourierName = resi.Keterangan;
          console.log(`Attributing Resi ${resi.Resi} with Keterangan '${resi.Keterangan}' to ${targetCourierName} expedition for summary (not found in tbl_expedisi map).`);
        }
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
    console.log("--- useEffect for expeditionSummaries calculation finished ---");
  }, [date, allExpedisiDataUnfiltered, allResiData, isLoadingAllExpedisiUnfiltered, isLoadingAllResi]);


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