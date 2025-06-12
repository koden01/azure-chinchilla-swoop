import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import React from "react";

// Define types for Supabase data
interface TblExpedisi {
  datetrans: string | null;
  chanelsales: string | null;
  orderno: string;
  couriername: string | null;
  resino: string;
  created: string | null;
  flag: string | null;
  cekfu: boolean | null;
}

interface TblResi {
  created: string;
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  schedule: string | null;
}

interface ScanFollowUpData {
  Resi: string;
  created_resi: string;
  created_expedisi: string | null;
  couriername: string | null;
  cekfu?: boolean;
}

interface ExpeditionSummary {
  name: string;
  totalTransaksi: number;
  totalScan: number;
  sisa: number;
  jumlahKarung: number;
  idRekomendasi: number;
}

export const useDashboardData = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

  const { data: transaksiHariIni, isLoading: isLoadingTransaksiHariIni } = useQuery<number>({
    queryKey: ["transaksiHariIni", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("resino", { count: "exact", head: true })
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: totalScan, isLoading: isLoadingTotalScan } = useQuery<number>({
    queryKey: ["totalScan", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("Resi", { count: "exact", head: true })
        .eq("schedule", "ontime")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: idRekomendasi, isLoading: isLoadingIdRekomendasi } = useQuery<number>({
    queryKey: ["idRekomendasi", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("Resi", { count: "exact", head: true })
        .eq("schedule", "idrek")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: belumKirim, isLoading: isLoadingBelumKirim } = useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("resino", { count: "exact", head: true })
        .eq("flag", "NO")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: batalCount, isLoading: isLoadingBatalCount } = useQuery<number>({
    queryKey: ["batalCount", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("Resi", { count: "exact", head: true })
        .eq("schedule", "batal")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: followUpData, isLoading: isLoadingFollowUp } = useQuery<ScanFollowUpData[]>({
    queryKey: ["followUpData", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_scan_follow_up", {
        selected_date: formattedDate,
      });
      if (error) throw error;
      const resiWithCekfu = await Promise.all((data || []).map(async (item: ScanFollowUpData) => {
        const { data: expedisiDetail, error: expError } = await supabase
          .from("tbl_expedisi")
          .select("cekfu")
          .eq("resino", item.Resi)
          .single();
        return {
          ...item,
          cekfu: expedisiDetail?.cekfu || false,
        };
      }));
      return resiWithCekfu || [];
    },
    enabled: !!date,
  });

  const { data: allExpedisi, isLoading: isLoadingAllExpedisi } = useQuery<TblExpedisi[]>({
    queryKey: ["allExpedisi", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("*")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!date,
  });

  const { data: allResi, isLoading: isLoadingAllResi } = useQuery<TblResi[]>({
    queryKey: ["allResi", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("*")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!date,
  });

  const expeditionSummaries: ExpeditionSummary[] = React.useMemo(() => {
    if (!allExpedisi || !allResi) return [];

    const summaries: { [key: string]: ExpeditionSummary } = {};

    allExpedisi.forEach((exp) => {
      if (exp.couriername && !summaries[exp.couriername]) {
        summaries[exp.couriername] = {
          name: exp.couriername,
          totalTransaksi: 0,
          totalScan: 0,
          sisa: 0,
          jumlahKarung: 0,
          idRekomendasi: 0,
        };
      }
    });

    allExpedisi.forEach((exp) => {
      if (exp.couriername) {
        summaries[exp.couriername].totalTransaksi++;
      }
    });

    const courierNokarungMap: { [key: string]: Set<string> } = {};
    allResi.forEach((resi) => {
      const matchingExpedisi = allExpedisi.find((exp) => exp.resino === resi.Resi);
      if (matchingExpedisi && matchingExpedisi.couriername) {
        const courierSummary = summaries[matchingExpedisi.couriername];
        if (courierSummary) {
          if (resi.schedule === "ontime") {
            courierSummary.totalScan++;
          }
          if (resi.schedule === "idrek") {
            courierSummary.idRekomendasi++;
          }
          if (resi.nokarung) {
            if (!courierNokarungMap[matchingExpedisi.couriername]) {
              courierNokarungMap[matchingExpedisi.couriername] = new Set();
            }
            courierNokarungMap[matchingExpedisi.couriername].add(resi.nokarung);
          }
        }
      }
    });

    Object.keys(summaries).forEach((courierName) => {
      summaries[courierName].jumlahKarung = courierNokarungMap[courierName]?.size || 0;
    });

    Object.values(summaries).forEach((summary) => {
      summary.sisa = summary.totalTransaksi - summary.totalScan;
    });

    return Object.values(summaries);
  }, [allExpedisi, allResi]);

  return {
    transaksiHariIni,
    isLoadingTransaksiHariIni,
    totalScan,
    isLoadingTotalScan,
    idRekomendasi,
    isLoadingIdRekomendasi,
    belumKirim,
    isLoadingBelumKirim,
    batalCount,
    isLoadingBatalCount,
    followUpData,
    isLoadingFollowUp,
    allExpedisi,
    isLoadingAllExpedisi,
    allResi,
    isLoadingAllResi,
    expeditionSummaries,
    formattedDate,
  };
};