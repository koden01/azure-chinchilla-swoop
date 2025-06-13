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
      showError("Tanggal belum dipilih.");
      return;
    }
    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .eq("flag", "NO")
      .gte("created", startOfDay(date).toISOString())
      .lt("created", endOfDay(date).toISOString());

    if (error) {
      showError("Gagal memuat data Resi Belum Dikirim.");
      console.error("Error fetching Belum Kirim data:", error);
      return;
    }
    openResiModal("Detail Resi Belum Dikirim", data || [], "belumKirim");
  };

  const handleOpenFollowUpFlagNoModal = async () => {
    const actualCurrentDate = new Date();
    const startOfActualCurrentDay = startOfDay(actualCurrentDate).toISOString();

    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu")
      .eq("flag", "NO")
      .lt("created", startOfActualCurrentDay);

    if (error) {
      showError("Gagal memuat data Follow Up (Flag NO kecuali hari ini).");
      console.error("Error fetching Follow Up (Flag NO except today):", error);
      return;
    }
    openResiModal("Detail Resi Follow Up", data || [], "belumKirim");
  };

  const handleOpenScanFollowupModal = async () => {
    if (!date) {
      showError("Tanggal belum dipilih.");
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

  const handleOpenExpeditionDetailModal = (courierName: string) => {
    if (!date || !allExpedisiData) {
      showError("Data belum siap.");
      return;
    }
    const startOfSelectedDay = startOfDay(date).getTime();
    const endOfSelectedDay = endOfDay(date).getTime();

    const filteredExpeditionData = allExpedisiData.filter(item =>
      item.couriername === courierName &&
      item.flag === "NO" &&
      new Date(item.created).getTime() >= startOfSelectedDay &&
      new Date(item.created).getTime() <= endOfSelectedDay
    );
    openResiModal(`Detail Resi ${courierName} (Belum Kirim)`, filteredExpeditionData, "expeditionDetail", courierName);
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
        showSuccess(`Resi ${resiNumber} berhasil dibatalkan (diperbarui).`);
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
        showSuccess(`Resi ${resiNumber} berhasil dibatalkan (baru diinput).`);
      }

      invalidateDashboardQueries(queryClient, date);
      setModalData(prevData => prevData.filter(item => (item.resino || item.Resi) !== resiNumber));

    } catch (error: any) {
      showError(`Gagal membatalkan resi ${resiNumber}: ${error.message || "Unknown error"}`);
      console.error("Error batal resi:", error);
    }
  };

  const handleConfirmResi = async (resiNumber: string) => {
    const { error: expError } = await supabase
      .from("tbl_expedisi")
      .update({ flag: "YES" })
      .eq("resino", resiNumber);

    if (expError) {
      showError(`Gagal mengkonfirmasi resi ${resiNumber} di tbl_expedisi.`);
      console.error("Error confirming resi in tbl_expedisi:", expError);
      return;
    }

    const { error: resiError } = await supabase
      .from("tbl_resi")
      .update({ schedule: "ontime" })
      .eq("Resi", resiNumber);

    if (resiError) {
      showError(`Gagal mengkonfirmasi resi ${resiNumber} di tbl_resi.`);
      console.error("Error confirming resi in tbl_resi:", resiError);
      return;
    }

    showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
    invalidateDashboardQueries(queryClient, date);
    setModalData(prevData => prevData.filter(item => (item.resino || item.Resi) !== resiNumber));
  };

  const handleCekfuToggle = async (resiNumber: string, currentCekfuStatus: boolean) => {
    const { error } = await supabase
      .from("tbl_expedisi")
      .update({ cekfu: !currentCekfuStatus })
      .eq("resino", resiNumber);

    if (error) {
      showError(`Gagal memperbarui status CEKFU untuk resi ${resiNumber}.`);
      console.error("Error updating CEKFU status:", error);
    } else {
      showSuccess(`Status CEKFU untuk resi ${resiNumber} berhasil diperbarui.`);
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