import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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

  const fetchAllResiDataPaginated = useCallback(async (startIso: string, endIso: string) => {
    let allRecords: HistoryData[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    console.log(`[fetchAllResiDataPaginated] Fetching from tbl_resi between ${startIso} and ${endIso}`);

    while (hasMore) {
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, Keterangan, nokarung, created, schedule")
        .gte("created", startIso)
        .lte("created", endIso)
        .order("created", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error(`[fetchAllResiDataPaginated] Error fetching paginated history data:`, error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log(`[fetchAllResiDataPaginated] Fetched ${data.length} records (offset: ${offset}).`);
        allRecords = allRecords.concat(data);
        offset += data.length;
        hasMore = data.length === limit;
      } else {
        console.log(`[fetchAllResiDataPaginated] No more data or empty response (offset: ${offset}).`);
        hasMore = false;
      }
    }
    console.log(`[fetchAllResiDataPaginated] Total records fetched: ${allRecords.length}`);
    return allRecords;
  }, []);

  const { data: historyData, isLoading: isLoadingHistory } = useQuery<HistoryData[]>({
    queryKey: ["historyData", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      console.log(`[useHistoryData queryFn] startDate: ${startDate?.toISOString()}, endDate: ${endDate?.toISOString()}`);
      if (!startDate || !endDate) {
        console.log("[useHistoryData queryFn] startDate or endDate is undefined, returning empty array.");
        return [];
      }

      const startOfSelectedStartDate = new Date(startDate);
      startOfSelectedStartDate.setHours(0, 0, 0, 0);

      const endOfSelectedEndDate = new Date(endDate);
      endOfSelectedEndDate.setHours(23, 59, 59, 999);

      const startIso = startOfSelectedStartDate.toISOString();
      const endIso = endOfSelectedEndDate.toISOString();
      
      const data = await fetchAllResiDataPaginated(startIso, endIso);
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