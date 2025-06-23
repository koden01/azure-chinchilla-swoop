import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const useExpedisiRecordsForSelectedDate = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

  return useQuery<any[]>({
    queryKey: ["expedisiDataForSelectedDate", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const { data, error } = await supabase.rpc("get_transaksi_hari_ini_records", {
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching expedisiDataForSelectedDate via RPC:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};