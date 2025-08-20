import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export const useBatalCount = (date: Date | undefined) => {
  const formattedDate = date ? date.toISOString().split('T')[0] : ""; // Use date part for query key

  return useQuery<number>({
    queryKey: ["batalCount", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("schedule", "batal")
        // No special handling for 'ID' or 'ID_REKOMENDASI' here
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) {
        console.error("Error fetching Batal Count:", error);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};