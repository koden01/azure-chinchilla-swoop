"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, isValid } from "date-fns"; // Import isValid

export interface FollowUpData {
  Resi: string;
  created_resi: string; // timestamp with time zone
  created_expedisi: string; // timestamp without time zone
  couriername: string;
}

export const columns: ColumnDef<FollowUpData>[] = [
  {
    accessorKey: "Resi",
    header: "No. Resi",
  },
  {
    accessorKey: "created_resi",
    header: "Tanggal Resi",
    cell: ({ row }) => {
      const dateValue = row.getValue("created_resi") as string | null;
      const dateObject = dateValue ? new Date(dateValue) : null;
      return dateObject && isValid(dateObject) ? format(dateObject, "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "created_expedisi",
    header: "Tanggal Expedisi",
    cell: ({ row }) => {
      const dateValue = row.getValue("created_expedisi") as string | null;
      const dateObject = dateValue ? new Date(dateValue) : null;
      return dateObject && isValid(dateObject) ? format(dateObject, "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "couriername",
    header: "Kurir",
  },
];