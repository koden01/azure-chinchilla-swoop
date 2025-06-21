import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";

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

  return useQuery<HistoryData[]>({
    queryKey: ["historyData", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      if (!startDate || !endDate) {
        console.log("useHistoryData: Skipping fetch, startDate or endDate is undefined.");
        return [];
      }

      // Adjust dates to UTC start/end of day for accurate timestamp filtering
      const startOfSelectedStartDateUTC = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0));
      const endOfSelectedEndDateUTC = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999));
      
      console.log(`useHistoryData: Fetching data for range ${startOfSelectedStartDateUTC.toISOString()} to ${endOfSelectedEndDateUTC.toISOString()} (UTC)`);
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created",
        startOfSelectedStartDateUTC,
        endOfSelectedEndDateUTC,
        "Resi, Keterangan, nokarung, created, schedule"
      );
      console.log(`useHistoryData: Fetched ${data.length} records.`);
      return data || [];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5, // Data considered fresh for 5 minutes
    gcTime: 1000 * 60 * 60, // Garbage collect after 1 hour
  });
};