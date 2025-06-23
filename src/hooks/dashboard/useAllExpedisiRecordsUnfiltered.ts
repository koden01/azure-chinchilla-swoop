import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { format, subDays } from "date-fns";

export const useAllExpedisiRecordsUnfiltered = () => {
  const today = new Date();
  // Mengubah menjadi hanya hari ini dan kemarin
  const yesterday = subDays(today, 1); 
  const yesterdayFormatted = format(yesterday, "yyyy-MM-dd");
  const endOfTodayFormatted = format(today, "yyyy-MM-dd");

  return useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", yesterdayFormatted, endOfTodayFormatted],
    queryFn: async () => {
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", yesterday, today);
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true,
    staleTime: 1000 * 60 * 60, // Changed to 60 minutes (from 5 minutes)
    gcTime: 1000 * 60 * 60 * 24 * 2, // 2 days
    select: (data) => { // Add select function to ensure Map instance
      if (data instanceof Map) {
        return data;
      }
      // Defensive check: if it's a plain object from JSON.parse, try to revive it
      if (typeof data === 'object' && data !== null && (data as any).dataType === 'MapObject' && typeof (data as any).value === 'object') {
        console.warn("allExpedisiDataUnfiltered was not a Map instance, attempting manual revival from MapObject in select.");
        return new Map(Object.entries((data as any).value));
      }
      console.warn("allExpedisiDataUnfiltered data is not a Map and cannot be revived. Returning empty Map.");
      return new Map();
    },
  });
};