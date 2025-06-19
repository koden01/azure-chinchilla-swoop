// src/types/data.ts

/**
 * Common interface for items displayed in various detail modals.
 * This interface combines properties from both tbl_resi and tbl_expedisi
 * to allow flexible data display based on modal type.
 */
export interface ModalDataItem {
  Resi?: string; // Used for 'followUp' modal type (from tbl_resi or RPC)
  resino?: string; // Used for 'belumKirim', 'expeditionDetail', 'transaksiHariIni' (from tbl_expedisi)
  orderno?: string | null;
  chanelsales?: string | null;
  couriername?: string | null;
  created?: string; // For tbl_resi (timestamp with time zone)
  datetrans?: string | null; // For tbl_expedisi (timestamp with time zone)
  flag?: string | null;
  cekfu?: boolean | null;
  created_resi?: string; // For followUp RPC (timestamp with time zone)
  created_expedisi?: string; // For followUp RPC (timestamp without time zone)
  optimisticId?: string; // Used for optimistic UI updates
}