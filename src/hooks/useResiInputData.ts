import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import React from "react";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils"; // Import new utility

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
      return data || [];
    },
    enabled: !!expedition,
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
    enabled: !!expedition && !showAllExpeditionSummary, // Only enabled if not showing all summaries
  });

  // Query to fetch karung summary directly from database using RPC (for specific expedition)
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
    enabled: !!expedition && !showAllExpeditionSummary, // Only enabled if not showing all summaries
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
      return data || [];
    },
    enabled: showAllExpeditionSummary, // Only enabled when explicitly requested
  });

  // Query to fetch unique expedition names
  const { data: uniqueExpeditionNames, isLoading: isLoadingUniqueExpeditionNames } = useQuery<string[]>({
    queryKey: ["uniqueExpeditionNames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("couriername")
        .distinct(); // Corrected: Call distinct as a method

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
    staleTime: 1000 * 60 * 60 * 24, // Changed to 24 hours
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