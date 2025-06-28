import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getKeteranganBadgeClasses } from "@/utils/expeditionUtils";
// import React from "react"; // Removed unused import

export interface HistoryData {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string;
  schedule: string | null;
}

export const columns: ColumnDef<HistoryData>[] = [
  {
    accessorKey: "rowNumber",
    header: "No",
    cell: ({ row, table }) => row.index + 1 + table.getState().pagination.pageIndex * table.getState().pagination.pageSize,
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
  },
  {
    accessorKey: "created",
    header: "Tanggal Input",
    cell: ({ row }) => format(new Date(row.original.created), "dd/MM/yyyy HH:mm"),
  },
];