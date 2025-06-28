"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, isValid } from "date-fns"; // Import isValid

export interface BatalData {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string; // timestamp with time zone
  schedule: string | null;
}

export const columns: ColumnDef<BatalData>[] = [
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
      const dateValue = row.getValue("created") as string | null;
      const dateObject = dateValue ? new Date(dateValue) : null;
      return dateObject && isValid(dateObject) ? format(dateObject, "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "schedule",
    header: "Schedule",
  },
];