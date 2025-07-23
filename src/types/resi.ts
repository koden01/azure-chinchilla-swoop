import { UseQueryResult } from "@tanstack/react-query";

export interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  Keterangan: string | null;
  schedule: string | null;
}