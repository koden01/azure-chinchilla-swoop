import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { normalizeExpeditionName, KNOWN_EXPEDITIONS } from "@/utils/expeditionUtils";
import { supabase } from "@/integrations/supabase/client";
import { usePendingOperations } from "@/hooks/usePendingOperations";

// Import base data hooks
import { useFollowUpRecords } from "./useFollowUpRecords";
import { useExpedisiRecordsForSelectedDate } from "./useExpedisiRecordsForSelectedDate";
import { useAllResiRecords } => {
  const formattedDate = date ? date.toISOString().split('T')[0] : ""; // Use date part for query key

  return useQuery<any[]>({
    queryKey: ["allResiData", formattedDate],
    queryFn: async () => {
      if (!date) return [];
      const data = await fetchAllDataPaginated("tbl_resi", "created", date, date);
      console.log(`[useAllResiRecords] Fetched allResiData for ${formattedDate}:`, data); // Added debug log
      return data;
    },
    enabled: !!date,
  });
};