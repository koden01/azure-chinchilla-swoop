import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";

interface UseDashboardModalsProps {
  date: Date | undefined;
  formattedDate: string;
  allExpedisiData: any[] | undefined; // This is now primarily for the map in useDashboardData, not direct filtering here
}

export const useDashboardModals = ({ date, formattedDate, allExpedisiData }: UseDashboardModalsProps) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalData, setModalData] = React.useState<any[]>([]);
  const [modalType, setModalType] = React.useState<
    "belumKirim" | "followUp" | "expeditionDetail" | null
  >(null);
  const [selectedCourier, setSelectedCourier] = React.useState<string | null>(null);

  const openResiModal = (
    title: string,
    data: any[],
    type: "belumKirim" | "followUp" | "expeditionDetail",
    courier: string | null = null
  ) => {
    setModalTitle(title);
    setModalData(data);
    setModalType(type);
    setSelectedCourier(courier);
    setIsModalOpen(true);
  };

  const handleOpenBelumKirimModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }
    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .eq("flag", "NO")
      .eq("created::date", formattedDate); // Changed to filter by date part
      
    if (error) {
      showError("Gagal memuat data resi yang belum dikirim.");
      console.error("Error fetching Belum Kirim data:", error);
      return;
    }
    openResiModal("Detail Resi Belum Dikirim", data || [], "belumKirim");
  };

  const handleOpenFollowUpFlagNoModal = async () => {
    const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd'); // Get actual current date formatted

    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .eq("flag", "NO")
      .neq("created::date", actualCurrentFormattedDate); // Filter by date part, not equal to actual current date

    if (error) {
      showError("Gagal memuat data Follow Up (Flag NO kecuali hari ini).");
      console.error("Error fetching Follow Up (Flag NO except today):", error);
      return;
    }
    openResiModal("Detail Resi Follow Up", data || [], "belumKirim");
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
    openResiModal("Detail Resi Scan Follow Up (Scan Tidak Sesuai Tanggal)", data || [], "followUp");
  };

  const handleOpenExpeditionDetailModal = async (courierName: string) => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }
    // Fetch data directly from Supabase for the specific courier and selected date
    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .eq("couriername", courierName)
      .eq("flag", "NO")
      .eq("created::date", formattedDate); // Filter by date part

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
    try {
      // 1. Check if the resi already exists in tbl_resi
      const { data: existingResi, error: checkError } = await supabase
        .from("tbl_resi")
        .select("Resi")
        .eq("Resi", resiNumber)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw checkError;
      }

      if (existingResi) {
        // If it exists, update its schedule to 'batal'
        const { error: updateError } = await supabase
          .from("tbl_resi")
          .update({ schedule: "batal" })
          .eq("Resi", resiNumber);

        if (updateError) throw updateError;
        showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      } else {
        // If it doesn't exist, fetch data from tbl_expedisi and insert
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
            created: expedisiData.created, // Use created from tbl_expedisi
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
      // 1. Update tbl_expedisi.flag to 'YES'
      const { error: expUpdateError } = await supabase
        .from("tbl_expedisi")
        .update({ flag: "YES" })
        .eq("resino", resiNumber);

      if (expUpdateError) {
        throw new Error(`Gagal mengkonfirmasi resi ${resiNumber} di tbl_expedisi: ${expUpdateError.message}`);
      }

      // Fetch couriername from tbl_expedisi for Keterangan
      const { data: expedisiData, error: expFetchError } = await supabase
        .from("tbl_expedisi")
        .select("couriername")
        .eq("resino", resiNumber)
        .single();

      if (expFetchError || !expedisiData) {
        throw new Error(`Gagal mendapatkan data ekspedisi untuk resi ${resiNumber}: ${expFetchError?.message || "Data tidak ditemukan"}`);
      }

      const courierName = expedisiData.couriername;

      // 2. Check if the resi already exists in tbl_resi
      const { data: existingResi, error: checkResiError } = await supabase
        .from("tbl_resi")
        .select("Resi")
        .eq("Resi", resiNumber)
        .single();

      if (checkResiError && checkResiError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw checkResiError;
      }

      const currentTimestamp = new Date().toISOString(); // Use current date for tbl_resi.created

      if (existingResi) {
        // If it exists, update its properties
        const { error: updateResiError } = await supabase
          .from("tbl_resi")
          .update({
            created: currentTimestamp, // Update to today's date
            Keterangan: courierName, // Set Keterangan based on couriername
            nokarung: "0", // Set nokarung to 0
            // schedule will be updated by the trigger based on the new 'created' date
          })
          .eq("Resi", resiNumber);

        if (updateResiError) throw updateResiError;
        showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      } else {
        // If it doesn't exist, insert a new entry
        const { error: insertResiError } = await supabase
          .from("tbl_resi")
          .insert({
            Resi: resiNumber,
            created: currentTimestamp, // Use today's date
            Keterangan: courierName, // Set Keterangan based on couriername
            nokarung: "0", // Set nokarung to 0
            // schedule will be set by the trigger
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