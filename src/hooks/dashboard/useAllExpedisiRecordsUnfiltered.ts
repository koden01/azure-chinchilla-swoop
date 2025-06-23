import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { format, subDays } from "date-fns";
import { TblExpedisi } from "@/types/supabase"; // Import TblExpedisi

export const useAllExpedisiRecordsUnfiltered = () => {
  const today = new Date();
  // Mengubah menjadi hanya hari ini dan kemarin
  const yesterday = subDays(today, 1); 
  const yesterdayFormatted = format(yesterday, "yyyy-MM-dd");
  const endOfTodayFormatted = format(today, "yyyy-MM-dd");

  return useQuery<Map<string, TblExpedisi>>({ // Specify Map value type as TblExpedisi
    queryKey: ["allExpedisiDataUnfiltered", yesterdayFormatted, endOfTodayFormatted],
    queryFn: async () => {
      const data = await fetchAllDataPaginated<TblExpedisi>("tbl_expedisi", "created", yesterday, today); // Specify TblExpedisi
      const expedisiMap = new Map<string, TblExpedisi>(); // Specify Map value type
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
  });
};