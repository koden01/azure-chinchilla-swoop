import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import React from "react";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils"; // Import new utility

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
  const formattedDate = format(today, "yyyy-MM-dd");

  // Query to fetch all resi data for the current expedition and date for local validation
  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];
      
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created", // dateFilterColumn
        today, // selectedStartDate
        today, // selectedEndDate
        "Resi, nokarung, created, Keterangan, schedule", // Only select necessary columns
        (baseQuery) => { // Custom filter function
          if (expedition === 'ID') {
            return baseQuery.in("Keterangan", ['ID', 'ID_REKOMENDASI']);
          } else {
            return baseQuery.eq("Keterangan", expedition);
          }
        }
      );
      console.log(`[useResiInputData] Fetched allResiForExpedition for ${expedition} on ${formattedDate}:`, data);
      return data || [];
    },
    enabled: !!expedition,
    staleTime: 1000 * 60 * 60, // Changed to 60 minutes (from 1 minute)
  });

  // NEW: Query to fetch ALL karung summaries directly from database using new RPC
  const { data: allKarungSummariesData, isLoading: isLoadingAllKarungSummaries } = useQuery<AllKarungSummaryItem[]>({
    queryKey: ["allKarungSummaries", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_karung_summaries_for_date", {
        p_selected_date: formattedDate,
      });

      if (error) {
        console.error("Error fetching all karung summaries:", error);
        throw error;
      }
      console.log(`[useResiInputData] Fetched allKarungSummariesData for ${formattedDate}:`, data);
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
      console.log("[useResiInputData] Fetched uniqueExpeditionNames:", names);
      return names.sort((a, b) => a.localeCompare(b));
    },
    staleTime: 1000 * 60 * 60 * 24, // Changed to 24 hours
    gcTime: 1000 * 60 * 60 * 24, // Garbage collect after 24 hours
  });

  // Derive currentCount from allResiForExpedition
  const currentCount = React.useCallback((selectedKarung: string) => {
    if (!allResiForExpedition || !selectedKarung) return 0;
    const count = allResiForExpedition.filter(item => 
      item.nokarung === selectedKarung && 
      (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition)
    ).length;
    console.log(`[useResiInputData] Recalculating currentCount for karung ${selectedKarung}. New count: ${count}. allResiForExpedition length: ${allResiForExpedition.length}`);
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

  // karungSummary is now derived from allResiForExpedition
  const karungSummary = React.useMemo(() => {
    if (!allResiForExpedition) return [];

    const summaryMap = new Map<string, number>();
    allResiForExpedition.forEach(item => {
      if (item.nokarung !== null && (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition)) {
        const currentCount = summaryMap.get(item.nokarung) || 0;
        summaryMap.set(item.nokarung, currentCount + 1);
      }
    });

    const sortedSummary = Array.from(summaryMap.entries())
      .map(([karungNumber, quantity]) => ({ karungNumber, quantity }))
      .sort((a, b) => parseInt(a.karungNumber) - parseInt(b.karungNumber)); // Sort numerically

    console.log(`[useResiInputData] Derived karungSummary from cache:`, sortedSummary);
    return sortedSummary;
  }, [allResiForExpedition, expedition]);

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
    formattedDate,
    karungSummary,
    allExpeditionKarungSummary, // NEW: Return all expedition karung summary
    isLoadingKarungSummary: isLoadingAllResiForExpedition, // Now depends on allResiForExpedition
    isLoadingAllKarungSummaries, // NEW: Loading state for all summaries
    expeditionOptions, // NEW: Return expedition options
  };
};