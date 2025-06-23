import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns"; 
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";

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
      
      return data || [];
    },
    enabled: !!date,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });
};