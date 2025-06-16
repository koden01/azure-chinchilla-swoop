import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import React from "react";

interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  couriername: string | null;
}

interface KarungSummaryItem {
  karung_number: string;
  quantity: number;
}

export const useResiInputData = (expedition: string) => {
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");

  // Query to fetch all individual resi for the expedition and date (still needed for lastKarung and potential future needs)
  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];

      const { data, error } = await supabase.rpc("get_resi_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });

      if (error) {
        console.error("Error fetching all resi for expedition:", error);
        throw error;
      }
      return data || [];
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

  // Derive lastKarung from allResiForExpedition (still needs individual records)
  const lastKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return 0;
    const sortedByCreated = [...allResiForExpedition].sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA;
    });
    return parseInt(sortedByCreated[0].nokarung || "0") || 0;
  }, [allResiForExpedition]);

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

  return {
    allResiForExpedition,
    isLoadingAllResiForExpedition,
    currentCount,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
    karungSummary,
    isLoadingKarungSummary, // Expose loading state for karung summary
  };
};