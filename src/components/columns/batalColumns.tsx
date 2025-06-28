"use client";

import { ColumnDef } from "@tanstack/react-table";
import { safeFormatDate } from "@/lib/utils"; // Import safeFormatDate

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
      const dateValue = row.getValue("created");
      return safeFormatDate(dateValue as string, "dd/MM/yyyy HH:mm");
    },
  },
  {
    accessorKey: "schedule",
    header: "Schedule",
  },
];