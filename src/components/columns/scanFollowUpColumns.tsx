"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

export interface ScanFollowUpData {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string; // timestamp with time zone
  schedule: string | null;
}

export const columns: ColumnDef<ScanFollowUpData>[] = [
  {
    accessorKey: "Resi",
    header: "No. Resi",
  },
  {
    accessorKey: "Keterangan",
    header: "Keterangan",
  },
  {
    accessorKey: "nokarung",
    header: "No Karung",
  },
  {
    accessorKey: "created",
    header: "Tanggal Input",
    cell: ({ row }) => {
      const dateValue = row.getValue("created");
      const date = new Date(dateValue as string);
      return dateValue && !isNaN(date.getTime()) ? format(date, "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "schedule",
    header: "Schedule",
  },
];