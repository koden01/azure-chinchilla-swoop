import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";

/**
 * Hook untuk mengambil semua nomor resi (resino) dari tbl_expedisi
 * yang memiliki flag = 'YES' dalam 5 hari terakhir (termasuk hari ini).
 * Data disimpan dalam Set untuk pencarian cepat.
 */
export const useAllFlagYesExpedisiResiNumbers = () => {
  const today = new Date();
  const fiveDaysAgo = subDays(today, 4); // Termasuk hari ini, jadi 5 hari total

  const formattedStartDate = format(fiveDaysAgo, "yyyy-MM-dd");
  const formattedEndDate = format(today, "yyyy-MM-dd");

  return useQuery<Set<string>>({
    queryKey: ["allFlagYesExpedisiResiNumbers", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        "created", // Kolom untuk filter tanggal
        fiveDaysAgo,
        today,
        "resino", // Hanya ambil kolom resino
        (query) => query.eq("flag", "YES")
      );

      const resiSet = new Set<string>();
      data.forEach(item => {
        if (item.resino) {
          resiSet.add(item.resino.toLowerCase());
        }
      });
      return resiSet;
    },
    staleTime: 1000 * 60 * 5, // Data dianggap fresh selama 5 menit
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect setelah 24 jam
    enabled: true,
  });
};