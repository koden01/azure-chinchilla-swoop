import { useQuery } from "@tanstack/react-query";
// import { supabase } from "@/integrations/supabase/client"; // Removed unused import
import { format, startOfDay, endOfDay } from "date-fns"; // Import startOfDay and endOfDay
import { fetchAllDataPaginated } from "@/utils/supabaseFetch"; // Import the shared utility
import { TblResi } from "@/types/supabase"; // Import TblResi

export interface HistoryData {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string;
  schedule: string | null;
}

export const useHistoryData = (startDate: Date | undefined, endDate: Date | undefined) => {
  const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

  const { data: historyData, isLoading: isLoadingHistory } = useQuery<HistoryData[]>({
    queryKey: ["historyData", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      if (!startDate || !endDate) {
        return [];
      }

      // Use startOfDay and endOfDay from date-fns to ensure full day range
      const startOfRange = startOfDay(startDate);
      const endOfRange = endOfDay(endDate);
      
      const data = await fetchAllDataPaginated<TblResi>( // Specify TblResi as the generic type
        "tbl_resi",
        "created", // Column for date filtering
        startOfRange,
        endOfRange,
        "Resi, Keterangan, nokarung, created, schedule", // Specific columns to select
        (query) => query.order("created", { ascending: false }) // Add ordering
      );
      // Map TblResi to HistoryData if there are any differences, otherwise just return
      return data.map(item => ({
        Resi: item.Resi,
        Keterangan: item.Keterangan,
        nokarung: item.nokarung,
        created: item.created,
        schedule: item.schedule,
      })) || [];
    },
    enabled: !!startDate && !!endDate,
  });

  return { historyData, isLoadingHistory, formattedStartDate, formattedEndDate };
};