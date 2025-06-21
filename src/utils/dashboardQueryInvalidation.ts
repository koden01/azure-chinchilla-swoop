import { QueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns"; // Import subDays

export const invalidateDashboardQueries = (queryClient: QueryClient, date: Date | undefined, expedition?: string) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const actualCurrentDate = new Date();
  const actualCurrentFormattedDate = format(actualCurrentDate, 'yyyy-MM-dd');

  // Calculate date range for 3 days (today and 2 days prior) for allExpedisiDataUnfiltered invalidation
  const twoDaysAgo = subDays(actualCurrentDate, 2); // Covers today, yesterday, and the day before yesterday
  const twoDaysAgoFormatted = format(twoDaysAgo, "yyyy-MM-dd");
  const endOfTodayFormatted = format(actualCurrentDate, "yyyy-MM-dd");

  // Invalidate dashboard summary queries for the specific date provided (dateOfDeletedResi)
  // These are usually tied to a specific date.
  queryClient.invalidateQueries({ queryKey: ["transaksiHariIni", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["totalScan", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["idRekCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["scanFollowupLateCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["batalCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });

  // Invalidate date-specific data queries, but make them non-exact to catch any date
  // This is the key change for the bug fix.
  queryClient.invalidateQueries({ queryKey: ["expedisiDataForSelectedDate"], exact: false }); // Invalidate for any date
  queryClient.invalidateQueries({ queryKey: ["allResiData"], exact: false }); // Invalidate for any date
  
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

  // Invalidate the allExpedisiDataUnfiltered query with its new key (3-day range)
  queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted] });

  // Invalidate recentResiNumbersForValidation for local duplicate checks (3-day range)
  queryClient.invalidateQueries({ queryKey: ["recentResiNumbersForValidation", twoDaysAgoFormatted, actualCurrentFormattedDate] });

  // NEW: Invalidate the allFlagNoExpedisiData query
  queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });

  // Also invalidate the followUpFlagNoCount which is global (except today)
  queryClient.invalidateQueries({ queryKey: ["followUpFlagNoCount", actualCurrentFormattedDate] });
};