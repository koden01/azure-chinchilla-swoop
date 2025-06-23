import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
// Removed format import as it's no longer needed for query key

export const useAllExpedisiRecordsUnfiltered = () => {
  // No formattedDate needed here as it's truly unfiltered by date
  return useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered"], // Kunci kueri tanpa filter tanggal
    queryFn: async () => {
      // Mengambil semua data tanpa filter tanggal
      const data = await fetchAllDataPaginated("tbl_expedisi"); // No date arguments
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true,
    staleTime: 1000 * 60 * 60 * 4, // Stale time 4 jam
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect setelah 24 jam
  });
};