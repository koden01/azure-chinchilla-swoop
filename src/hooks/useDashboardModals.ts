import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { ModalDataItem } from "@/types/data"; // Import from shared types
import { normalizeExpeditionName } from "@/utils/expeditionUtils"; // Import new utility

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
  onConfirmResi: (resiNumber: string) => Promise<void>; // Renamed to match prop name
  onCekfuToggle: (resiNumber: string, currentCekfuStatus: boolean) => Promise<void>; // Renamed to match prop name
}

export const useDashboardModals = ({ date, formattedDate, allExpedisiData }: UseDashboardModalsProps): UseDashboardModalsReturn => {
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

      const { data: existingResi, error: checkError } = await supabase
        .from("tbl_resi")
        .select("Resi")
        .eq("Resi", resiNumber)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw checkError;
      }

      if (existingResi) {
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

      const resiDataToUpsert = {
        Resi: resiNumber,
        created: expedisiCreatedTimestamp, // Use created from tbl_expedisi
        Keterangan: courierNameFromExpedisi,
        nokarung: "0", // Default to "0" for confirmed resi from dashboard
      };

      if (existingResi) {
        const { error: updateResiError } = await supabase
          .from("tbl_resi")
          .update(resiDataToUpsert)
          .eq("Resi", resiNumber);

        if (updateResiError) throw updateResiError;
        showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      } else {
        const { error: insertResiError } = await supabase
          .from("tbl_resi")
          .insert(resiDataToUpsert);

        if (insertResiError) throw insertResiError;
        showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      }

      // Invalidate queries to trigger refetch for dashboard summaries
      invalidateDashboardQueries(queryClient, date);

    } catch (error: any) {
      // Revert optimistic update on error
      if (itemToConfirm) {
        setModalData(originalModalData); // Revert to original data
      }
      showError(`Gagal mengkonfirmasi resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("[handleConfirmResi] Error confirming resi:", error);
    }
  };

  const onCekfuToggle = async (resiNumber: string, currentCekfuStatus: boolean) => { // Renamed to onCekfuToggle
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
    onConfirmResi: handleConfirmResi, // Map to the new name
    onCekfuToggle, // Map to the new name
  };
};