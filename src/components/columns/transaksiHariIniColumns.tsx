"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

export interface TransaksiHariIniData {
  resino: string;
  orderno: string | null;
  chanelsales: string | null;
  couriername: string | null;
  created: string; // This is from tbl_expedisi, which is timestamp without time zone
  flag: string | null;
  datetrans: string | null;
  cekfu: boolean | null;
}

export const columns: ColumnDef<TransaksiHariIniData>[] = [
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
      const date = row.getValue("datetrans");
      return date ? format(new Date(date as string), "dd/MM/yyyy HH:mm") : "-";
    },
  },
  {
    accessorKey: "couriername",
    header: "Kurir",
  },
  {
    accessorKey: "flag",
    header: "Flag",
  },
  {
    accessorKey: "cekfu",
    header: "Cek FU",
    cell: ({ row }) => (row.getValue("cekfu") ? "YES" : "NO"),
  },
];