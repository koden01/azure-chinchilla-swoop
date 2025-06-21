import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ModalDataItem } from "@/types/data";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";

interface UseDashboardModalsProps {
  date: Date | undefined;
  formattedDate: string;
  allExpedisiData: Map<string, any> | undefined; // Mengubah tipe menjadi Map
}

// Define the explicit return type interface for useDashboardModals
interface UseDashboardModalsReturn {
  isModalOpen: boolean;
  modalTitle: string;
  modalData: ModalDataItem[];
  modalType: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni" | null;
  selectedCourier: string | null;
  openResiModal: (title: string, data: ModalDataItem[], type: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni", courier?: string | null) => void;
  handleOpenTransaksiHariIniModal: () => Promise<void>;
  handleOpenBelumKirimModal: () => Promise<void>;
  handleOpenFollowUpFlagNoModal: () => Promise<void>;
  handleOpenScanFollowupModal: () => Promise<void>;
  handleOpenExpeditionDetailModal: (courierName: string) => Promise<void>;
  handleCloseModal: () => void;
  handleBatalResi: (resiNumber: string) => Promise<void>;
  onConfirmResi: (resiNumber: string) => Promise<void>;
  onCekfuToggle: (resiNumber: string, currentCekfuStatus: boolean) => Promise<void>;
}

export const useDashboardModals = ({ date, formattedDate, allExpedisiData }: UseDashboardModalsProps): UseDashboardModalsReturn => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalData, setModalData] = React.useState<ModalDataItem[]>([]); // Use the new interface here
  const [modalType, setModalType] = React.useState<
    "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni" | null
  >(null);
  const [selectedCourier, setSelectedCourier] = React.useState<string | null>(null);

  const openResiModal = (
    title: string,
    data: ModalDataItem[], // Use the new interface here
    type: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni",
    courier: string | null = null
  ) => {
    setModalTitle(title);
    setModalData(data);
    setModalType(type);
    setSelectedCourier(courier);
    setIsModalOpen(true);
  };

  const handleOpenTransaksiHariIniModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_transaksi_hari_ini_records", {
      p_selected_date: formattedDate,
    });
      
    if (error) {
      showError("Gagal memuat data transaksi hari ini.");
      console.error("Error fetching Transaksi Hari Ini data:", error);
      return;
    }
    openResiModal("Transaksi Hari Ini", data || [], "transaksiHariIni");
  };

  const handleOpenBelumKirimModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_belum_kirim_records", {
      p_selected_date: formattedDate,
    });
      
    if (error) {
      showError("Gagal memuat data resi yang belum dikirim.");
      console.error("Error fetching Belum Kirim data:", error);
      return;
    }
    openResiModal("Belum Kirim (Hari Ini)", data || [], "belumKirim");
  };

  const handleOpenFollowUpFlagNoModal = async () => {
    const actualCurrentDate = new Date();
    const actualCurrentFormattedDate = format(actualCurrentDate, 'yyyy-MM-dd');

    const { data, error } = await supabase.rpc("get_flag_no_expedisi_records_except_today", {
      p_selected_date: actualCurrentFormattedDate,
    });

    if (error) {
      showError("Gagal memuat data Follow Up (Belum Kirim).");
      console.error("Error fetching Follow Up (Belum Kirim) data via RPC:", error);
      return;
    }
    openResiModal("Follow Up (Belum Kirim)", data || [], "belumKirim");
  };

  const handleOpenScanFollowupModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_scan_follow_up", {
      selected_date: formattedDate,
    });
    if (error) {
      showError("Gagal memuat data Scan Follow Up.");
      console.error("Error fetching Scan Follow Up:", error);
      return;
    }
    openResiModal("Follow Up (Scan Tidak Sesuai Tanggal)", data || [], "followUp");
  };

  const handleOpenExpeditionDetailModal = async (courierName: string) => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_expedition_detail_records", {
      p_couriername: courierName,
      p_selected_date: formattedDate,
    });

    if (error) {
      showError(`Gagal memuat detail resi untuk ${courierName}.`);
      console.error(`Error fetching expedition detail data for ${courierName}:`, error);
      return;
    }
    openResiModal(`Detail Resi ${courierName} (Belum Kirim)`, data || [], "expeditionDetail", courierName);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalData([]);
    setModalType(null);
    setSelectedCourier(null);
  };

  const handleBatalResi = async (resiNumber: string) => {
    // Optimistic UI update: Remove the item immediately
    const originalModalData = modalData;
    const itemToBatal = originalModalData.find(item => (item.Resi || item.resino) === resiNumber);
    setModalData(prevData => {
      const newData = prevData.filter(item => {
        const itemResi = item.Resi || item.resino;
        return itemResi !== resiNumber;
      });
      return newData;
    });

    try {
      let expedisiRecord = allExpedisiData?.get(resiNumber.toLowerCase());
      
      if (!expedisiRecord) {
        const { data: directExpedisiData, error: directExpedisiError } = await supabase
            .from("tbl_expedisi")
            .select("*")
            .eq("resino", resiNumber)
            .single();

        if (directExpedisiError && directExpedisiError.code !== 'PGRST116') { // PGRST116 means "no rows found"
            throw directExpedisiError; // Re-throw other errors
        }
        
        if (directExpedisiData) {
            expedisiRecord = directExpedisiData;
        } else {
            console.warn(`Resi ${resiNumber} not found in tbl_expedisi. Proceeding with 'batal' in tbl_resi using default values.`);
        }
      }

      const createdTimestampFromExpedisi = expedisiRecord?.created || new Date().toISOString(); // Default to now if not found

      // Add operation to IndexedDB
      await addPendingOperation({
        id: `batal-${resiNumber}-${Date.now()}`,
        type: "batal",
        payload: {
          resiNumber,
          createdTimestampFromExpedisi, // Use created from tbl_expedisi
          keteranganValue: "BATAL", // Set Keterangan to BATAL
        },
        timestamp: Date.now(),
      });

      showSuccess(`Resi ${resiNumber} berhasil dibatalkan (disimpan secara lokal).`);

    } catch (error: any) {
      // Revert optimistic update on error
      if (itemToBatal) {
        setModalData(originalModalData); // Revert to original data
      }
      showError(`Gagal membatalkan resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("Error batal resi:", error);
    }
  };

  const handleConfirmResi = async (resiNumber: string) => {
    // Optimistic UI update: Remove the item immediately
    const originalModalData = modalData;
    const itemToConfirm = originalModalData.find(item => (item.Resi || item.resino) === resiNumber);
    setModalData(prevData => {
      const newData = prevData.filter(item => {
        const itemResi = item.Resi || item.resino;
        return itemResi !== resiNumber;
      });
      return newData;
    });

    try {
      let expedisiRecord = allExpedisiData?.get(resiNumber.toLowerCase());
      
      if (!expedisiRecord) {
        const { data: directExpedisiData, error: directExpedisiError } = await supabase
            .from("tbl_expedisi")
            .select("*")
            .eq("resino", resiNumber)
            .single();

        if (directExpedisiError && directExpedisiError.code !== 'PGRST116') { // PGRST116 means "no rows found"
            throw directExpedisiError; // Re-throw other errors
        }
        
        if (directExpedisiData) {
            expedisiRecord = directExpedisiData;
        } else {
            throw new Error(`Gagal mendapatkan data ekspedisi untuk resi ${resiNumber}: Data tidak ditemukan di database.`);
        }
      }

      const courierNameFromExpedisi = normalizeExpeditionName(expedisiRecord.couriername); // Use normalized name
      const expedisiCreatedTimestamp = expedisiRecord.created; // Get the created timestamp from tbl_expedisi

      // Add operation to IndexedDB
      await addPendingOperation({
        id: `confirm-${resiNumber}-${Date.now()}`,
        type: "confirm",
        payload: {
          resiNumber,
          courierNameFromExpedisi,
          expedisiCreatedTimestamp,
          keteranganValue: courierNameFromExpedisi, // Set Keterangan to couriername
        },
        timestamp: Date.now(),
      });

      showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi (disimpan secara lokal).`);

    } catch (error: any) {
      // Revert optimistic update on error
      if (itemToConfirm) {
        setModalData(originalModalData); // Revert to original data
      }
      showError(`Gagal mengkonfirmasi resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("[handleConfirmResi] Error confirming resi:", error);
    }
  };

  const onCekfuToggle = async (resiNumber: string, currentCekfuStatus: boolean) => {
    // Optimistic UI update for CEKFU toggle
    const originalModalData = modalData; // Store original data for potential revert
    setModalData(prevData =>
      prevData.map(item => {
        const itemResi = item.Resi || item.resino;
        return itemResi === resiNumber
          ? { ...item, cekfu: !currentCekfuStatus }
          : item;
      })
    );

    try {
      let expedisiRecord = allExpedisiData?.get(resiNumber.toLowerCase());
      
      if (!expedisiRecord) {
        const { data: directExpedisiData, error: directExpedisiError } = await supabase
            .from("tbl_expedisi")
            .select("*")
            .eq("resino", resiNumber)
            .single();

        if (directExpedisiError && directExpedisiError.code !== 'PGRST116') { // PGRST116 means "no rows found"
            throw directExpedisiError; // Re-throw other errors
        }
        
        if (directExpedisiData) {
            expedisiRecord = directExpedisiData;
        } else {
            throw new Error(`Gagal memperbarui status CEKFU resi ${resiNumber}: Data ekspedisi tidak ditemukan di database.`);
        }
      }

      // Add operation to IndexedDB
      await addPendingOperation({
        id: `cekfu-${resiNumber}-${Date.now()}`,
        type: "cekfu",
        payload: {
          resiNumber,
          newCekfuStatus: !currentCekfuStatus,
        },
        timestamp: Date.now(),
      });

      showSuccess(`Status CEKFU resi ${resiNumber} berhasil diperbarui (disimpan secara lokal).`);
    } catch (error: any) {
      // Revert optimistic update on error
      setModalData(originalModalData); // Revert to original data
      showError(`Gagal memperbarui status CEKFU resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("Error updating CEKFU status:", error);
    }
  };

  return {
    isModalOpen,
    modalTitle,
    modalData,
    modalType,
    selectedCourier,
    openResiModal,
    handleOpenTransaksiHariIniModal,
    handleOpenBelumKirimModal,
    handleOpenFollowUpFlagNoModal,
    handleOpenScanFollowupModal,
    handleOpenExpeditionDetailModal,
    handleCloseModal,
    handleBatalResi,
    onConfirmResi: handleConfirmResi,
    onCekfuToggle,
  };
};