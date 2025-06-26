import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
// Removed unused import: format

export const useAllResiRecords = (date: Date | undefined) => {
  const formattedDate = date ? date.toISOString().split('T')[0] : ""; // Use date part for query key

  return useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created",
        date,
        date,
        "Resi, nokarung, created, Keterangan, schedule" // Hanya pilih kolom yang diperlukan
      );
      return data;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};