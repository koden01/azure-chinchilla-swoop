import { useState, useEffect, useCallback } from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";

interface UseResiInputDataReturn {
  allResiForExpedition: any[];
  currentCount: (karung: string) => number;
  karungOptions: string[];
  expeditionOptions: string[];
  isLoading: boolean;
}

export const useResiInputData = (expedition: string, enabled: boolean): UseResiInputDataReturn => {
  const [karungOptions, setKarungOptions] = useState<string[]>([]);
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");

  const { data: allResiForExpedition, isLoading } = useQuery<any[]>({
    queryKey: ["allResiForExpedition", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return [];
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("*")
        .eq("Keterangan", expedition)
        .eq("created", formattedDate);
      if (error) {
        console.error("Error fetching resi data:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!expedition && enabled,
  });

  const currentCount = useCallback(
    (karung: string) => {
      if (!allResiForExpedition) return 0;
      return allResiForExpedition.filter((resi) => resi.nokarung === karung).length;
    },
    [allResiForExpedition]
  );

  useEffect(() => {
    if (allResiForExpedition) {
      const uniqueKarungs = new Set(allResiForExpedition.map((resi) => resi.nokarung));
      setKarungOptions(["1", "2", "3", "4", "5", ...Array.from(uniqueKarungs).filter(Boolean)]);
    }
  }, [allResiForExpedition]);

  const expeditionOptions = ["ID", "JNE", "SPX", "SICEPAT", "JNT"];

  return {
    allResiForExpedition: allResiForExpedition || [],
    currentCount,
    karungOptions,
    expeditionOptions,
    isLoading,
  };
};