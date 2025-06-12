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
import { useDashboardData } from "@/hooks/useDashboardData"; // Import the new hook

const Index = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const queryClient = useQueryClient();

  const {
    transaksiHariIni,
    isLoadingTransaksiHariIni,
    totalScan,
    isLoadingTotalScan,
    idRekomendasi,
    isLoadingIdRekomendasi,
    belumKirim, // This now represents flag = 'NO'
    isLoadingBelumKirim,
    batalCount,
    isLoadingBatalCount,
    followUpData, // This data is still fetched but not directly displayed on a card anymore
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate, // Get formattedDate from the hook
  } = useDashboardData(date); // Use the new hook

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalData, setModalData] = React.useState<any[]>([]);
  const [modalType, setModalType] = React.useState<
    "belumKirim" | "followUp" | "expeditionDetail" | null
  >(null);
  const [selectedCourier, setSelectedCourier] = React.useState<string | null>(null);

  const handleOpenBelumKirimModal = async () => {
    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("*")
      .eq("flag", "NO")
      .gte("created", startOfDay(date!).toISOString())
      .lt("created", endOfDay(date!).toISOString());
    if (error) {
      showError("Gagal memuat data Belum Kirim.");
      console.error("Error fetching Belum Kirim:", error);
      return;
    }
    setModalTitle("Detail Resi Belum Dikirim");
    setModalData(data || []);
    setModalType("belumKirim");
    setIsModalOpen(true);
  };

  const handleOpenFollowUpModal = async () => {
    // This function is still available but not directly linked to a card anymore
    // The "Follow Up" card now uses handleOpenBelumKirimModal
    const { data, error } = await supabase.rpc("get_scan_follow_up", {
      selected_date: formattedDate,
    });
    if (error) {
      showError("Gagal memuat data Follow Up.");
      console.error("Error fetching Follow Up:", error);
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

    setModalTitle("Detail Resi Follow Up (Scan Tidak Sesuai Tanggal)");
    setModalData(resiWithCekfu || []);
    setModalType("followUp");
    setIsModalOpen(true);
  };

  const handleOpenExpeditionDetailModal = async (courierName: string) => {
    setSelectedCourier(courierName);
    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("*")
      .eq("couriername", courierName)
      .eq("flag", "NO") // Only show 'NO' status as per request
      .gte("created", startOfDay(date!).toISOString())
      .lt("created", endOfDay(date!).toISOString());
    if (error) {
      showError(`Gagal memuat detail ekspedisi ${courierName}.`);
      console.error(`Error fetching expedition detail for ${courierName}:`, error);
      return;
    }
    setModalTitle(`Detail Resi ${courierName} (Belum Kirim)`);
    setModalData(data || []);
    setModalType("expeditionDetail");
    setIsModalOpen(true);
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
      queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["batalCount", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["allResi", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["allExpedisi", formattedDate] });
      handleCloseModal();
    }
  };

  const handleConfirmResi = async (resiNumber: string) => {
    // Update tbl_expedisi flag to 'YES'
    const { error: expError } = await supabase
      .from("tbl_expedisi")
      .update({ flag: "YES" })
      .eq("resino", resiNumber);

    if (expError) {
      showError(`Gagal mengkonfirmasi resi ${resiNumber} di tbl_expedisi.`);
      console.error("Error confirming resi in tbl_expedisi:", expError);
      return;
    }

    // Update tbl_resi schedule to 'ontime'
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
    queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["totalScan", formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["allResi", formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["allExpedisi", formattedDate] });
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
      queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["allExpedisi", formattedDate] });
      // Re-open modal with updated data if needed, or refetch modal data
      if (modalType === "belumKirim") {
        handleOpenBelumKirimModal();
      } else if (modalType === "followUp") {
        handleOpenFollowUpModal();
      }
    }
  };

  return (
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
          title="Terisi Hari Ini"
          value={isLoadingTransaksiHariIni ? "Loading..." : transaksiHariIni || 0}
          gradientFrom="from-green-400"
          gradientTo="to-blue-500"
          icon="package"
        />
        <SummaryCard
          title="Total Scan"
          value={isLoadingTotalScan ? "Loading..." : totalScan || 0}
          gradientFrom="from-purple-500"
          gradientTo="to-pink-500"
          icon="maximize"
        />
        {/* Removed "Belum Dikirim" card as its logic is now part of "Follow Up" */}
        <SummaryCard
          title="Follow Up"
          value={isLoadingBelumKirim ? "Loading..." : belumKirim || 0}
          gradientFrom="from-orange-500"
          gradientTo="to-red-500"
          icon="warning"
          onClick={handleOpenBelumKirimModal} // Now opens the "Belum Dikirim" modal
        />
        <SummaryCard
          title="Batal"
          value={isLoadingBatalCount ? "Loading..." : batalCount || 0}
          gradientFrom="from-red-700"
          gradientTo="to-red-900"
          icon="info"
        />
        <SummaryCard
          title="ID Rekomendasi" {/* Renamed from "Scan Follow Up" */}
          value={isLoadingIdRekomendasi ? "Loading..." : idRekomendasi || 0}
          gradientFrom="from-blue-500"
          gradientTo="to-purple-600"
          icon="clock"
        />
      </div>

      {/* Detail per Expedisi Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Package className="mr-2 h-6 w-6" /> Detail per Expedisi
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {expeditionSummaries.map((summary) => (
            <div key={summary.name} onClick={() => handleOpenExpeditionDetailModal(summary.name)}>
              <ExpeditionDetailCard
                name={summary.name}
                totalTransaksi={summary.totalTransaksi}
                totalScan={summary.totalScan}
                sisa={summary.sisa}
                jumlahKarung={summary.jumlahKarung}
                idRekomendasi={summary.idRekomendasi}
              />
            </div>
          ))}
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
  );
};

export default Index;