import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export const useIdRekCount = (date: Date | undefined) => {
  const formattedDate = date ? date.toISOString().split('T')[0] : ""; // Use date part for query key

  return useQuery<number>({
    queryKey: ["idRekCount", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("Keterangan", "ID_REKOMENDASI")
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) {
        console.error("Error fetching ID Rekomendasi:", error);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};