// src/types/supabase.ts

export interface TblExpedisi {
  resino: string;
  orderno: string | null;
  chanelsales: string | null;
  couriername: string | null;
  created: string; // timestamp without time zone
  flag: string | null;
  datetrans: string | null; // timestamp with time zone
  cekfu: boolean | null;
}

export interface TblResi {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string; // timestamp with time zone
  schedule: string | null;
}