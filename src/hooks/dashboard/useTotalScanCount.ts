import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export const useTotalScanCount = (date: Date | undefined) => {
  const formattedDate = date ? date.toISOString().split('T')[0] : ""; // Use date part for query key

  return useQuery<number>({
    queryKey: ["totalScan", formattedDate],
    queryFn: async () => {
      if (!date) return 0;
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .eq("schedule", "ontime") // Only count 'ontime' scans
        // No special handling for 'ID' or 'ID_REKOMENDASI' here
        .gte("created", startOfDay(date).toISOString())
        .lt("created", endOfDay(date).toISOString());
      if (error) {
        console.error("Error fetching Total Scan:", error);
        throw error;
      }
      return count || 0;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};