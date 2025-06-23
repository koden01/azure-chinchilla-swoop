import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns"; // Import startOfDay and endOfDay
import { fetchAllDataPaginated } from "@/utils/supabaseFetch"; // Import fetchAllDataPaginated

export const useExpedisiRecordsForSelectedDate = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

  return useQuery<any[]>({
    queryKey: ["expedisiDataForSelectedDate", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        "created", // Kolom untuk filter tanggal
        date,      // Tanggal mulai (akan diubah ke startOfDay oleh fetchAllDataPaginated)
        date,      // Tanggal akhir (akan diubah ke endOfDay oleh fetchAllDataPaginated)
        "resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu" // Kolom yang relevan
      );
      
      console.log(`[useExpedisiRecordsForSelectedDate] Fetched data length: ${data ? data.length : 0}`);
      return data || [];
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};