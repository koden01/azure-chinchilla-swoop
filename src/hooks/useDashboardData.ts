import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useMemo } from "react";

interface ExpeditionCounts {
  [key: string]: {
    total: number;
    belumKirim: number;
    scanFollowUp: number;
  };
}

export const useDashboardData = (selectedDate: Date) => {
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const { data: transaksiHariIniCount, isLoading: isLoadingTransaksiHariIniCount } = useQuery<number>({
    queryKey: ["transaksiHariIniCount", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_transaksi_hari_ini_count", { p_selected_date: formattedDate });
      if (error) throw error;
      return data || 0;
    },
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const { data: belumKirimCount, isLoading: isLoadingBelumKirimCount } = useQuery<number>({
    queryKey: ["belumKirimCount", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_belum_kirim_count", { p_selected_date: formattedDate });
      if (error) throw error;
      return data || 0;
    },
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const { data: scanFollowUpCount, isLoading: isLoadingScanFollowUpCount } = useQuery<number>({
    queryKey: ["scanFollowUpCount", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_scan_follow_up", { selected_date: formattedDate });
      if (error) throw error;
      return data?.length || 0;
    },
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const { data: idRekomendasiCount, isLoading: isLoadingIdRekomendasiCount } = useQuery<number>({
    queryKey: ["idRekomendasiCount", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_id_rekomendasi_count", { p_selected_date: formattedDate });
      if (error) throw error;
      return data || 0;
    },
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const { data: expeditionDetailRecords, isLoading: isLoadingExpeditionDetailRecords } = useQuery<any[]>({
    queryKey: ["expeditionDetailRecords", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_transaksi_hari_ini_records", { p_selected_date: formattedDate });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const expeditionCounts = useMemo(() => {
    const counts: ExpeditionCounts = {};
    if (expeditionDetailRecords) {
      expeditionDetailRecords.forEach(record => {
        const courierName = record.couriername || "LAIN-LAIN";
        if (!counts[courierName]) {
          counts[courierName] = { total: 0, belumKirim: 0, scanFollowUp: 0 };
        }
        counts[courierName].total++;
        if (record.flag === 'NO') {
          counts[courierName].belumKirim++;
        }
        // Scan Follow Up is handled by a separate RPC, not directly from this record set
      });
    }
    return counts;
  }, [expeditionDetailRecords]);

  const isLoading = isLoadingTransaksiHariIniCount || isLoadingBelumKirimCount || isLoadingScanFollowUpCount || isLoadingExpeditionDetailRecords || isLoadingIdRekomendasiCount;

  return {
    transaksiHariIniCount,
    belumKirimCount,
    scanFollowUpCount,
    expeditionCounts,
    idRekomendasiCount,
    isLoading,
  };
};