import React, { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { format } from "date-fns"; 
import { flexRender } from "@tanstack/react-table"; // Corrected import for flexRender
import { HistoryData } from "@/components/columns/historyColumns"; // Import HistoryData type
import { Table as ReactTableType } from "@tanstack/react-table"; // Import Table type

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

    const { error } = await supabase
      .from("tbl_resi")
      .delete()
      .eq("Resi", resiToDelete);

    if (error) {
      showError(`Gagal menghapus resi ${resiToDelete}: ${error.message}`);
      console.error("Error deleting resi:", error);
    } else {
      showSuccess(`Resi ${resiToDelete} berhasil dihapus.`);

      await queryClient.refetchQueries({ queryKey: ["historyData", formattedStartDate, formattedEndDate] });

      await queryClient.refetchQueries({
        queryKey: ["allResiForExpedition"],
        exact: false,
      });

      await queryClient.refetchQueries({ queryKey: ["allResiDataComprehensive"] });

      invalidateDashboardQueries(queryClient, dateOfDeletedResi, expeditionOfDeletedResi); 
    }
    setIsDeleteDialogOpen(false);
    setResiToDelete(null);
  }, [resiToDelete, historyData, formattedStartDate, formattedEndDate, queryClient]);

  const handleCopyTableData = useCallback(async () => {
    const rowsToCopy = table.getFilteredRowModel().rows;
    if (rowsToCopy.length === 0) {
      showError("Tidak ada data untuk disalin.");
      return;
    }

    const headers = table.getHeaderGroups()[0].headers
      .filter(header => header.column.id !== "rowNumber")
      .map(header => flexRender(header.column.columnDef.header, header.getContext()));
    const headerRow = headers.join('\t');

    const dataRows = rowsToCopy.map(row => {
      const rowValues = row.getVisibleCells()
        .filter(cell => cell.column.id !== "rowNumber")
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