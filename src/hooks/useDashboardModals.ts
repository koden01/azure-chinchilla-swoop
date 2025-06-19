import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";

// Define a common interface for items displayed in the modal
interface ModalDataItem {
  Resi?: string; // Used for 'followUp' modal type (from tbl_resi or RPC)
  resino?: string; // Used for 'belumKirim', 'expeditionDetail', 'transaksiHariIni' (from tbl_expedisi)
  orderno?: string | null;
  chanelsales?: string | null;
  couriername?: string | null;
  created?: string; // For tbl_resi
  datetrans?: string | null; // For tbl_expedisi
  flag?: string | null;
  cekfu?: boolean | null;
  created_resi?: string; // For followUp RPC
  created_expedisi?: string; // For followUp RPC
}

interface UseDashboardModalsProps {
  date: Date | undefined;
  formattedDate: string;
  allExpedisiData: Map<string, any> | undefined; // Mengubah tipe menjadi Map
}

export const useDashboardModals = ({ date, formattedDate, allExpedisiData }: UseDashboardModalsProps) => {
  const queryClient = useQueryClient();

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
    console.log(`Modal opened: ${title}, Data length: ${data.length}, Type: ${type}`);
  };

  const handleOpenTransaksiHariIniModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }
    console.log(`Fetching data for 'Transaksi Hari Ini' modal for date: ${formattedDate} using RPC.`);

    const { data, error } = await supabase.rpc("get_transaksi_hari_ini_records", {
      p_selected_date: formattedDate,
    });
      
    if (error) {
      showError("Gagal memuat data transaksi hari ini.");
      console.error("Error fetching Transaksi Hari Ini data:", error);
      return;
    }
    console.log("Data for 'Transaksi Hari Ini' modal:", data);
    openResiModal("Transaksi Hari Ini", data || [], "transaksiHariIni");
  };

  const handleOpenBelumKirimModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }
    console.log(`Fetching data for 'Belum Kirim (Hari Ini)' modal for date: ${formattedDate} using RPC.`);

    const { data, error } = await supabase.rpc("get_belum_kirim_records", {
      p_selected_date: formattedDate,
    });
      
    if (error) {
      showError("Gagal memuat data resi yang belum dikirim.");
      console.error("Error fetching Belum Kirim data:", error);
      return;
    }
    console.log("Data for 'Belum Kirim (Hari Ini)' modal:", data);
    openResiModal("Belum Kirim (Hari Ini)", data || [], "belumKirim");
  };

  const handleOpenFollowUpFlagNoModal = async () => {
    const actualCurrentDate = new Date();
    const actualCurrentFormattedDate = format(actualCurrentDate, 'yyyy-MM-dd');

    console.log("Fetching data for 'Follow Up (Belum Kirim)' modal using RPC...");
    console.log("Excluding records created on:", actualCurrentFormattedDate);

    const { data, error } = await supabase.rpc("get_flag_no_expedisi_records_except_today", {
      p_selected_date: actualCurrentFormattedDate,
    });

    if (error) {
      showError("Gagal memuat data Follow Up (Belum Kirim).");
      console.error("Error fetching Follow Up (Belum Kirim) data via RPC:", error);
      return;
    }
    console.log("Data for 'Follow Up (Belum Kirim)' modal (from RPC):", data?.length, "records.");
    openResiModal("Follow Up (Belum Kirim)", data || [], "belumKirim");
  };

  const handleOpenScanFollowupModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }
    console.log("Fetching data for 'Follow Up (Scan Tidak Sesuai Tanggal)' modal...");
    console.log("Using selected dashboard date:", formattedDate);

    const { data, error } = await supabase.rpc("get_scan_follow_up", {
      selected_date: formattedDate,
    });
    if (error) {
      showError("Gagal memuat data Scan Follow Up.");
      console.error("Error fetching Scan Follow Up:", error);
      return;
    }
    console.log("Data for 'Follow Up (Scan Tidak Sesuai Tanggal)' modal:", data);
    openResiModal("Follow Up (Scan Tidak Sesuai Tanggal)", data || [], "followUp");
  };

  const handleOpenExpeditionDetailModal = async (courierName: string) => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    console.log(`Fetching detail data for '${courierName}' (Belum Kirim) for date: ${formattedDate} using RPC.`);

    const { data, error } = await supabase.rpc("get_expedition_detail_records", {
      p_couriername: courierName,
      p_selected_date: formattedDate,
    });

    if (error) {
      showError(`Gagal memuat detail resi untuk ${courierName}.`);
      console.error(`Error fetching expedition detail data for ${courierName}:`, error);
      return;
    }
    console.log(`Data for 'Detail Resi ${courierName} (Belum Kirim)' modal:`, data);
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
      console.log(`Optimistically removed ${resiNumber} from modal data. New length: ${newData.length}`);
      return newData;
    });

    try {
      console.log(`Attempting to batal resi: ${resiNumber}`);
      
      // Use allExpedisiData (Map) to get couriername and created timestamp
      const expedisiRecord = allExpedisiData?.get(resiNumber.toLowerCase());
      
      if (!expedisiRecord) {
        console.warn(`Resi ${resiNumber} not found in allExpedisiData map. Proceeding with tbl_resi update/insert for 'batal' with default values.`);
      }

      const createdTimestampFromExpedisi = expedisiRecord?.created || new Date().toISOString(); // Default to now if not found

      const { data: existingResi, error: checkError } = await supabase
        .from("tbl_resi")
        .select("Resi")
        .eq("Resi", resiNumber)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw checkError;
      }

      if (existingResi) {
        console.log(`Resi ${resiNumber} found in tbl_resi, updating schedule to 'batal' and created date.`);
        const { error: updateError } = await supabase
          .from("tbl_resi")
          .update({ 
            schedule: "batal", // This is explicitly 'batal', so keep it
            created: createdTimestampFromExpedisi, // Update created date from tbl_expedisi
            Keterangan: "BATAL", // Ensure Keterangan is BATAL
            nokarung: "0", // Ensure nokarung is 0 for batal
          })
          .eq("Resi", resiNumber);

        if (updateError) throw updateError;
        showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      } else {
        console.log(`Resi ${resiNumber} not found in tbl_resi, inserting as 'batal'.`);
        const { error: insertError } = await supabase
          .from("tbl_resi")
          .insert({
            Resi: resiNumber,
            created: createdTimestampFromExpedisi, // Use created from tbl_expedisi
            Keterangan: "BATAL",
            nokarung: "0",
            schedule: "batal", // This is explicitly 'batal', so keep it
          });

        if (insertError) throw insertError;
        showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      }

      // Invalidate queries to trigger refetch for dashboard summaries
      invalidateDashboardQueries(queryClient, date);

    } catch (error: any) {
      // Revert optimistic update on error
      if (itemToBatal) {
        setModalData(originalModalData); // Revert to original data
        console.log(`Reverted optimistic update for ${resiNumber} due to error.`);
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
      console.log(`Optimistically removed ${resiNumber} from modal data. New length: ${newData.length}`);
      return newData;
    });

    try {
      console.log(`Attempting to confirm resi: ${resiNumber}`);
      // Use allExpedisiData (Map) to get couriername and created timestamp
      const expedisiRecord = allExpedisiData?.get(resiNumber.toLowerCase());

      if (!expedisiRecord) {
        throw new Error(`Gagal mendapatkan data ekspedisi untuk resi ${resiNumber}: Data tidak ditemukan di cache.`);
      }

      const courierNameFromExpedisi = expedisiRecord.couriername;
      const expedisiCreatedTimestamp = expedisiRecord.created; // Get the created timestamp

      console.log(`Updating flag to 'YES' for resi ${resiNumber} in tbl_expedisi.`);
      const { error: expUpdateError } = await supabase
        .from("tbl_expedisi")
        .update({ flag: "YES" })
        .eq("resino", resiNumber);

      if (expUpdateError) {
        throw new Error(`Gagal mengkonfirmasi resi ${resiNumber} di tbl_expedisi: ${expUpdateError.message}`);
      }

      const { data: existingResi, error: checkResiError } = await supabase
        .from("tbl_resi")
        .select("Resi")
        .eq("Resi", resiNumber)
        .single();

      if (checkResiError && checkResiError.code !== 'PGRST116') {
        throw checkResiError;
      }

      if (existingResi) {
        console.log(`Resi ${resiNumber} found in tbl_resi, updating details.`);
        const { error: updateResiError } = await supabase
          .from("tbl_resi")
          .update({
            created: expedisiCreatedTimestamp, // Use created from tbl_expedisi
            Keterangan: courierNameFromExpedisi,
            nokarung: "0",
            // schedule: "ontime", // Dihapus agar trigger database yang menentukan
          })
          .eq("Resi", resiNumber);

        if (updateResiError) throw updateResiError;
        showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      } else {
        console.log(`Resi ${resiNumber} not found in tbl_resi, inserting new record.`);
        const { error: insertResiError } = await supabase
          .from("tbl_resi")
          .insert({
            Resi: resiNumber,
            created: expedisiCreatedTimestamp, // Use created from tbl_expedisi
            Keterangan: courierNameFromExpedisi,
            nokarung: "0",
            // schedule: "ontime", // Dihapus agar trigger database yang menentukan
          });

        if (insertResiError) throw insertResiError;
        showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      }

      // Invalidate queries to trigger refetch for dashboard summaries
      invalidateDashboardQueries(queryClient, date);

    } catch (error: any) {
      // Revert optimistic update on error
      if (itemToConfirm) {
        setModalData(originalModalData); // Revert to original data
        console.log(`Reverted optimistic update for ${resiNumber} due to error.`);
      }
      showError(`Gagal mengkonfirmasi resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("Error confirming resi:", error);
    }
  };

  const handleCekfuToggle = async (resiNumber: string, currentCekfuStatus: boolean) => {
    console.log(`Toggling CEKFU for resi ${resiNumber} from ${currentCekfuStatus} to ${!currentCekfuStatus}`);
    // Optimistic UI update for CEKFU toggle
    setModalData(prevData =>
      prevData.map(item => {
        const itemResi = item.Resi || item.resino;
        return itemResi === resiNumber
          ? { ...item, cekfu: !currentCekfuStatus }
          : item;
      })
    );

    try {
      const { error } = await supabase
        .from("tbl_expedisi")
        .update({ cekfu: !currentCekfuStatus })
        .eq("resino", resiNumber);

      if (error) {
        throw error;
      }
      showSuccess(`Status CEKFU resi ${resiNumber} berhasil diperbarui.`);
      invalidateDashboardQueries(queryClient, date);
    } catch (error: any) {
      // Revert optimistic update on error
      setModalData(prevData =>
        prevData.map(item => {
          const itemResi = item.Resi || item.resino;
          return itemResi === resiNumber
            ? { ...item, cekfu: currentCekfuStatus } // Revert to original status
            : item;
        })
      );
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
    handleConfirmResi,
    handleCekfuToggle,
  };
};