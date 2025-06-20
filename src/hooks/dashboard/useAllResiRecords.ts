import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { startOfDay, endOfDay } from "date-fns";

export const useAllResiRecords = (date: Date | undefined) => {
  const formattedDate = date ? date.toISOString().split('T')[0] : ""; // Use date part for query key

  return useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const data = await fetchAllDataPaginated("tbl_resi", "created", date, date);
      return data;
    },
    enabled: !!date,
  });
};