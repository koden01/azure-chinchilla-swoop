import { QueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns"; // Import subDays

export const invalidateDashboardQueries = (queryClient: QueryClient, date: Date | undefined, expedition?: string) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const actualCurrentDate = new Date();
  const actualCurrentFormattedDate = format(actualCurrentDate, 'yyyy-MM-dd');

  // Calculate date range for "today and yesterday" for relevant invalidations
  const yesterday = subDays(actualCurrentDate, 1); 
  const yesterdayFormatted = format(yesterday, "yyyy-MM-dd");
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

  // Invalidate the allExpedisiDataUnfiltered query with its new key (today and yesterday range)
  queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", yesterdayFormatted, endOfTodayFormatted] });

  // Invalidate recentResiNumbersForValidation for local duplicate checks (today and yesterday range)
  queryClient.invalidateQueries({ queryKey: ["recentResiNumbersForValidation", yesterdayFormatted, actualCurrentFormattedDate] });

  // NEW: Invalidate the allFlagNoExpedisiData query
  queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });

  // Also invalidate the followUpFlagNoCount which is global (except today)
  queryClient.invalidateQueries({ queryKey: ["followUpFlagNoCount", actualCurrentFormattedDate] });
};