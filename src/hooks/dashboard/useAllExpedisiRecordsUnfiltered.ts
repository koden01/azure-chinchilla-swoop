import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { format, subDays } from "date-fns";

export const useAllExpedisiRecordsUnfiltered = () => {
  const today = new Date();
  const twoDaysAgo = subDays(today, 2);
  const twoDaysAgoFormatted = format(twoDaysAgo, "yyyy-MM-dd");
  const endOfTodayFormatted = format(today, "yyyy-MM-dd");

  return useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted],
    queryFn: async () => {
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", twoDaysAgo, today);
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true,
    staleTime: 1000 * 10, // Changed to 10 seconds for quicker updates
    gcTime: 1000 * 60 * 60 * 24 * 2, // 2 days
  });
};