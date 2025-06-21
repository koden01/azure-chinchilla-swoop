import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns"; // Import startOfDay and endOfDay
import { fetchAllDataPaginated } from "@/utils/supabaseFetch"; // Import the shared utility

export interface HistoryData {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string;
  schedule: string | null;
}

export const useHistoryData = (startDate: Date | undefined, endDate: Date | undefined) => {
  const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

  const { data: historyData, isLoading: isLoadingHistory } = useQuery<HistoryData[]>({
    queryKey: ["historyData", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      console.log(`[useHistoryData queryFn] startDate: ${startDate?.toISOString()}, endDate: ${endDate?.toISOString()}`);
      if (!startDate || !endDate) {
        console.log("[useHistoryData queryFn] startDate or endDate is undefined, returning empty array.");
        return [];
      }

      // Use startOfDay and endOfDay from date-fns to ensure full day range
      const startOfRange = startOfDay(startDate);
      const endOfRange = endOfDay(endDate);
      
      console.log(`[useHistoryData queryFn] Fetching data from tbl_resi between ${startOfRange.toISOString()} and ${endOfRange.toISOString()}`);

      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // Column for date filtering
        startOfRange,
        endOfRange,
        "Resi, Keterangan, nokarung, created, schedule", // Specific columns to select
        (query) => query.order("created", { ascending: false }) // Add ordering
      );
      console.log(`[useHistoryData queryFn] Fetched data length: ${data?.length || 0}`);
      return data || [];
    },
    enabled: !!startDate && !!endDate,
  });

  useEffect(() => {
    console.log("useHistoryData: historyData updated:", historyData);
  }, [historyData]);

  return { historyData, isLoadingHistory, formattedStartDate, formattedEndDate };
};