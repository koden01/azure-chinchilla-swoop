import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns"; // Import subDays
import React from "react";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";

// Define the type for ResiExpedisiData to match useResiInputData
export interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null;
  schedule: string | null;
  optimisticId?: string;
}

// NEW: Type for all karung summaries
interface AllKarungSummaryItem {
  expedition_name: string;
  karung_number: string;
  quantity: number;
}

export const useResiInputData = (expedition: string, showAllExpeditionSummary: boolean) => {
  const today = new Date();
  const formattedToday = format(today, "yyyy-MM-dd");
  const fiveDaysAgo = subDays(today, 4); // Calculate date 4 days ago for a 5-day range
  const formattedFiveDaysAgo = format(fiveDaysAgo, "yyyy-MM-dd");

  // Query to fetch all resi data for the current expedition and date range for local validation
  const { data: allResiForExpedition, isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedFiveDaysAgo, formattedToday], 
    queryFn: async () => {
      if (!expedition) {
        return [];
      }
      
      const data = await fetchAllDataPaginated(
        "tbl_resi",
        "created",
        fiveDaysAgo, // Use the new start date
        today,      // Use today as the end date
        "Resi, nokarung, created, Keterangan, schedule",
        (baseQuery) => {
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
    staleTime: 1000 * 60 * 5, // Increased staleTime to 5 minutes for 5-day data
  });

  // NEW: Query to fetch karung summary for the selected expedition and today's date
  const { data: karungSummaryData, isLoading: isLoadingKarungSummaryData } = useQuery<{ karung_number: string; quantity: number; }[]>({
    queryKey: ["karungSummary", expedition, formattedToday],
    queryFn: async () => {
      if (!expedition) {
        return [];
      }
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
    enabled: !!expedition,
    staleTime: 1000 * 30,
  });

  // NEW: Query to fetch ALL karung summaries directly from database using new RPC
  const { data: allKarungSummariesData, isLoading: isLoadingAllKarungSummaries } = useQuery<AllKarungSummaryItem[]>({
    queryKey: ["allKarungSummaries", formattedToday],
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
    enabled: showAllExpeditionSummary,
    staleTime: 1000 * 60 * 60,
  });

  // Query to fetch unique expedition names
  const { data: uniqueExpeditionNames, isLoading: isLoadingUniqueExpeditionNames } = useQuery<string[]>({
    queryKey: ["uniqueExpeditionNames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("couriername");

      if (error) {
        console.error("Error fetching unique expedition names:", error);
        throw error;
      }
      
      const namesSet = new Set<string>();
      KNOWN_EXPEDITIONS.forEach(name => namesSet.add(name));
      data.forEach((item: { couriername: string | null }) => {
        if (item.couriername) {
          const normalizedName = normalizeExpeditionName(item.couriername);
          if (normalizedName) {
            namesSet.add(normalizedName);
          }
        }
      });
      
      const names = Array.from(namesSet);
      return names.sort((a, b) => a.localeCompare(b));
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // NEW: Query to get total items for the selected expedition
  const { data: totalExpeditionItems, isLoading: isLoadingTotalExpeditionItems } = useQuery<number>({
    queryKey: ["totalExpeditionItems", expedition, formattedToday],
    queryFn: async () => {
      if (!expedition) return 0;
      const { data: countData, error } = await supabase.rpc("get_total_expedition_items_count", {
        p_couriername: expedition,
        p_selected_date: formattedToday,
      });
      if (error) {
        console.error("Error fetching total expedition items count:", error);
        throw error;
      }
      return countData || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 30,
  });

  // NEW: Query to get remaining items (flag 'NO') for the selected expedition
  const { data: remainingExpeditionItems, isLoading: isLoadingRemainingExpeditionItems } = useQuery<number>({
    queryKey: ["remainingExpeditionItems", expedition, formattedToday],
    queryFn: async () => {
      if (!expedition) return 0;
      const { data: countData, error } = await supabase.rpc("get_belum_kirim_expedition_count", {
        p_couriername: expedition,
        p_selected_date: formattedToday,
      });
      if (error) {
        console.error("Error fetching remaining expedition items count:", error);
        throw error;
      }
      return countData || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 30,
  });

  // NEW: Query to get the specific scan count for 'ID' expedition from tbl_resi
  const { data: idExpeditionScanCount, isLoading: isLoadingIdExpeditionScanCount } = useQuery<number>({
    queryKey: ["idExpeditionScanCount", formattedToday],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("*", { count: "exact" })
        .in("Keterangan", ["ID", "ID_REKOMENDASI"])
        .in("schedule", ["ontime", "idrek"])
        .gte("created", startOfDay(today).toISOString())
        .lt("created", endOfDay(today).toISOString());
      
      if (error) {
        console.error("Error fetching ID expedition scan count:", error);
        throw error;
      }
      return count || 0;
    },
    enabled: expedition === 'ID',
    staleTime: 1000 * 30,
  });

  // Derive currentCount from allResiForExpedition
  const currentCount = React.useCallback((selectedKarung: string) => {
    if (!allResiForExpedition || !selectedKarung) {
      return 0;
    }
    const count = allResiForExpedition.filter(item => 
      item.nokarung === selectedKarung && 
      (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition) &&
      // Filter by today's date
      item.created && new Date(item.created).toDateString() === today.toDateString()
    ).length;
    return count;
  }, [allResiForExpedition, expedition, today]); // Add 'today' to dependencies

  // Derive lastKarung from allResiForExpedition, filtered for today's data
  const lastKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return "0";
    const filteredResi = allResiForExpedition.filter(item => 
      item.nokarung !== null && 
      (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition) &&
      item.created && new Date(item.created).toDateString() === today.toDateString() // Filter for today
    );
    if (filteredResi.length === 0) return "0";

    const sortedResi = [...filteredResi].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    const last = sortedResi[0].nokarung || "0";
    return last;
  }, [allResiForExpedition, expedition, today]); // Add 'today' to dependencies

  // Derive highestKarung from allResiForExpedition, filtered for today's data
  const highestKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return 0;
    const validKarungNumbers = allResiForExpedition
      .filter(item => 
        item.nokarung !== null && 
        (expedition === 'ID' ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI') : item.Keterangan === expedition) &&
        item.created && new Date(item.created).toDateString() === today.toDateString() // Filter for today
      )
      .map(item => parseInt(item.nokarung || "0"))
      .filter(num => !isNaN(num) && num > 0);
    const highest = validKarungNumbers.length > 0 ? Math.max(...validKarungNumbers) : 0;
    return highest;
  }, [allResiForExpedition, expedition, today]); // Add 'today' to dependencies

  // Karung options based on highestKarung (still client-side generation)
  const karungOptions = React.useMemo(() => {
    const maxKarung = Math.max(1, highestKarung, 100);
    const options = Array.from({ length: maxKarung }, (_, i) => (i + 1).toString());
    return options;
  }, [highestKarung]);

  // karungSummary for the modal now directly uses karungSummaryData from RPC
  const karungSummary = React.useMemo(() => {
    const summary = karungSummaryData ? karungSummaryData.map(item => ({
      karungNumber: item.karung_number,
      quantity: item.quantity,
    })) : [];
    return summary;
  }, [karungSummaryData]);

  // NEW: Mapped allKarungSummariesData to match existing structure for modal
  const allExpeditionKarungSummary = React.useMemo(() => {
    const summary = allKarungSummariesData ? allKarungSummariesData.map(item => ({
      expeditionName: item.expedition_name,
      karungNumber: item.karung_number,
      quantity: item.quantity,
    })) : [];
    return summary;
  }, [allKarungSummariesData]);

  const expeditionOptions = React.useMemo(() => {
    const options = uniqueExpeditionNames || [];
    return options;
  }, [uniqueExpeditionNames]);

  return {
    allResiForExpedition,
    isLoadingAllResiForExpedition: isLoadingAllResiForExpedition || isLoadingAllKarungSummaries || isLoadingUniqueExpeditionNames || isLoadingTotalExpeditionItems || isLoadingRemainingExpeditionItems || isLoadingIdExpeditionScanCount,
    currentCount,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate: formattedToday,
    karungSummary,
    allExpeditionKarungSummary,
    isLoadingKarungSummary: isLoadingKarungSummaryData,
    isLoadingAllKarungSummaries,
    expeditionOptions,
    totalExpeditionItems,
    remainingExpeditionItems,
    isLoadingTotalExpeditionItems,
    isLoadingRemainingExpeditionItems,
    idExpeditionScanCount,
    isLoadingIdExpeditionScanCount,
  };
};