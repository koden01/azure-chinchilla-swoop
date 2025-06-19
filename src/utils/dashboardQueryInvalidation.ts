import { QueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns"; // Import subDays

export const invalidateDashboardQueries = (queryClient: QueryClient, date: Date | undefined, expedition?: string) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd');

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

  // Always invalidate the comprehensive resi data cache, as a resi was deleted/added/updated
  queryClient.invalidateQueries({ queryKey: ["allResiDataComprehensive"] }); // This query key is not used anymore, but keeping it for safety if it's referenced elsewhere.
  queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered"] }); // Also invalidate this as it's used for validation

  // NEW: Invalidate recentResiDataForValidation for local duplicate checks
  const today = new Date();
  const fiveDaysAgo = subDays(today, 4);
  const fiveDaysAgoFormatted = format(fiveDaysAgo, "yyyy-MM-dd");
  queryClient.invalidateQueries({ queryKey: ["recentResiDataForValidation", fiveDaysAgoFormatted, actualCurrentFormattedDate] });
};