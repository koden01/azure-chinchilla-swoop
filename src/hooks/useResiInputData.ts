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

export const useResiInputData = (expedition: string) => {
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");

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

  const currentCount = React.useCallback((selectedKarung: string) => {
    if (!allResiForExpedition || !selectedKarung) return 0;
    return allResiForExpedition.filter(
      (item) => item.nokarung === selectedKarung
    ).length;
  }, [allResiForExpedition]);

  const lastKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return 0;
    const sortedByCreated = [...allResiForExpedition].sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA;
    });
    return parseInt(sortedByCreated[0].nokarung || "0") || 0;
  }, [allResiForExpedition]);

  const highestKarung = React.useMemo(() => {
    if (!allResiForExpedition || allResiForExpedition.length === 0) return 0;
    const validKarungNumbers = allResiForExpedition
      .map(item => parseInt(item.nokarung || "0"))
      .filter(num => !isNaN(num) && num > 0);
    return validKarungNumbers.length > 0 ? Math.max(...validKarungNumbers) : 0;
  }, [allResiForExpedition]);

  const karungOptions = React.useMemo(() => {
    const maxKarung = Math.max(1, highestKarung, 100);
    return Array.from({ length: maxKarung }, (_, i) => (i + 1).toString());
  }, [highestKarung]);

  const karungSummary = React.useMemo(() => {
    if (!allResiForExpedition) return [];
    const summary: { [key: string]: number } = {};
    allResiForExpedition.forEach(item => {
      if (item.nokarung) {
        summary[item.nokarung] = (summary[item.nokarung] || 0) + 1;
      }
    });
    return Object.keys(summary)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(karungNumber => ({
        karungNumber,
        quantity: summary[karungNumber],
      }));
  }, [allResiForExpedition]);

  return {
    allResiForExpedition,
    isLoadingAllResiForExpedition,
    currentCount,
    lastKarung,
    highestKarung,
    karungOptions,
    formattedDate,
    karungSummary, // Return the new karungSummary
  };
};