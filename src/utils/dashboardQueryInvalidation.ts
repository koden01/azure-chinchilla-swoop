import { QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export const invalidateDashboardQueries = (queryClient: QueryClient, date: Date | undefined, expedition?: string) => {
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const actualCurrentDate = new Date();
  const actualCurrentFormattedDate = format(actualCurrentDate, 'yyyy-MM-dd');

  // Invalidate dashboard summary queries for the specific date provided (dateOfDeletedResi)
  // These are usually tied to a specific date.
  queryClient.invalidateQueries({ queryKey: ["transaksiHariIni", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["totalScan", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["idRekCount", formattedDate] }); // This is for Dashboard page
  queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["scanFollowupLateCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["batalCount", formattedDate] });
  queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });

  // Invalidate date-specific data queries, but make them non-exact to catch any date
  queryClient.invalidateQueries({ queryKey: ["expedisiDataForSelectedDate"], exact: false });
  queryClient.invalidateQueries({ queryKey: ["allResiData"], exact: false });
  
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
    // Menambahkan invalidasi untuk query Input page yang relevan
    queryClient.invalidateQueries({ queryKey: ["idExpeditionScanCount", formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["totalExpeditionItems", normalizedExpeditionForInput, formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["remainingExpeditionItems", normalizedExpeditionForInput, formattedDate] });
  }

  // Invalidate the allExpedisiDataUnfiltered query with its new key (only today)
  queryClient.invalidateQueries({ queryKey: ["allExpedisiDataUnfiltered", actualCurrentFormattedDate] });

  // Invalidate the allFlagNoExpedisiData query
  queryClient.invalidateQueries({ queryKey: ["allFlagNoExpedisiData"] });

  // Also invalidate the followUpFlagNoCount which is global (except today)
  queryClient.invalidateQueries({ queryKey: ["followUpFlagNoCount", actualCurrentFormattedDate] });

  // NEW: Invalidate allFlagYesExpedisiResiNumbers to ensure duplicate check is accurate after deletion
  queryClient.invalidateQueries({ queryKey: ["allFlagYesExpedisiResiNumbers"] });
};