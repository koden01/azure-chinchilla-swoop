"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

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
      const dateValue = row.getValue("created_resi");
      const date = new Date(dateValue as string);
      return dateValue && !isNaN(date.getTime()) ? format(date, "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "created_expedisi",
    header: "Tanggal Expedisi",
    cell: ({ row }) => {
      const dateValue = row.getValue("created_expedisi");
      const date = new Date(dateValue as string);
      return dateValue && !isNaN(date.getTime()) ? format(date, "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "couriername",
    header: "Kurir",
  },
];