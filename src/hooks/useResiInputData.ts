import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// NEW: Type for all karung summaries
interface AllKarungSummaryItem {
  expedition_name: string;
  karung_number: string;
  quantity: number;
}

// Function to fetch all data from a table with pagination
// Now accepts an optional queryModifier function to apply additional filters
const fetchAllDataPaginated = async (
  tableName: string,
  dateFilterColumn?: string,
  startDate?: string,
  endDate?: string,
  queryModifier?: (query: any) => any // New optional parameter
) => {
  let allRecords: any[] = [];
  let offset = 0;
  const limit = 1000; // Fetch 1000 records at a time
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select("*").range(offset, offset + limit - 1);

    if (dateFilterColumn && startDate && endDate) {
      query = query.gte(dateFilterColumn, startDate).lt(dateFilterColumn, endDate);
    }

    if (queryModifier) { // Apply custom modifier if provided
      query = queryModifier(query);
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

export const useResiInputData = (expedition: string, showAllExpeditionSummary: boolean) => {
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");
  const startOfTodayISO = startOfDay(today).toISOString();
  const endOfTodayISO = endOfDay(today).toISOString();
  const queryClient = useQueryClient(); // Get query client instance

  // Query to fetch all resi data for the current expedition and date for local validation
  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];

      console.log(`Fetching allResiForExpedition for ${expedition} on ${formattedDate} (for local validation)`);
      
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // dateFilterColumn
        startOfTodayISO,
        endOfTodayISO,
        (baseQuery) => { // Custom filter function
          if (expedition === 'ID') {
            return baseQuery.in("Keterangan", ['ID', 'ID_REKOMENDASI']);
          } else {
            return baseQuery.eq("Keterangan", expedition);
          }
        }
      );

      console.log(`Fetched ${data?.length || 0} resi for local validation. Data:`, data);
      return data || [];
    },
    enabled: !!expedition,
  });

  // NEW: Query to fetch ALL tbl_resi data (unfiltered by date or expedition) for comprehensive duplicate checking
  // Data is now stored as a Map for O(1) lookup
  const { data: allResiDataComprehensiveMap, isLoading: isLoadingAllResiDataComprehensive } = useQuery<Map<string, ResiExpedisiData>>({
    queryKey: ["allResiDataComprehensive"],
    queryFn: async () => {
      console.log("Fetching allResiDataComprehensive (paginated) for global duplicate checking.");
      const data = await fetchAllDataPaginated("tbl_resi", undefined, undefined, undefined); // No date or expedition filter
      console.log("All Resi Data (comprehensive, paginated) for global duplicate checking:", data.length, "items");
      
      // Convert array to Map for faster lookups
      const resiMap = new Map<string, ResiExpedisiData>();
      data.forEach(item => {
        if (item.Resi) {
          resiMap.set(item.Resi.toLowerCase(), item);
        }
      });
      return resiMap;
    },
    enabled: true, // Always enabled to get all mappings
    staleTime: 0, // Set staleTime to 0 to ensure it always refetches when invalidated
    gcTime: 1000 * 60 * 60, // Garbage collect after 1 hour
  });

  // NEW: Fetch ALL tbl_expedisi data (unfiltered by date) to build a comprehensive resi-to-courier map for local validation
  // Data is now stored as a Map for O(1) lookup
  const { data: allExpedisiDataUnfilteredMap, isLoading: isLoadingAllExpedisiUnfiltered } = useQuery<Map<string, ExpedisiData>>({
    queryKey: ["allExpedisiDataUnfiltered"], // No date in key, fetch all
    queryFn: async () => {
      console.log("Fetching allExpedisiDataUnfiltered (paginated) for local validation.");
      const data = await fetchAllDataPaginated("tbl_expedisi");
      console.log("All Expedisi Data (unfiltered, paginated) for local validation:", data.length, "items");

      // Convert array to Map for faster lookups
      const expedisiMap = new Map<string, ExpedisiData>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    enabled: true, // Always enabled to get all mappings
    staleTime: 0, // Set staleTime to 0 to ensure it always refetches when invalidated
    gcTime: 1000 * 60 * 60, // Garbage collect after 1 hour
  });

  // Query to fetch lastKarung directly from database using RPC
  const { data: lastKarungData, isLoading: isLoadingLastKarung } = useQuery<string | null>({
    queryKey: ["lastKarung", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return null;

      console.log(`RPC Call: get_last_karung_for_expedition_and_date with p_couriername: ${expedition}, p_selected_date: ${formattedDate}`);
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
    enabled: !!expedition && !showAllExpeditionSummary, // Only enabled if not showing all summaries
  });

  // Query to fetch karung summary directly from database using RPC (for specific expedition)
  const { data: karungSummaryData, isLoading: isLoadingKarungSummary } = useQuery<KarungSummaryItem[]>({
    queryKey: ["karungSummary", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];

      console.log(`RPC Call: get_karung_summary_for_expedition_and_date with p_couriername: ${expedition}, p_selected_date: ${formattedDate}`);
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
    enabled: !!expedition && !showAllExpeditionSummary, // Only enabled if not showing all summaries
  });

  // NEW: Query to fetch ALL karung summaries directly from database using new RPC
  const { data: allKarungSummariesData, isLoading: isLoadingAllKarungSummaries } = useQuery<AllKarungSummaryItem[]>({
    queryKey: ["allKarungSummaries", formattedDate],
    queryFn: async () => {
      console.log(`Fetching allKarungSummaries for date: ${formattedDate}`);
      const { data, error } = await supabase.rpc("get_all_karung_summaries_for_date", {
        p_selected_date: formattedDate,
      });

      if (error) {
        console.error("Error fetching all karung summaries:", error);
        throw error;
      }
      return data || [];
    },
    enabled: showAllExpeditionSummary, // Only enabled when explicitly requested
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

  // NEW: Mapped allKarungSummariesData to match existing structure for modal
  const allExpeditionKarungSummary = React.useMemo(() => {
    return allKarungSummariesData ? allKarungSummariesData.map(item => ({
      expeditionName: item.expedition_name,
      karungNumber: item.karung_number,
      quantity: item.quantity,
    })) : [];
  }, [allKarungSummariesData]);

  // NEW: Derive unique expedition options from allExpedisiDataUnfilteredMap
  const expeditionOptions = React.useMemo(() => {
    const uniqueNames = new Set<string>();
    // Add hardcoded 'ID' first, as it has special handling
    uniqueNames.add("ID"); 

    // Add a console log to check the type of allExpedisiDataUnfilteredMap
    console.log("Type of allExpedisiDataUnfilteredMap:", typeof allExpedisiDataUnfilteredMap, allExpedisiDataUnfilteredMap instanceof Map);

    // Only iterate if it's actually a Map
    if (allExpedisiDataUnfilteredMap instanceof Map) {
      allExpedisiDataUnfilteredMap.forEach(exp => {
        const name = exp.couriername?.trim().toUpperCase();
        if (name) {
          uniqueNames.add(name);
        }
      });
    } else {
      console.warn("allExpedisiDataUnfilteredMap is not a Map instance. It might be a plain object from cache. Forcing refetch.");
      // If it's not a Map, invalidate the query to force a refetch from Supabase
      // This is a fallback for when deserialization fails despite the persister fix.
      // Note: This might cause a brief flicker as data is refetched.
      queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered"] }); // Re-enabled this line
    }

    const sortedNames = Array.from(uniqueNames).sort((a, b) => a.localeCompare(b));
    console.log("Generated expedition options:", sortedNames);
    return sortedNames;
  }, [allExpedisiDataUnfilteredMap, queryClient]); // Added queryClient to dependencies

  return {
    allResiForExpedition, // Now returned
    isLoadingAllResiForExpedition: isLoadingAllResiForExpedition || isLoadingLastKarung || isLoadingKarungSummary || isLoadingAllExpedisiUnfiltered || isLoadingAllResiDataComprehensive || isLoadingAllKarungSummaries, // Combine loading states
    allResiDataComprehensive: allResiDataComprehensiveMap, // NEW: Return comprehensive resi data as Map
    allExpedisiDataUnfiltered: allExpedisiDataUnfilteredMap, // NEW: Return all expedisi data as Map
    currentCount,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
    karungSummary,
    allExpeditionKarungSummary, // NEW: Return all expedition karung summary
    isLoadingKarungSummary,
    isLoadingAllKarungSummaries, // NEW: Loading state for all summaries
    expeditionOptions, // NEW: Return expedition options
  };
};