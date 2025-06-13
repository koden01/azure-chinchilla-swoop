import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import SummaryCard from "@/components/SummaryCard";
import ExpeditionDetailCard from "@/components/ExpeditionDetailCard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CalendarDays, Package } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import ResiDetailModal from "@/components/ResiDetailModal";
import { useDashboardData } from "@/hooks/useDashboardData";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation"; // Import new utility

const DashboardPage: React.FC = () => {
  console.log("DashboardPage rendering...");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const queryClient = useQueryClient();

  const {
    transaksiHariIni,
    isLoadingTransaksiHariIni,
    totalScan,
    isLoadingTotalScan,
    idRekCount,
    isLoadingIdRekCount,
    belumKirim,
    isLoadingBelumKirim,
    followUpFlagNoCount,
    isLoadingFollowUpFlagNoCount,
    scanFollowupLateCount,
    isLoadingScanFollowupLateCount,
    batalCount,
    isLoadingBatalCount,
    followUpData,
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate,
    allExpedisiData, // Get allExpedisiData from the hook
  } = useDashboardData(date);

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

  const handleOpenBelumKirimModal = () => {
    if (!date || !allExpedisiData) {
      showError("Data belum siap.");
      return;
    }
    const startOfSelectedDay = startOfDay(date).getTime();
    const endOfSelectedDay = endOfDay(date).getTime();

    const filteredBelumKirim = allExpedisiData.filter(item =>
      item.flag === "NO" &&
      new Date(item.created).getTime() >= startOfSelectedDay &&
      new Date(item.created).getTime() <= endOfSelectedDay
    );
    console.log("Filtered Belum Kirim Data:", filteredBelumKirim); // Log data
    openResiModal("Detail Resi Belum Dikirim", filteredBelumKirim, "belumKirim");
  };

  const handleOpenFollowUpFlagNoModal = async () => {
    // This query still needs to fetch data outside the selected date range
    const actualCurrentDate = new Date();
    const startOfActualCurrentDay = startOfDay(actualCurrentDate).toISOString();

    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("resino, orderno, chanelsales, couriername, created, flag, datetrans, cekfu") // Select all necessary columns
      .eq("flag", "NO")
      .lt("created", startOfActualCurrentDay); // Records created BEFORE today

    if (error) {
      showError("Gagal memuat data Follow Up (Flag NO kecuali hari ini).");
      console.error("Error fetching Follow Up (Flag NO except today):", error);
      return;
    }
    openResiModal("Detail Resi Follow Up", data || [], "belumKirim"); // Judul disederhanakan
  };

  const handleOpenScanFollowupModal = async () => {
    const { data, error } = await supabase.rpc("get_scan_follow_up", {
      selected_date: formattedDate,
    });
    if (error) {
      showError("Gagal memuat data Scan Follow Up.");
      console.error("Error fetching Scan Follow Up:", error);
      return;
    }
    const resiWithCekfu = await Promise.all((data || []).map(async (item: any) => {
      const { data: expedisiDetail, error: expError } = await supabase
        .from("tbl_expedisi")
        .select("cekfu")
        .eq("resino", item.Resi)
        .single();
      return {
        ...item,
        cekfu: expedisiDetail?.cekfu || false,
      };
    }));

    openResiModal("Detail Resi Scan Follow Up (Scan Tidak Sesuai Tanggal)", resiWithCekfu || [], "followUp");
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
    const { error } = await supabase
      .from("tbl_resi")
      .update({ schedule: "batal" })
      .eq("Resi", resiNumber);

    if (error) {
      showError(`Gagal membatalkan resi ${resiNumber}.`);
      console.error("Error batal resi:", error);
    } else {
      showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      invalidateDashboardQueries(queryClient, date); // Use the new utility
      handleCloseModal();
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
    invalidateDashboardQueries(queryClient, date); // Use the new utility
    handleCloseModal();
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
      invalidateDashboardQueries(queryClient, date); // Use the new utility
      // Re-open the modal to reflect changes
      if (modalType === "belumKirim") {
        handleOpenBelumKirimModal();
      } else if (modalType === "followUp") {
        handleOpenScanFollowupModal();
      } else if (modalType === "expeditionDetail" && selectedCourier) {
        handleOpenExpeditionDetailModal(selectedCourier);
      }
    }
  };

  return (
    <>
      <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
        {/* Filter Tanggal Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg shadow-md">
          <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
            <CalendarDays className="mr-2 h-6 w-6" /> Filter Tanggal
          </h2>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full md:w-[280px] justify-start text-left font-normal bg-white text-gray-800 hover:bg-gray-100",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SummaryCard
            title="Transaksi Hari Ini"
            value={isLoadingTransaksiHariIni ? "Loading..." : transaksiHariIni || 0}
            sisaTitle="Sisa"
            sisaValue={isLoadingBelumKirim ? "Loading..." : belumKirim || 0}
            onSisaClick={handleOpenBelumKirimModal}
            gradientFrom="from-green-400"
            gradientTo="to-blue-500"
            icon="package"
          />
          <SummaryCard
            title="Total Scan"
            value={isLoadingTotalScan ? "Loading..." : totalScan || 0}
            secondaryTitle="ID Rekomendasi"
            secondaryValue={isLoadingIdRekCount ? "Loading..." : idRekCount || 0}
            gradientFrom="from-purple-500"
            gradientTo="to-pink-500"
            icon="maximize"
          />
          <SummaryCard
            title="Follow Up"
            value={isLoadingFollowUpFlagNoCount ? "Loading..." : followUpFlagNoCount || 0}
            gradientFrom="from-orange-500"
            gradientTo="to-red-500"
            icon="warning"
            onClick={handleOpenFollowUpFlagNoModal}
          />
          <SummaryCard
            title="Batal"
            value={isLoadingBatalCount ? "Loading..." : batalCount || 0}
            gradientFrom="from-red-700"
            gradientTo="to-red-900"
            icon="info"
          />
          <SummaryCard
            title="Scan Followup" 
            value={isLoadingScanFollowupLateCount ? "Loading..." : scanFollowupLateCount || 0}
            gradientFrom="from-blue-500"
            gradientTo="to-purple-600"
            icon="clock"
            onClick={handleOpenScanFollowupModal}
          />
        </div>

        {/* Detail per Expedisi Section */}
        <div className="space-y-4 p-6 rounded-lg shadow-md bg-gradient-to-r from-emerald-400 to-blue-400">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Package className="mr-2 h-6 w-6" /> Detail per Expedisi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expeditionSummaries.map((summary) => {
              return (
                <div key={summary.name} onClick={() => handleOpenExpeditionDetailModal(summary.name)}>
                  <ExpeditionDetailCard
                    name={summary.name}
                    totalTransaksi={summary.totalTransaksi}
                    totalScan={summary.totalScan}
                    sisa={summary.sisa}
                    jumlahKarung={summary.jumlahKarung}
                    idRekomendasi={summary.idRekomendasi}
                    totalBatal={summary.totalBatal}
                    totalScanFollowUp={summary.totalScanFollowUp}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <MadeWithDyad />

        <ResiDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={modalTitle}
          data={modalData}
          modalType={modalType}
          selectedCourier={selectedCourier}
          onBatalResi={handleBatalResi}
          onConfirmResi={handleConfirmResi}
          onCekfuToggle={handleCekfuToggle}
        />
      </div>
    </>
  );
};

export default DashboardPage;