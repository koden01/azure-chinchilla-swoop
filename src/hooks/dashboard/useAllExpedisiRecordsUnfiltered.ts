import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { format } from "date-fns";

export const useAllExpedisiRecordsUnfiltered = () => {
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd"); // Hanya tanggal hari ini

  return useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", formattedDate], // Kunci kueri hanya untuk hari ini
    queryFn: async () => {
      // Mengambil data hanya untuk hari ini
      const data = await fetchAllDataPaginated("tbl_expedisi", "created", today, today);
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