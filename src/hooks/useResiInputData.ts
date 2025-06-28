import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { useMemo } from "react";

export interface ResiExpedisiData {
  Resi: string;
  nokarung: string;
  created: string;
  Keterangan: string;
  schedule: string;
}

export const useResiInputData = (selectedDate: Date, expedition: string) => {
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiDataUnfiltered } = useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", formattedDate],
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        undefined,
        undefined,
        undefined,
        "resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu",
        (query) => query.eq("created", formattedDate)
      );
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_filtered_resi_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!expedition,
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: totalExpeditionItems, isLoading: isLoadingTotalExpeditionItems } = useQuery<number>({
    queryKey: ["totalExpeditionItems", expedition, formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_total_expedition_items_count", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const { data: remainingExpeditionItems, isLoading: isLoadingRemainingExpeditionItems } = useQuery<number>({
    queryKey: ["remainingExpeditionItems", expedition, formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_belum_kirim_expedition_count", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const { data: idExpeditionScanCount, isLoading: isLoadingIdExpeditionScanCount } = useQuery<number>({
    queryKey: ["idExpeditionScanCount", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_transaksi_hari_ini_count", {
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: expedition === 'ID',
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const { data: idRekomendasiCount, isLoading: isLoadingIdRekomendasiCount } = useQuery<number>({
    queryKey: ["idRekomendasiCount", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_id_rekomendasi_count", {
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: expedition === 'ID', // Only fetch if the selected expedition is 'ID'
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
  });

  const isLoading = isLoadingAllExpedisiDataUnfiltered || isLoadingAllResiForExpedition || isLoadingTotalExpeditionItems || isLoadingRemainingExpeditionItems || isLoadingIdExpeditionScanCount || isLoadingIdRekomendasiCount;

  const memoizedData = useMemo(() => ({
    allExpedisiDataUnfiltered,
    allResiForExpedition,
    totalExpeditionItems,
    remainingExpeditionItems,
    idExpeditionScanCount,
    idRekomendasiCount, // Include the new count
    isLoading,
  }), [
    allExpedisiDataUnfiltered,
    allResiForExpedition,
    totalExpeditionItems,
    remainingExpeditionItems,
    idExpeditionScanCount,
    idRekomendasiCount,
    isLoading,
  ]);

  return memoizedData;
};