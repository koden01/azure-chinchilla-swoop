import { useQuery } from "@tanstack/react-query";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { format } from "date-fns"; // Menghapus subDays karena tidak lagi diperlukan

export const useAllExpedisiRecordsUnfiltered = () => {
  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");

  return useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", formattedToday], // Hanya menggunakan tanggal hari ini
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        "created",
        today,
        today,
        "resino, couriername, created, flag, cekfu" // Hanya pilih kolom yang diperlukan
      );
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true,
    staleTime: 1000 * 60 * 60, // Tetap 60 menit
    gcTime: 1000 * 60 * 60 * 24, // Tetap 24 jam
  });
};