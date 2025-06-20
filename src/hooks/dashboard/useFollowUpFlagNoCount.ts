import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const useFollowUpFlagNoCount = () => {
  const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd');

  return useQuery<number>({
    queryKey: ["followUpFlagNoCount", actualCurrentFormattedDate],
    queryFn: async () => {
      const { data: countData, error: rpcError } = await supabase.rpc("get_flag_no_except_today_count", {
        p_selected_date: actualCurrentFormattedDate,
      });
      if (rpcError) {
        console.error("Error fetching Follow Up (Flag NO except today):", rpcError);
        throw rpcError;
      }
      return countData || 0;
    },
    enabled: true, // Always enabled as it's independent of selected date
  });
};