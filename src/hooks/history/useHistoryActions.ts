import { useState, useCallback, useRef } from "react";
import { useQueryClient, QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { flexRender } from "@tanstack/react-table";
import { HistoryData } from "@/components/columns/historyColumns";
import { Table as ReactTableType } from "@tanstack/react-table";

interface UseHistoryActionsProps {
  historyData: HistoryData[] | undefined;
  formattedStartDate: string;
  formattedEndDate: string;
  table: ReactTableType<HistoryData>;
}

export const useHistoryActions = ({ historyData, formattedStartDate, formattedEndDate, table }: UseHistoryActionsProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [resiToDelete, setResiToDelete] = useState<string | null>(null);
  const [lastClickInfo, setLastClickInfo] = useState<{ resi: string | null; timestamp: number | null } | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClient = useQueryClient();

  const handleDeleteClick = useCallback((resi: string) => {
    setResiToDelete(resi);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleRowClick = useCallback((resi: string) => {
    const now = Date.now();

    if (lastClickInfo && lastClickInfo.resi === resi && (now - lastClickInfo.timestamp!) < 300) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      setLastClickInfo(null);
      handleDeleteClick(resi);
    } else {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      setLastClickInfo({ resi, timestamp: now });
      clickTimeoutRef.current = setTimeout(() => {
        setLastClickInfo(null);
      }, 300);
    }
  }, [lastClickInfo, handleDeleteClick]);

  const confirmDeleteResi = useCallback(async () => {
    if (!resiToDelete) return;

    const itemToDelete = historyData?.find(item => item.Resi === resiToDelete);
    const dateOfDeletedResi = itemToDelete ? new Date(itemToDelete.created) : undefined;
    const expeditionOfDeletedResi = itemToDelete?.Keterangan || undefined;

    // Optimistically remove from historyData cache for any active history queries
    queryClient.setQueriesData({
      queryKey: ["historyData"],
      exact: false,
      updater: (oldData: HistoryData[] | undefined, queryKey: QueryKey) => {
        if (!oldData) return undefined;

        const [, queryStartDateStr, queryEndDateStr] = queryKey;
        const queryStartDate = queryStartDateStr ? new Date(queryStartDateStr as string) : undefined;
        const queryEndDate = queryEndDateStr ? new Date(queryEndDateStr as string) : undefined;

        const affectedResiCreatedDate = itemToDelete?.created ? new Date(itemToDelete.created) : undefined;

        const isAffectedDateIncluded = affectedResiCreatedDate && queryStartDate && queryEndDate &&
                                       isWithinInterval(affectedResiCreatedDate, { start: startOfDay(queryStartDate), end: endOfDay(queryEndDate) });

        if (isAffectedDateIncluded) {
          return oldData.filter(item => item.Resi !== resiToDelete);
        }
        return oldData;
      },
    });

    try {
      const { error } = await supabase
        .from("tbl_resi")
        .delete()
        .eq("Resi", resiToDelete);

      if (error) {
        showError(`Gagal menghapus resi ${resiToDelete}: ${error.message}`);
        console.error("Error deleting resi:", error);
        // Revert optimistic update on error
        queryClient.invalidateQueries({ queryKey: ["historyData"] });
      } else {
        showSuccess(`Resi ${resiToDelete} berhasil dihapus.`);

        // Invalidate other relevant queries (dashboard, input page)
        await queryClient.refetchQueries({ queryKey: ["allResiForExpedition"], exact: false });
        await queryClient.refetchQueries({ queryKey: ["allResiData"] }); 
        invalidateDashboardQueries(queryClient, dateOfDeletedResi, expeditionOfDeletedResi); 
      }
    } catch (error: any) {
      showError(`Gagal menghapus resi ${resiToDelete}: ${error.message || "Silakan coba lagi."}`);
      console.error("Error deleting resi (outer catch):", error);
      // Ensure optimistic update is reverted if an unexpected error occurs
      queryClient.invalidateQueries({ queryKey: ["historyData"] });
    } finally {
      setIsDeleteDialogOpen(false);
      setResiToDelete(null);
    }
  }, [resiToDelete, historyData, queryClient]);

  const handleCopyTableData = useCallback(async () => {
    const rowsToCopy = table.getFilteredRowModel().rows;
    if (rowsToCopy.length === 0) {
      showError("Tidak ada data untuk disalin.");
      return;
    }

    const headers = table.getHeaderGroups()[0].headers
      .filter(header => header.id !== "actions") // Exclude the "Aksi" column
      .map(header => flexRender(header.column.columnDef.header, header.getContext()));
    const headerRow = headers.join('\t');

    const dataRows = rowsToCopy.map(row => {
      const rowValues = row.getVisibleCells()
        .filter(cell => cell.column.id !== "actions") // Exclude the "Aksi" column
        .map(cell => {
          if (cell.column.id === "created") {
            const dateValue = cell.getValue() as string;
            return format(new Date(dateValue), "dd/MM/yyyy HH:mm");
          }
          return String(cell.getValue() || "");
        });
      return rowValues.join('\t');
    }).join('\n');

    const textToCopy = `${headerRow}\n${dataRows}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      showSuccess(`Berhasil menyalin ${rowsToCopy.length} baris data!`);
    } catch (err: any) {
      showError(`Gagal menyalin data tabel: ${err.message || "Unknown error"}`);
      console.error("Failed to copy table data:", err);
    }
  }, [table]);

  return {
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    resiToDelete,
    setResiToDelete,
    handleDeleteClick,
    handleRowClick,
    confirmDeleteResi,
    handleCopyTableData,
  };
};