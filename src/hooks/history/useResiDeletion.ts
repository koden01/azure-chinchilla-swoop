import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { HistoryData } from "./useHistoryData"; // Import the interface

interface UseResiDeletionProps {
  historyData: HistoryData[] | undefined;
  formattedStartDate: string;
  formattedEndDate: string;
}

export const useResiDeletion = ({ historyData, formattedStartDate, formattedEndDate }: UseResiDeletionProps) => {
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

      // Invalidate relevant queries to refetch data
      await queryClient.refetchQueries({ queryKey: ["historyData", formattedStartDate, formattedEndDate] });
      await queryClient.refetchQueries({ queryKey: ["allResiForExpedition"], exact: false });
      await queryClient.refetchQueries({ queryKey: ["allResiDataComprehensive"] }); // If this query exists and is used
      
      // Invalidate dashboard queries that might be affected by this deletion
      invalidateDashboardQueries(queryClient, dateOfDeletedResi, expeditionOfDeletedResi); 
    }
    setIsDeleteDialogOpen(false);
    setResiToDelete(null);
  }, [resiToDelete, historyData, formattedStartDate, formattedEndDate, queryClient]);

  return {
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    resiToDelete,
    handleDeleteClick,
    handleRowClick,
    confirmDeleteResi,
  };
};