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
      const date = row.getValue("created");
      return date ? format(new Date(date as string), "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "schedule",
    header: "Schedule",
  },
];