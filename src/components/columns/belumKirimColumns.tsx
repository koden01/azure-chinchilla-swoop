"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, isValid } from "date-fns"; // Import isValid

export interface BelumKirimData {
  resino: string;
  orderno: string | null;
  chanelsales: string | null;
  couriername: string | null;
  created: string; // This is from tbl_expedisi, which is timestamp without time zone
  flag: string | null;
  datetrans: string | null;
  cekfu: boolean | null;
}

export const columns: ColumnDef<BelumKirimData>[] = [
  {
    accessorKey: "resino",
    header: "No. Resi",
  },
  {
    accessorKey: "orderno",
    header: "No Order",
  },
  {
    accessorKey: "chanelsales",
    header: "Marketplace",
  },
  {
    accessorKey: "datetrans",
    header: "Tanggal Pembelian",
    cell: ({ row }) => {
      const dateValue = row.getValue("datetrans") as string | null;
      const dateObject = dateValue ? new Date(dateValue) : null;
      return dateObject && isValid(dateObject) ? format(dateObject, "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "couriername",
    header: "Kurir",
  },
  {
    accessorKey: "cekfu",
    header: "Cek FU",
    cell: ({ row }) => (row.getValue("cekfu") ? "YES" : "NO"),
  },
];