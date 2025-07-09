import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { fetchAllDataPaginated } from "@/utils/supabaseFetch";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";

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
  karungNumber: string; // Corrected from karung_number
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

  // Fetch unique expedition names
  const { data: uniqueExpeditionNames = [], isLoading: isLoadingExpeditionData } = useQuery<string[]>({
    queryKey: ["uniqueExpeditionNames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("couriername")
        .not("couriername", "is", null);
      if (error) throw error;
      const names = Array.from(new Set(data.map((item) => item.couriername as string))).sort();
      return names;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch karung summary for the selected expedition and date
  const { data: karungSummary = [], isLoading: isLoadingKarungSummary } = useQuery<KarungSummaryItem[]>({
    queryKey: ["karungSummary", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];
      const { data, error } = await supabase.rpc("get_karung_summary_for_expedition_and_date", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      // Map the RPC result to KarungSummaryItem
      return data.map(item => ({
        karungNumber: item.karung_number, // Ensure this matches the RPC function's return
        quantity: item.quantity
      }));
    },
    enabled: !!expedition,
    staleTime: 1000 * 10, // Cache for 10 seconds
  });

  // Fetch all resi for the selected expedition within the last 5 days
  const { data: allResiForExpedition = [], isLoading: isLoadingAllResiForExpedition } = useQuery<ResiExpedisiData[]>({
    queryKey: ["allResiForExpedition", expedition, formattedFiveDaysAgo, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];
      const { data, error } = await supabase.rpc("get_filtered_resi_for_expedition_and_date", {
        p_couriername: expedition,
        p_start_date: `${formattedFiveDaysAgo}T00:00:00Z`,
        p_end_date: `${format(new Date(formattedDate), "yyyy-MM-dd")}T23:59:59Z`,
        p_resi: null,
        p_nokarung: null,
      });
      if (error) throw error;
      return data.map(item => ({
        Resi: item.Resi,
        nokarung: item.nokarung,
        created: item.created,
        Keterangan: item.couriername,
        schedule: item.schedule || null, // Assuming schedule might be part of this or derived
      }));
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
        undefined,
        undefined,
        undefined,
        "resino, couriername, created, flag, cekfu",
        (query) => query.eq("created", formattedDate) // Filter by created date
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
      const { data, error } = await supabase.rpc("get_total_expedition_items_count", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 10,
  });

  // Calculate remaining items (flag 'NO') for the selected expedition and date
  const { data: remainingExpeditionItems, isLoading: isLoadingRemainingExpeditionItems } = useQuery<number>({
    queryKey: ["remainingExpeditionItems", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return 0;
      const { data, error } = await supabase.rpc("get_belum_kirim_expedition_count", {
        p_couriername: expedition,
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!expedition,
    staleTime: 1000 * 10,
  });

  // Fetch ID Rekomendasi scan count for today
  const { data: idExpeditionScanCount, isLoading: isLoadingIdExpeditionScanCount } = useQuery<number>({
    queryKey: ["idExpeditionScanCount", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_id_rekomendasi_count", {
        p_selected_date: formattedDate,
      });
      if (error) throw error;
      return data || 0;
    },
    staleTime: 1000 * 10,
  });

  const currentCount = React.useCallback((karungNumber: string) => {
    return allResiForExpedition.filter(
      (item) => item.nokarung === karungNumber
    ).length;
  }, [allResiForExpedition]);

  const lastKarung = React.useMemo(() => {
    if (!karungSummary || karungSummary.length === 0) return "0";
    const last = karungSummary[karungSummary.length - 1];
    return last.karungNumber;
  }, [karungSummary]);

  const highestKarung = React.useMemo(() => {
    if (!karungSummary || karungSummary.length === 0) return 0;
    const numbers = karungSummary.map(item => parseInt(item.karungNumber, 10)).filter(num => !isNaN(num));
    return numbers.length > 0 ? Math.max(...numbers) : 0;
  }, [karungSummary]);

  return {
    expedition,
    setExpedition,
    selectedKarung,
    setSelectedKarung,
    uniqueExpeditionNames,
    karungSummary,
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