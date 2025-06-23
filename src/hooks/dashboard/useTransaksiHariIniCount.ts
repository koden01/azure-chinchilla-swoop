import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const useTransaksiHariIniCount = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

  return useQuery<number>({
    queryKey: ["transaksiHariIni", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { data: countData, error } = await supabase.rpc("get_transaksi_hari_ini_count", {
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching Transaksi Hari Ini count:", error);
        throw error;
      }
      return countData || 0;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};