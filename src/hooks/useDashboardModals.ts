import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";

interface UseDashboardModalsProps {
  date: Date | undefined;
  formattedDate: string;
  allExpedisiData: any[] | undefined;
}

export const useDashboardModals = ({ date, formattedDate, allExpedisiData }: UseDashboardModalsProps) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalData, setModalData] = React.useState<any[]>([]);
  const [modalType, setModalType] = React.useState<
    "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni" | null // Added "transaksiHariIni"
  >(null);
  const [selectedCourier, setSelectedCourier] = React.useState<string | null>(null);

  const openResiModal = (
    title: string,
    data: any[],
    type: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni", // Updated type
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
    const startOfSelectedDate = startOfDay(date);
    const endOfSelectedDate = endOfDay(date);
    const startString = format(startOfSelectedDate, "yyyy-MM-dd HH:mm:ss");
    const endString = format(endOfSelectedDate, "yyyy-MM-dd HH:mm:ss");

    console.log(`Fetching data for 'Transaksi Hari Ini' modal for date range: ${startString} to ${endString}`);

    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .gte("created", startString)
      .lt("created", endString);
      
    if (error) {
      showError("Gagal memuat data transaksi hari ini.");
      console.error("Error fetching Transaksi Hari Ini data:", error);
      return;
    }
    console.log("Data for 'Transaksi Hari Ini' modal:", data);
    openResiModal("Transaksi Hari Ini", data || [], "transaksiHariIni"); // Changed type to "transaksiHariIni"
  };

  const handleOpenBelumKirimModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }
    const startOfSelectedDate = startOfDay(date);
    const endOfSelectedDate = endOfDay(date);
    const startString = format(startOfSelectedDate, "yyyy-MM-dd HH:mm:ss");
    const endString = format(endOfSelectedDate, "yyyy-MM-dd HH:mm:ss");

    console.log(`Fetching data for 'Belum Kirim (Hari Ini)' modal for date range: ${startString} to ${endString}`);

    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .eq("flag", "NO")
      .gte("created", startString)
      .lt("created", endString);
      
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

    const startOfSelectedDate = startOfDay(date);
    const endOfSelectedDate = endOfDay(date);
    const startString = format(startOfSelectedDate, "yyyy-MM-dd HH:mm:ss");
    const endString = format(endOfSelectedDate, "yyyy-MM-dd HH:mm:ss");

    console.log(`Fetching detail data for '${courierName}' (Belum Kirim) for date range: ${startString} to ${endString}`);

    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .eq("couriername", courierName)
      .eq("flag", "NO")
      .gte("created", startString)
      .lt("created", endString);

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
    try {
      const { data: existingResi, error: checkError } = await supabase
        .from("tbl_resi")
        .select("Resi")
        .eq("Resi", resiNumber)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingResi) {
        const { error: updateError } = await supabase
          .from("tbl_resi")
          .update({ schedule: "batal" })
          .eq("Resi", resiNumber);

        if (updateError) throw updateError;
        showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      } else {
        const { data: expedisiData, error: expFetchError } = await supabase
          .from("tbl_expedisi")
          .select("resino, created")
          .eq("resino", resiNumber)
          .single();

        if (expFetchError) {
          showError(`Gagal menemukan data ekspedisi untuk resi ${resiNumber}.`);
          console.error("Error fetching expedisi data for batal:", expFetchError);
          return;
        }

        const { error: insertError } = await supabase
          .from("tbl_resi")
          .insert({
            Resi: resiNumber,
            created: expedisiData.created,
            Keterangan: "BATAL",
            nokarung: "0",
            schedule: "batal",
          });

        if (insertError) throw insertError;
        showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      }

      invalidateDashboardQueries(queryClient, date);
      setModalData(prevData => prevData.filter(item => (item.resino || item.Resi) !== resiNumber));

    } catch (error: any) {
      showError(`Gagal membatalkan resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("Error batal resi:", error);
    }
  };

  const handleConfirmResi = async (resiNumber: string) => {
    try {
      // Fetch the 'created' timestamp from tbl_expedisi first
      const { data: expedisiData, error: expFetchError } = await supabase
        .from("tbl_expedisi")
        .select("couriername, created") // Select 'created' column
        .eq("resino", resiNumber)
        .single();

      if (expFetchError || !expedisiData) {
        throw new Error(`Gagal mendapatkan data ekspedisi untuk resi ${resiNumber}: ${expFetchError?.message || "Data tidak ditemukan"}`);
      }

      const courierName = expedisiData.couriername;
      const expedisiCreatedTimestamp = expedisiData.created; // Get the created timestamp

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
        const { error: updateResiError } = await supabase
          .from("tbl_resi")
          .update({
            created: expedisiCreatedTimestamp, // Use created from tbl_expedisi
            Keterangan: courierName,
            nokarung: "0",
          })
          .eq("Resi", resiNumber);

        if (updateResiError) throw updateResiError;
        showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      } else {
        const { error: insertResiError } = await supabase
          .from("tbl_resi")
          .insert({
            Resi: resiNumber,
            created: expedisiCreatedTimestamp, // Use created from tbl_expedisi
            Keterangan: courierName,
            nokarung: "0",
          });

        if (insertResiError) throw insertResiError;
        showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      }

      invalidateDashboardQueries(queryClient, date);
      setModalData(prevData => prevData.filter(item => (item.resino || item.Resi) !== resiNumber));

    } catch (error: any) {
      showError(`Gagal mengkonfirmasi resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("Error confirming resi:", error);
    }
  };

  const handleCekfuToggle = async (resiNumber: string, currentCekfuStatus: boolean) => {
    const { error } = await supabase
      .from("tbl_expedisi")
      .update({ cekfu: !currentCekfuStatus })
      .eq("resino", resiNumber);

    if (error) {
      showError(`Gagal memperbarui status CEKFU resi ${resiNumber}.`);
      console.error("Error updating CEKFU status:", error);
    } else {
      showSuccess(`Status CEKFU resi ${resiNumber} berhasil diperbarui.`);
      invalidateDashboardQueries(queryClient, date);
      setModalData(prevData =>
        prevData.map(item =>
          (item.resino || item.Resi) === resiNumber
            ? { ...item, cekfu: !currentCekfuStatus }
            : item
        )
      );
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