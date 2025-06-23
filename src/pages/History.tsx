import React, { useState, useTransition } from "react"; // Import useTransition
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import modular components and hooks
import HistoryDatePicker from "@/components/history/HistoryDatePicker";
import HistorySearchAndActions from "@/components/history/HistorySearchAndActions";
import HistoryTable from "@/components/history/HistoryTable";
import { useHistoryData } from "@/hooks/history/useHistoryData"; // HistoryData is used internally by this hook
import { useHistoryTable } from "@/hooks/history/useHistoryTable";
import { useHistoryActions } from "@/hooks/history/useHistoryActions";
import { columns } from "@/components/columns/historyColumns"; // columns already imports HistoryData

const HistoryPage: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [isPending, startTransition] = useTransition(); // Initialize useTransition

  // Use custom hook for data fetching
  const { historyData, isLoadingHistory, formattedStartDate, formattedEndDate } = useHistoryData(startDate, endDate);

  // Use custom hook for table logic
  const { table, getPaginationPages } = useHistoryTable({
    data: historyData || [], // Ensure data is always an array
    columns,
    globalFilter,
    startDate,
    endDate,
  });

  // Use custom hook for actions (delete, copy)
  const {
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    resiToDelete,
    handleRowClick,
    confirmDeleteResi,
    handleCopyTableData,
  } = useHistoryActions({
    historyData,
    formattedStartDate,
    formattedEndDate,
    table,
  });

  // Wrap state updates in startTransition
  const handleSetStartDate = (date: Date | undefined) => {
    startTransition(() => {
      setStartDate(date);
    });
  };

  const handleSetEndDate = (date: Date | undefined) => {
    startTransition(() => {
      setEndDate(date);
    });
  };

  const handleSetGlobalFilter = (filter: string) => {
    startTransition(() => {
      setGlobalFilter(filter);
    });
  };

  return (
    <React.Fragment>
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        {/* Date Picker Section */}
        <HistoryDatePicker
          startDate={startDate}
          setStartDate={handleSetStartDate} // Use wrapped setter
          endDate={endDate}
          setEndDate={handleSetEndDate}   // Use wrapped setter
        />

        {/* Search and Actions Section */}
        <HistorySearchAndActions
          globalFilter={globalFilter}
          setGlobalFilter={handleSetGlobalFilter} // Use wrapped setter
          handleCopyTableData={handleCopyTableData}
          filteredRowCount={table.getFilteredRowModel().rows.length}
        />

        {/* History Table Section */}
        <HistoryTable
          table={table}
          isLoadingHistory={isLoadingHistory || isPending} // Combine loading states
          columns={columns}
          handleRowClick={handleRowClick}
          getPaginationPages={getPaginationPages}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Penghapusan</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus resi <span className="font-bold">{resiToDelete}</span>? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteResi} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </React.Fragment>
  );
};

export default HistoryPage;