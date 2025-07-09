import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns"; // Added startOfDay, endOfDay
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";

// Define the structure for data returned from tbl_resi for display
export interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string; // ISO string
  Keterangan: string | null;
  schedule: string | null;
}

// Define the structure for karung summary items
interface KarungSummaryItem {
  karungNumber: string;
  quantity: number;
}

// Define the return type for the useResiInputData hook
export interface UseResiInputDataReturn {
  expedition: string;
  setExpedition: React.Dispatch<React.SetStateAction<string>>;
  selectedKarung: string;
  setSelectedKarung: React.Dispatch<React.SetStateAction<string>>;
  uniqueExpeditionNames: string[];
  karungSummary: KarungSummaryItem[];
  allResiForExpedition: ResiExpedisiData[];
  allExpedisiDataUnfiltered: Map<string, any> | undefined;
  totalExpeditionItems: number | undefined;
  remainingExpeditionItems: number | undefined;
  idExpeditionScanCount: number | undefined;
  isLoadingExpeditionData: boolean;
  isLoadingKarungSummary: boolean;
  isLoadingAllResiForExpedition: boolean;
  isLoadingAllExpedisiDataUnfiltered: boolean;
  isLoadingTotalExpeditionItems: boolean;
  isLoadingRemainingExpeditionItems: boolean;
  isLoadingIdExpeditionScanCount: boolean;
  currentCount: (selectedKarung: string) => number;
  lastKarung: string;
  highestKarung: number;
}

interface UseResiInputDataProps {
  formattedDate: string;
  formattedFiveDaysAgo: string;
}

export const useResiInputData = ({ formattedDate, formattedFiveDaysAgo }: UseResiInputDataProps): UseResiInputDataReturn => {
  const [expedition, setExpedition] = React.useState<string>("");
  const [selectedKarung, setSelectedKarung] = React.useState<string>("");
  const today = new Date(); // Define today here as it's used in queries

  // Fetch unique expedition names
  const { data: uniqueExpeditionNames = [], isLoading: isLoadingExpeditionData } = useQuery<string[]>({
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

  // Query to fetch karung summary for the selected expedition and today's date
  const { data: karungSummaryData, isLoading: isLoadingKarungSummary } = useQuery<{ karung_number: string; quantity: number; }[]>({
    queryKey: ["karungSummary", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) {
        return [];
      }
      const { data, error } = await supabase.rpc("get_karung_summary_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
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

  // Query to fetch all resi data for the current expedition and date range for local validation
  const { data: allResiForExpedition = [], isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedFiveDaysAgo, formattedDate], 
    queryFn: async () => {
      if (!expedition) {
        return [];
      }
      
      // Using the RPC function that takes p_selected_date (single date)
      const { data, error } = await supabase.rpc("get_filtered_resi_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate, // Use formattedDate for single day filter
        p_resi: null,
        p_nokarung: null,
      });

      if (error) {
        console.error("Error fetching filtered resi for expedition and date:", error);
        throw error;
      }
      return data.map(item => ({
        Resi: item.Resi,
        nokarung: item.nokarung,
        created: item.created,
        Keterangan: item.couriername,
        schedule: item.schedule || null, // Assuming schedule might be part of this or derived
      })) || [];
    },
    enabled: !!expedition,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch all expedisi data (flag 'YES' or 'NO') for today
  const { data: allExpedisiDataUnfiltered, isLoading: isLoadingAllExpedisiDataUnfiltered } = useQuery<Map<string, any>>({
    queryKey: ["allExpedisiDataUnfiltered", formattedDate],
    queryFn: async () => {
      const data = await fetchAllDataPaginated(
        "tbl_expedisi",
        "created", // Filter by created column
        today, // Start date
        today, // End date
        "resino, couriername, created, flag, cekfu"
      );
      const expedisiMap = new Map<string, any>();
      data.forEach(item => {
        if (item.resino) {
          expedisiMap.set(item.resino.toLowerCase(), item);
        }
      });
      return expedisiMap;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  });

  // Fetch total expedition items for the selected expedition and date
  const { data: totalExpeditionItems, isLoading: isLoadingTotalExpeditionItems } = useQuery<number>({
    queryKey: ["totalExpeditionItems", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return 0;
      const { data: countData, error } = await supabase.rpc("get_total_expedition_items_count", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching total expedition items count:", error);
        throw error;
      }
      return countData || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 10,
  });

  // Calculate remaining items (flag 'NO') for the selected expedition and date
  const { data: remainingExpeditionItems, isLoading: isLoadingRemainingExpeditionItems } = useQuery<number>({
    queryKey: ["remainingExpeditionItems", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return 0;
      const { data: countData, error } = await supabase.rpc("get_belum_kirim_expedition_count", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) {
        console.error("Error fetching remaining expedition items count:", error);
        throw error;
      }
      return countData || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 10,
  });

  // Fetch ID Rekomendasi scan count for today
  const { data: idExpeditionScanCount, isLoading: isLoadingIdExpeditionScanCount } = useQuery<number>({
    queryKey: ["idExpeditionScanCount", formattedDate],
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
    staleTime: 1000 * 10,
  });

  const currentCount = React.useCallback((karungNumber: string) => {
    return allResiForExpedition.filter(
      (item) => item.nokarung === karungNumber
    ).length;
  }, [allResiForExpedition]);

  const lastKarung = React.useMemo(() => {
    if (!karungSummaryData || karungSummaryData.length === 0) return "0";
    const last = karungSummaryData[karungSummaryData.length - 1];
    return last.karung_number; // Use karung_number from RPC result
  }, [karungSummaryData]);

  const highestKarung = React.useMemo(() => {
    if (!karungSummaryData || karungSummaryData.length === 0) return 0;
    const numbers = karungSummaryData.map(item => parseInt(item.karung_number, 10)).filter(num => !isNaN(num));
    return numbers.length > 0 ? Math.max(...numbers) : 0;
  }, [karungSummaryData]);

  // Map karungSummaryData to KarungSummaryItem for consistent return type
  const karungSummaryMapped = React.useMemo(() => {
    return karungSummaryData ? karungSummaryData.map(item => ({
      karungNumber: item.karung_number,
      quantity: item.quantity,
    })) : [];
  }, [karungSummaryData]);

  return {
    expedition,
    setExpedition,
    selectedKarung,
    setSelectedKarung,
    uniqueExpeditionNames,
    karungSummary: karungSummaryMapped, // Return the mapped version
    allResiForExpedition,
    allExpedisiDataUnfiltered,
    totalExpeditionItems,
    remainingExpeditionItems,
    idExpeditionScanCount,
    isLoadingExpeditionData,
    isLoadingKarungSummary,
    isLoadingAllResiForExpedition,
    isLoadingAllExpedisiDataUnfiltered,
    isLoadingTotalExpeditionItems,
    isLoadingRemainingExpeditionItems,
    isLoadingIdExpeditionScanCount,
    currentCount,
    lastKarung,
    highestKarung,
  };
};