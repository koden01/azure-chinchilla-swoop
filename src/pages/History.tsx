import React, { useState, useCallback } from "react";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import { showSuccess, showError } from "@/utils/toast";

// Import new modular components
import HistoryDateRangePicker from "@/components/history/HistoryDateRangePicker";
import HistoryTableControls from "@/components/history/HistoryTableControls";
import HistoryDataTable from "@/components/history/HistoryDataTable";
import DeleteConfirmationDialog from "@/components/common/DeleteConfirmationDialog";

// Import new modular hooks
import { useHistoryData } from "@/hooks/history/useHistoryData";
import { useHistoryTable } from "@/hooks/history/useHistoryTable";
import { useResiDeletion } from "@/hooks/history/useResiDeletion";

const HistoryPage = () => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);

  const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

  // Use custom hook for data fetching
  const { data: historyData, isLoading: isLoadingHistory } = useHistoryData(startDate, endDate);

  // Use custom hook for table logic
  const { table, columns } = useHistoryTable({
    data: historyData || [],
    debouncedGlobalFilter,
    startDate,
    endDate,
  });

  // Use custom hook for deletion logic
  const {
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    resiToDelete,
    handleDeleteClick,
    handleRowClick,
    confirmDeleteResi,
  } = useResiDeletion({ historyData, formattedStartDate, formattedEndDate });

  const handleCopyTableData = useCallback(async () => {
    const rowsToCopy = table.getFilteredRowModel().rows;
    if (rowsToCopy.length === 0) {
      showError("Tidak ada data untuk disalin.");
      return;
    }

    const headers = table.getHeaderGroups()[0].headers
      .filter(header => header.column.id !== "rowNumber")
      .map(header => {
        // Directly get the header text. For simple string headers, this is sufficient.
        // For more complex headers (ReactNode), this might need a more sophisticated approach
        // but based on the column definitions, they are simple strings.
        return String(header.column.columnDef.header || "");
      });
    const headerRow = headers.join('\t');

    const dataRows = rowsToCopy.map(row => {
      const rowValues = row.getVisibleCells()
        .filter(cell => cell.column.id !== "rowNumber")
        .map(cell => {
          if (cell.column.id === "created") {
            const dateValue = cell.getValue() as string;
            return format(new Date(dateValue), "dd/MM/yyyy HH:mm");
          }
          // For 'Keterangan' column, extract the text content from the badge
          // The cell.getValue() for 'Keterangan' should already be the string value
          if (cell.column.id === "Keterangan") {
            return String(cell.getValue() || "");
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

  return (
    <React.Fragment>
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        {/* Date Range Picker */}
        <HistoryDateRangePicker
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        {/* Table Controls (Search and Copy) */}
        <HistoryTableControls
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          onCopyTableData={handleCopyTableData}
          filteredRowCount={table.getFilteredRowModel().rows.length}
        />

        {/* Data Table */}
        <HistoryDataTable
          table={table}
          columns={columns}
          isLoading={isLoadingHistory}
          handleRowClick={handleRowClick}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={confirmDeleteResi}
          title="Konfirmasi Penghapusan"
          description={
            <span>
              Apakah Anda yakin ingin menghapus resi <span className="font-bold">{resiToDelete}</span>? Tindakan ini tidak dapat dibatalkan.
            </span>
          }
          confirmButtonText="Hapus"
          cancelButtonText="Batal"
        />
      </div>
    </React.Fragment>
  );
};

export default HistoryPage;