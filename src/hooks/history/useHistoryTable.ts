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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getKeteranganBadgeClasses } from "@/utils/expeditionUtils";
import { HistoryData } from "./useHistoryData"; // Import the interface

interface UseHistoryTableProps {
  data: HistoryData[];
  debouncedGlobalFilter: string;
  startDate: Date | undefined; // Added for useEffect dependency
  endDate: Date | undefined; // Added for useEffect dependency
}

export const useHistoryTable = ({ data, debouncedGlobalFilter, startDate, endDate }: UseHistoryTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Define columns first, using the context to get table instance
  const columns = useMemo<ColumnDef<HistoryData>[]>(() => [
    {
      accessorKey: "rowNumber",
      header: "No",
      // Access table instance via cell context (renamed to 'instance' to avoid conflict with outer 'table')
      cell: ({ row, table: instance }) => instance.getState().pagination.pageIndex * instance.getState().pagination.pageSize + row.index + 1,
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: "Resi",
      header: "Nomor Resi",
    },
    {
      accessorKey: "Keterangan",
      header: "Keterangan",
      cell: ({ row }) => (
        <span className={cn(
          "px-2 py-1 rounded-full text-xs font-semibold",
          getKeteranganBadgeClasses(row.original.Keterangan)
        )}>
          {row.original.Keterangan}
        </span>
      ),
    },
    {
      accessorKey: "nokarung",
      header: "No Karung",
    },
    {
      accessorKey: "schedule",
      header: "Schedule",
      cell: ({ row }) => row.original.schedule || "-",
    },
    {
      accessorKey: "created",
      header: "Tanggal Input",
      cell: ({ row }) => format(new Date(row.original.created), "dd/MM/yyyy HH:mm"),
    },
  ], []); // Empty dependency array is correct here as 'instance' comes from cell context

  const table = useReactTable({
    data: data,
    columns: columns, // Pass the defined columns
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedGlobalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
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

  // Reset page index when filter or date range changes
  useEffect(() => {
    table.setPageIndex(0);
  }, [debouncedGlobalFilter, startDate, endDate, table]);

  return {
    table,
    columns,
  };
};