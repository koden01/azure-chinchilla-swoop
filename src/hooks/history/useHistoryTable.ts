import React, { useState, useMemo, useEffect } from "react";
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { useDebounce } from "@/hooks/useDebounce";
import { HistoryData } from "@/components/columns/historyColumns"; // Import HistoryData type

interface UseHistoryTableProps {
  data: HistoryData[];
  columns: ColumnDef<HistoryData>[];
  globalFilter: string;
  startDate: Date | undefined; // Added for resetting page index
  endDate: Date | undefined; // Added for resetting page index
}

export const useHistoryTable = ({ data, columns, globalFilter, startDate, endDate }: UseHistoryTableProps) => {
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedGlobalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: (updater) => {
      if (typeof updater === 'function') {
        globalFilter = updater(globalFilter);
      } else {
        globalFilter = updater;
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  useEffect(() => {
    table.setPageIndex(0); // Reset to first page when filters or dates change
  }, [debouncedGlobalFilter, startDate, endDate, table]);

  const getPaginationPages = useMemo(() => {
    const pages = [];
    const totalPages = table.getPageCount();
    const currentPage = table.getState().pagination.pageIndex + 1;

    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 2) {
        pages.push(1, 2, 3);
      } else if (currentPage >= totalPages - 1) {
        pages.push(totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(currentPage - 1, currentPage, currentPage + 1);
      }
    }
    return pages;
  }, [table.getPageCount(), table.getState().pagination.pageIndex]);

  return {
    table,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    getPaginationPages,
  };
};