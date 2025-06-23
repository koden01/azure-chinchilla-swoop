import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client"; // Keep if needed for other queries, but not for this one
import { format, startOfDay, endOfDay } from "date-fns"; // Import startOfDay and endOfDay
import { fetchAllDataPaginated } from "@/utils/supabaseFetch"; // Import the shared utility

export const useExpedisiRecordsForSelectedDate = (date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : ""; // Use for query key

  return useQuery<any[]>({
    queryKey: ["expedisiDataForSelectedDate", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      
      // Menggunakan fetchAllDataPaginated untuk mengambil semua data dari tbl_expedisi
      // daripada memanggil RPC, untuk mengatasi batasan 1000 baris.
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        "created", // Kolom untuk filter tanggal
        date, // Tanggal mulai
        date, // Tanggal akhir (untuk mencakup seluruh hari)
        "resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu", // Kolom yang spesifik
        (query) => query.order("created", { ascending: false }) // Tambahkan pengurutan
      );
      return data || [];
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 60 * 4, // Stale time 4 jam
  });
};