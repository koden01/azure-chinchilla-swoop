import { QueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns"; // Import subDays

export const invalidateDashboardQueries = (queryClient: QueryClient, date: Date | undefined, expedition?: string) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const actualCurrentDate = new Date();
  const actualCurrentFormattedDate = format(actualCurrentDate, 'yyyy-MM-dd');

  // Calculate date range for 5 days back for allExpedisiDataUnfiltered invalidation
  const fiveDaysAgo = subDays(actualCurrentDate, 4);
  const fiveDaysAgoFormatted = format(fiveDaysAgo, "yyyy-MM-dd");
  const endOfTodayFormatted = format(actualCurrentDate, "yyyy-MM-dd");

  // Invalidate dashboard summary queries
  queryClient.invalidateQueries({ queryKey: ["transaksiHariIni", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["totalScan", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["idRekCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["followUpFlagNoCount", actualCurrentFormattedDate] });
  queryClient.invalidateQueries({ queryKey: ["scanFollowupLateCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["batalCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["expedisiDataForSelectedDate", formattedDate] }); // This is expedisiDataForSelectedDate
  queryClient.invalidateQueries({ queryKey: ["allResiData", formattedDate] }); // This is allResiData for selected date
  
  // Invalidate queries specific to the Input page and comprehensive data
  // Normalize expedition name for invalidation if it's ID_REKOMENDASI, as Input page treats it as 'ID'
  let normalizedExpeditionForInput: string | undefined = expedition;
  if (expedition === 'ID_REKOMENDASI') {
    normalizedExpeditionForInput = 'ID';
  }

  if (normalizedExpeditionForInput) {
    queryClient.invalidateQueries({ queryKey: ["karungSummary", normalizedExpeditionForInput, formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["lastKarung", normalizedExpeditionForInput, formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["allResiForExpedition", normalizedExpeditionForInput, formattedDate] });
  }

  // Invalidate the allExpedisiDataUnfiltered query with its new key
  queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", fiveDaysAgoFormatted, endOfTodayFormatted] });

  // Invalidate recentResiDataForValidation for local duplicate checks
  queryClient.invalidateQueries({ queryKey: ["recentResiDataForValidation", fiveDaysAgoFormatted, actualCurrentFormattedDate] });
};