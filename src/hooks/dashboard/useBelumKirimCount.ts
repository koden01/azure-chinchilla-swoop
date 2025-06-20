import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const useBelumKirimCount = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

  return useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { data: countData, error } = await supabase.rpc("get_belum_kirim_count", {
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching Belum Kirim count:", error);
        throw error;
      }
      return countData || 0;
    },
    enabled: !!date,
  });
};