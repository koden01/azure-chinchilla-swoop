import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import React from "react";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";

// Define the type for ResiExpedisiData to match useResiInputData
interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null; // Changed to Keterangan to match tbl_resi
  schedule: string | null;
  optimisticId?: string; // Added for optimistic updates
}

// NEW: Type for all karung summaries
interface AllKarungSummaryItem {
  expedition_name: string;
  karung_number: string;
  quantity: number;
}

export const useResiInputData = (expedition: string, showAllExpeditionSummary: boolean) => {
  const today = new Date();
  // Menghapus 'yesterday' karena currentCount hanya akan menampilkan data hari ini
  const formattedToday = format(today, "yyyy-MM-dd"); // Use for query key

  // Query to fetch all resi data for the current expedition and date range for local validation
  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    // Mengubah queryKey agar hanya bergantung pada tanggal hari ini
    queryKey: ["allResiForExpedition", expedition, formattedToday], 
    queryFn: async () => {
      if (!expedition) return [];
      
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // dateFilterColumn
        today, // selectedStartDate (fetch only from today)
        today, // selectedEndDate (fetch only up to end of today)
        "Resi, nokarung, created, Keterangan, schedule", // Only select necessary columns
        (baseQuery) => { // Custom filter function
          if (expedition === 'ID') {
            return baseQuery.in("Keterangan", ['ID', 'ID_REKOMENDASI']);
          } else {
            return baseQuery.eq("Keterangan", expedition);
          }
        }
      );
      return data || [];
    },
    enabled: !!expedition,
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });

  // NEW: Query to fetch karung summary for the selected expedition and today's date
  const { data: karungSummaryData, isLoading: isLoadingKarungSummaryData } = useQuery<{ karung_number: string; quantity: number; }[]>({
    queryKey: ["karungSummary", expedition, formattedToday],
    queryFn: async () => {
      if (!expedition) return [];
      const { data, error } = await supabase.rpc("get_karung_summary_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedToday,
      });

      if (error) {
        console.error("Error fetching karung summary for expedition:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!expedition, // Only enabled if an expedition is selected
    staleTime: 1000 * 30, // Data considered fresh for 30 seconds
  });

  // NEW: Query to fetch ALL karung summaries directly from database using new RPC
  const { data: allKarungSummariesData, isLoading: isLoadingAllKarungSummaries } = useQuery<AllKarungSummaryItem[]>({
    queryKey: ["allKarungSummaries", formattedToday], // Still only for today's summary
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_karung_summaries_for_date", {
        p_selected_date: formattedToday,
      });

      if (error) {
        console.error("Error fetching all karung summaries:", error);
        throw error;
      }
      return data || [];
    },
    enabled: showAllExpeditionSummary, // Only enabled when explicitly requested
    staleTime: 1000 * 60 * 60, // Changed to 60 minutes (from 1 minute)
  });

  // Query to fetch unique expedition names
  const { data: uniqueExpeditionNames, isLoading: isLoadingUniqueExpeditionNames } = useQuery<string[]>({
    queryKey: ["uniqueExpeditionNames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("couriername"); // Fetch all couriername values, then process distinctness in JS

      if (error) {
        console.error("Error fetching unique expedition names:", error);
        throw error;
      }
      
      const namesSet = new Set<string>();
      KNOWN_EXPEDITIONS.forEach(name => namesSet.add(name)); // Add all known expeditions first
      data.forEach((item: { couriername: string | null }) => {
        if (item.couriername) {
          const normalizedName = normalizeExpeditionName(item.couriername); // Use normalizeExpeditionName
          if (normalizedName) {
            namesSet.add(normalizedName);
          }
        }
      });
      
      const names = Array.from(namesSet);
      return names.sort((a, b) => a.localeCompare(b));
    },
    staleTime: Infinity, // Data is always fresh
    gcTime: 1000 * 60 * 60 * 24 * 7, // Garbage collect after 7 days
    refetchOnMount: false, // Do not refetch on component mount
    refetchOnWindowFocus: false, // Do not refetch on window focus
  });

  // Derive currentCount from allResiForExpedition
  const currentCount = React.useCallback((selectedKarung: string) => {
    if (!allResiForExpedition || !selectedKarung) return 0;
    const count = allResiForExpedition.filter(item => 
      item.nokarung === selectedKarung && 
      (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition)
    ).length;
    return count;
  }, [allResiForExpedition, expedition]);

  // Derive lastKarung from allResiForExpedition
  const lastKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return "0";
    const filteredResi = allResiForExpedition.filter(item => 
      item.nokarung !== null && 
      (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition)
    );
    if (filteredResi.length === 0) return "0";

    const sortedResi = [...filteredResi].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    return sortedResi[0].nokarung || "0";
  }, [allResiForExpedition, expedition]);

  // Derive highestKarung from allResiForExpedition
  const highestKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return 0;
    const validKarungNumbers = allResiForExpedition
      .filter(item => 
        item.nokarung !== null && 
        (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition)
      )
      .map(item => parseInt(item.nokarung || "0"))
      .filter(num => !isNaN(num) && num > 0);
    return validKarungNumbers.length > 0 ? Math.max(...validKarungNumbers) : 0;
  }, [allResiForExpedition, expedition]);

  // Karung options based on highestKarung (still client-side generation)
  const karungOptions = React.useMemo(() => {
    const maxKarung = Math.max(1, highestKarung, 100); // Ensure at least 1 and up to 100 by default
    return Array.from({ length: maxKarung }, (_, i) => (i + 1).toString());
  }, [highestKarung]);

  // karungSummary for the modal now directly uses karungSummaryData from RPC
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
    isLoadingAllResiForExpedition: isLoadingAllResiForExpedition || isLoadingAllKarungSummaries || isLoadingUniqueExpeditionNames, // Combine loading states
    currentCount,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate: formattedToday,
    karungSummary, // Now directly from RPC
    allExpeditionKarungSummary, // NEW: Return all expedition karung summary
    isLoadingKarungSummary: isLoadingKarungSummaryData, // Now depends on the new RPC query
    isLoadingAllKarungSummaries, // NEW: Loading state for all summaries
    expeditionOptions, // NEW: Return expedition options
  };
};