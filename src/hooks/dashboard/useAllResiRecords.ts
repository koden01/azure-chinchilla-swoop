import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
// Removed unused import: format

export const useAllResiRecords = (date: Date | undefined) => {
  const formattedDate = date ? date.toISOString().split('T')[0] : ""; // Use date part for query key

  return useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const data = await fetchAllDataPaginated("tbl_resi", "created", date, date);
      console.log(`[useAllResiRecords] Fetched allResiData for ${formattedDate}:`, data); // Added debug log
      return data;
    },
    enabled: !!date,
  });
};