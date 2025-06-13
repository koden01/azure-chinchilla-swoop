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
      return count || 0;
    },
    enabled: !!date,
  });

  // NEW: Query for Follow Up (tbl_expedisi count where flag = 'NO' and created date is NOT selected date)
  const { data: followUpFlagNoCount, isLoading: isLoadingFollowUpFlagNoCount } = useQuery<number>({
    queryKey: ["followUpFlagNoCount", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("*", { count: "exact" })
        .eq("flag", "NO")
        .not("created", "gte", startOfDay(date).toISOString())
        .or(`created.lt.${startOfDay(date).toISOString()},created.gte.${endOfDay(date).toISOString()}`);
        // The above .or() condition is tricky for "not today". A simpler way is to fetch all and filter in JS,
        // or use a custom RPC if performance is an issue with large datasets.
        // For now, let's assume the `not` condition is sufficient for `gte` and `lt` for the selected day.
        // A more robust SQL would be `created::date <> selected_date`.
        // Let's use a direct RPC for this to be precise, as the `not` operator on ranges can be complex.
        // For now, I'll use the existing `get_scan_follow_up` which is close to the user's intent for "Scan Followup"
        // and create a new RPC for the "flag NO except today" if needed.
        // Re-reading: "menghitung semua noresi yang status "NO" pada kolom flag kecuali hari ini"
        // This means `tbl_expedisi.flag = 'NO'` AND `DATE(created) != selected_date`.
        // Supabase client doesn't directly support `DATE(column) != date_value`.
        // We need to fetch all 'NO' flags and filter, or use an RPC.
        // Let's create a new RPC for this for accuracy.
        // For now, I'll use a placeholder and note that an RPC is ideal.
        // For the purpose of this task, I will assume the user means `tbl_expedisi.flag = 'NO'` and the `created` date is *not* within the selected day.
        // This is hard to do with simple `gte`/`lt` and `not`.
        // Let's use the `get_scan_follow_up` RPC for the "Scan Followup" card, as it's already defined and fits "scan tidak sesuai tanggal".
        // For "Follow Up" card (flag NO except today), I will use a simpler query for now, assuming it means `flag='NO'` and `created` is *before* the selected date.
        // This is a simplification. The most accurate would be an RPC.
        // Let's stick to the existing `belumKirim` for the "Follow Up" card, and use `followUpData` for the new "Scan Followup" card.
        // The user's request for "Follow Up" card: "menghitung semua noresi yang status "NO" pada kolom flag kecuali hari ini".
        // This is `tbl_expedisi.flag = 'NO'` AND `created::date != selected_date`.
        // Let's add a new RPC for this.
        const { data: countData, error: rpcError } = await supabase.rpc("get_flag_no_except_today_count", {
          p_selected_date: formattedDate,
        });
        if (rpcError) throw rpcError;
        return countData || 0;
    },
    enabled: !!date,
  });

  // NEW: Query for Scan Followup (tbl_resi count where schedule = 'late' for selected date)
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
      return data || [];
    },
    enabled: !!date,
  });

  // Query for all expedition names
  const { data: expeditionNames, isLoading: isLoadingExpeditionNames } = useQuery<string[]>({
    queryKey: ["expeditionNames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("couriername")
        .distinct("couriername");
      if (error) throw error;
      return data?.map((item) => item.couriername) || [];
    },
  });

  // Fetch data for each expedition
  useEffect(() => {
    const fetchExpeditionData = async () => {
      if (!date || !expeditionNames || isLoadingExpeditionNames) {
        setExpeditionSummaries([]);
        return;
      }

      const summaries = await Promise.all(
        expeditionNames.map(async (name) => {
          const { count: totalTransaksi, error: err1 } = await supabase
            .from("tbl_expedisi")
            .select("*", { count: "exact" })
            .eq("couriername", name)
            .gte("created", startOfDay(date).toISOString())
            .lt("created", endOfDay(date).toISOString());

          const { count: totalScan, error: err2 } = await supabase
            .from("tbl_resi")
            .select("*", { count: "exact" })
            .eq("couriername", name) // Assuming couriername is in tbl_resi or can be joined
            .eq("schedule", "ontime")
            .gte("created", startOfDay(date).toISOString())
            .lt("created", endOfDay(date).toISOString());

          const { count: sisa, error: err3 } = await supabase
            .from("tbl_expedisi")
            .select("*", { count: "exact" })
            .eq("couriername", name)
            .eq("flag", "NO")
            .gte("created", startOfDay(date).toISOString())
            .lt("created", endOfDay(date).toISOString());

          const { count: jumlahKarung, error: err4 } = await supabase
            .from("tbl_resi")
            .select("nokarung", { count: "exact" })
            .eq("couriername", name) // Assuming couriername is in tbl_resi or can be joined
            .not("nokarung", "is", null)
            .gte("created", startOfDay(date).toISOString())
            .lt("created", endOfDay(date).toISOString());

          const { count: idRekomendasiExp, error: err5 } = await supabase
            .from("tbl_resi")
            .select("*", { count: "exact" })
            .eq("couriername", name) // Assuming couriername is in tbl_resi or can be joined
            .eq("schedule", "idrek")
            .gte("created", startOfDay(date).toISOString())
            .lt("created", endOfDay(date).toISOString());

          if (err1 || err2 || err3 || err4 || err5) {
            console.error(
              `Error fetching data for ${name}:`,
              err1,
              err2,
              err3,
              err4,
              err5
            );
          }

          return {
            name,
            totalTransaksi: totalTransaksi || 0,
            totalScan: totalScan || 0,
            sisa: sisa || 0,
            jumlahKarung: jumlahKarung || 0,
            idRekomendasi: idRekomendasiExp || 0,
          };
        })
      );
      setExpeditionSummaries(summaries);
    };

    fetchExpeditionData();
  }, [date, expeditionNames, isLoadingExpeditionNames]);

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
  };
};