import { QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export const invalidateDashboardQueries = (queryClient: QueryClient, date: Date | undefined) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd');

  queryClient.invalidateQueries({ queryKey: ["transaksiHariIni", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["totalScan", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["idRekCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["followUpFlagNoCount", actualCurrentFormattedDate] });
  queryClient.invalidateQueries({ queryKey: ["scanFollowupLateCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["batalCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["allExpedisiData", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["allResiData", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["karungSummary", formattedDate] }); // NEW: Invalidate karungSummary
  queryClient.invalidateQueries({ queryKey: ["lastKarung", formattedDate] }); // NEW: Invalidate lastKarung
};