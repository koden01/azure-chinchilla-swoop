import { useQuery, /* useQueryClient */ } from "@tanstack/react-query"; // Menghapus useQueryClient karena tidak digunakan
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

// Menghapus interface ExpedisiData karena tidak lagi digunakan
// interface ExpedisiData {
//   resino: string;
//   orderno: string | null;
//   chanelsales: string | null;
//   couriername: string | null;
//   created: string;
//   flag: string | null;
//   datetrans: string | null;
//   cekfu: boolean | null;
// }

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
  // Menghapus queryClient karena tidak digunakan
  // const queryClient = useQueryClient(); 

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

  // Query to fetch unique expedition names
  const { data: uniqueExpeditionNames, isLoading: isLoadingUniqueExpeditionNames } = useQuery<string[]>({
    queryKey: ["uniqueExpeditionNames"],
    queryFn: async () => {
      console.log("Fetching unique expedition names from tbl_expedisi.");
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("couriername"); 

      if (error) {
        console.error("Error fetching unique expedition names:", error);
        throw error;
      }
      
      // Buat Set baru dan tambahkan 'ID' terlebih dahulu, lalu tambahkan nama kurir dari data
      const namesSet = new Set<string>();
      namesSet.add("ID"); // Pastikan 'ID' selalu ada dan hanya sekali
      data.forEach((item: { couriername: string | null }) => {
        if (item.couriername) {
          namesSet.add(item.couriername.trim().toUpperCase());
        }
      });
      
      const names = Array.from(namesSet);
      return names.sort((a, b) => a.localeCompare(b));
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour, these don't change often
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
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

  const expeditionOptions = React.useMemo(() => {
    return uniqueExpeditionNames || [];
  }, [uniqueExpeditionNames]);

  return {
    allResiForExpedition, // Now returned
    isLoadingAllResiForExpedition: isLoadingAllResiForExpedition || isLoadingLastKarung || isLoadingKarungSummary || isLoadingAllKarungSummaries || isLoadingUniqueExpeditionNames, // Combine loading states
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