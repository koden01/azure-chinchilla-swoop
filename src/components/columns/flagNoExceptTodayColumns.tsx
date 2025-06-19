"use client";

import { ColumnDef } from "@tanstack/react-table";
// No specific data type needed here, as this table will likely display expedition summaries
// For now, using a generic type or defining a specific one if data structure is known.
// Based on Dashboard.tsx, this table is currently showing `expeditionSummaries` filtered.
// Let's define a type that matches the summary structure.

export interface FlagNoExceptTodayData {
  name: string;
  totalTransaksi: number;
  totalScan: number;
  sisa: number;
  jumlahKarung: number;
  idRekomendasi?: number;
  totalBatal: number;
  totalScanFollowUp: number;
}

export const columns: ColumnDef<FlagNoExceptTodayData>[] = [
  {
    accessorKey: "name",
    header: "Ekspedisi",
  },
  {
    accessorKey: "sisa",
    header: "Sisa (Flag NO)",
  },
  {
    accessorKey: "totalTransaksi",
    header: "Total Transaksi",
  },
  {
    accessorKey: "totalScan",
    header: "Total Scan",
  },
  {
    accessorKey: "jumlahKarung",
    header: "Jumlah Karung",
  },
  {
    accessorKey: "totalBatal",
    header: "Total Batal",
  },
  {
    accessorKey: "totalScanFollowUp",
    header: "Scan Follow Up",
  },
];