import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import React from "react";

interface KarungSummaryItem {
  karung_number: string;
  quantity: number;
}

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null; // Changed to Keterangan to match tbl_resi
  schedule: string | null;
}

// Define type for tbl_expedisi data
interface ExpedisiData {
  resino: string;
  orderno: string | null;
  chanelsales: string | null;
  couriername: string | null;
  created: string;
  flag: string | null;
  datetrans: string | null;
  cekfu: boolean | null;
}

export const useResiInputData = (expedition: string) => {
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");
  const startOfTodayISO = startOfDay(today).toISOString();
  const endOfTodayISO = endOfDay(today).toISOString();

  // Function to fetch all data from a table with pagination
  const fetchAllDataPaginated = async (tableName: string, dateFilterColumn?: string, startDate?: string, endDate?: string) => {
    let allRecords: any[] = [];
    let offset = 0;
    const limit = 1000; // Fetch 1000 records at a time
    let hasMore = true;

    while (hasMore) {
      let query = supabase.from(tableName).select("*").range(offset, offset + limit - 1);

      if (dateFilterColumn && startDate && endDate) {
        query = query.gte(dateFilterColumn, startDate).lt(dateFilterColumn, endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching paginated data from ${tableName}:`, error);
        throw error;
      }

      if (data && data.length > 0) {
        allRecords = allRecords.concat(data);
        offset += data.length;
        hasMore = data.length === limit; // If less than limit, no more data
      } else {
        hasMore = false;
      }
    }
    return allRecords;
  };

  // Query to fetch all resi data for the current expedition and date for local validation
  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];

      console.log(`Fetching allResiForExpedition for ${expedition} on ${formattedDate} (for local validation)`);
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, nokarung, created, Keterangan, schedule")
        .eq("Keterangan", expedition) // Filter by Keterangan (expedition name)
        .gte("created", startOfTodayISO)
        .lt("created", endOfTodayISO);

      if (error) {
        console.error("Error fetching all resi for expedition:", error);
        throw error;
      }
      console.log(`Fetched ${data?.length || 0} resi for local validation.`);
      return data || [];
    },
    enabled: !!expedition,
  });

  // NEW: Query to fetch ALL tbl_resi data (unfiltered by date or expedition) for comprehensive duplicate checking
  const { data: allResiDataComprehensive, isLoading: isLoadingAllResiDataComprehensive } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiDataComprehensive"],
    queryFn: async () => {
      console.log("Fetching allResiDataComprehensive (paginated) for global duplicate checking.");
      const data = await fetchAllDataPaginated("tbl_resi", undefined, undefined, undefined); // No date or expedition filter
      console.log("All Resi Data (comprehensive, paginated) for global duplicate checking:", data.length, "items");
      return data;
    },
    enabled: true, // Always enabled to get all mappings
    staleTime: 1000 * 60 * 5, // Keep this data fresh for 5 minutes, it's critical for validation
    gcTime: 1000 * 60 * 60, // Garbage collect after 1 hour
  });

  // NEW: Fetch ALL tbl_expedisi data (unfiltered by date) to build a comprehensive resi-to-courier map for local validation
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiUnfiltered } = useQuery<ExpedisiData[]>({
    queryKey: ["allExpedisiDataUnfiltered"], // No date in key, fetch all
    queryFn: async () => {
      console.log("Fetching allExpedisiDataUnfiltered (paginated) for local validation.");
      const data = await fetchAllDataPaginated("tbl_expedisi");
      console.log("All Expedisi Data (unfiltered, paginated) for local validation:", data.length, "items");
      return data;
    },
    enabled: true, // Always enabled to get all mappings
  });

  // Query to fetch lastKarung directly from database using RPC
  const { data: lastKarungData, isLoading: isLoadingLastKarung } = useQuery<string | null>({
    queryKey: ["lastKarung", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return null;

      const { data, error } = await supabase.rpc("get_last_karung_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });

      if (error) {
        console.error("Error fetching last karung:", error);
        throw error;
      }
      return data || null;
    },
    enabled: !!expedition,
  });

  // NEW: Query to fetch karung summary directly from database using RPC
  const { data: karungSummaryData, isLoading: isLoadingKarungSummary } = useQuery<KarungSummaryItem[]>({
    queryKey: ["karungSummary", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];

      const { data, error } = await supabase.rpc("get_karung_summary_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });

      if (error) {
        console.error("Error fetching karung summary:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!expedition,
  });

  // Derive currentCount from karungSummaryData
  const currentCount = React.useCallback((selectedKarung: string) => {
    if (!karungSummaryData || !selectedKarung) return 0;
    const summaryItem = karungSummaryData.find(item => item.karung_number === selectedKarung);
    return summaryItem ? summaryItem.quantity : 0;
  }, [karungSummaryData]);

  // lastKarung is now directly from lastKarungData
  const lastKarung = React.useMemo(() => {
    return parseInt(lastKarungData || "0") || 0;
  }, [lastKarungData]);

  // Derive highestKarung from karungSummaryData
  const highestKarung = React.useMemo(() => {
    if (!karungSummaryData || karungSummaryData.length === 0) return 0;
    const validKarungNumbers = karungSummaryData
      .map(item => parseInt(item.karung_number || "0"))
      .filter(num => !isNaN(num) && num > 0);
    return validKarungNumbers.length > 0 ? Math.max(...validKarungNumbers) : 0;
  }, [karungSummaryData]);

  // Karung options based on highestKarung (still client-side generation)
  const karungOptions = React.useMemo(() => {
    const maxKarung = Math.max(1, highestKarung, 100); // Ensure at least 1 and up to 100 by default
    return Array.from({ length: maxKarung }, (_, i) => (i + 1).toString());
  }, [highestKarung]);

  // karungSummary is now directly from karungSummaryData, mapped to match existing structure
  const karungSummary = React.useMemo(() => {
    return karungSummaryData ? karungSummaryData.map(item => ({
      karungNumber: item.karung_number,
      quantity: item.quantity,
    })) : [];
  }, [karungSummaryData]);

  // NEW: Derive unique expedition options from allExpedisiDataUnfiltered
  const expeditionOptions = React.useMemo(() => {
    const uniqueNames = new Set<string>();
    // Add hardcoded 'ID' first, as it has special handling
    uniqueNames.add("ID"); 

    allExpedisiDataUnfiltered?.forEach(exp => {
      const name = exp.couriername?.trim().toUpperCase();
      if (name) {
        uniqueNames.add(name);
      }
    });

    const sortedNames = Array.from(uniqueNames).sort((a, b) => a.localeCompare(b));
    console.log("Generated expedition options:", sortedNames);
    return sortedNames;
  }, [allExpedisiDataUnfiltered]);


  return {
    allResiForExpedition, // Now returned
    isLoadingAllResiForExpedition: isLoadingAllResiForExpedition || isLoadingLastKarung || isLoadingKarungSummary || isLoadingAllExpedisiUnfiltered || isLoadingAllResiDataComprehensive, // Combine loading states
    allResiDataComprehensive, // NEW: Return comprehensive resi data
    allExpedisiDataUnfiltered, // NEW: Return all expedisi data
    currentCount,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
    karungSummary,
    isLoadingKarungSummary,
    expeditionOptions, // NEW: Return expedition options
  };
};