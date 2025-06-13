import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import SummaryCard from "@/components/SummaryCard";
import ExpeditionDetailCard from "@/components/ExpeditionDetailCard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CalendarDays, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import ResiDetailModal from "@/components/ResiDetailModal";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardModals } from "@/hooks/useDashboardModals"; // Import the new hook

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
    formattedDate,
    allExpedisiData,
  } = useDashboardData(date);

  const {
    isModalOpen,
    modalTitle,
    modalData,
    modalType,
    selectedCourier,
    handleOpenBelumKirimModal,
    handleOpenFollowUpFlagNoModal,
    handleOpenScanFollowupModal,
    handleOpenExpeditionDetailModal,
    handleCloseModal,
    handleBatalResi,
    handleConfirmResi,
    handleCekfuToggle,
  } = useDashboardModals({ date, formattedDate, allExpedisiData });

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