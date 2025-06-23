import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { format, subDays } from "date-fns";

export const useAllExpedisiRecordsUnfiltered = () => {
  const today = new Date();
  const todayFormatted = format(today, "yyyy-MM-dd"); // Use for query key

  return useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", todayFormatted, todayFormatted], // Changed query key to today only
    queryFn: async () => {
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", today, today); // Changed date range to today only
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true,
    staleTime: 1000 * 60 * 60 * 4, // Changed to 4 hours (from 60 minutes)
    gcTime: 1000 * 60 * 60 * 24 * 2, // 2 days
  });
};