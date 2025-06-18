"use client";

import React, { useState } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import SummaryCard from "@/components/SummaryCard";
import ExpeditionDetailCard from "@/components/ExpeditionDetailCard";
import ResiDetailModal from "@/components/ResiDetailModal";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardModals } from "@/hooks/useDashboardModals";
import { showSuccess, showError } from "@/utils/toast"; // Import toast utilities

const DashboardPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

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
    allExpedisiData, // This is the comprehensive map of all expedisi data
  } = useDashboardData(selectedDate);

  const {
    isModalOpen,
    modalTitle,
    modalData,
    modalType,
    selectedCourier,
    handleOpenTransaksiHariIniModal,
    handleOpenBelumKirimModal,
    handleOpenFollowUpFlagNoModal,
    handleOpenScanFollowupModal,
    handleOpenExpeditionDetailModal,
    handleCloseModal,
    handleBatalResi,
    handleConfirmResi,
    handleCekfuToggle,
  } = useDashboardModals({ date: selectedDate, formattedDate, allExpedisiData });

  const isLoadingAny =
    isLoadingTransaksiHariIni ||
    isLoadingTotalScan ||
    isLoadingIdRekCount ||
    isLoadingBelumKirim ||
    isLoadingFollowUpFlagNoCount ||
    isLoadingScanFollowupLateCount ||
    isLoadingBatalCount ||
    isLoadingFollowUp;

  // Sort expeditionSummaries alphabetically by name
  const sortedExpeditionSummaries = React.useMemo(() => {
    return [...expeditionSummaries].sort((a, b) => a.name.localeCompare(b.name));
  }, [expeditionSummaries]);

  return (
    <React.Fragment>
      <div className="p-4 md:p-6 bg-gray-50 min-h-[calc(100vh-64px)] mt-16">
        <div className="max-w-7xl mx-auto">
          {/* Date Picker Section */}
          <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
              <CalendarIcon className="mr-2 h-6 w-6" /> Pilih Tanggal Dashboard
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-picker"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white text-gray-800",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Summary Cards Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              title="Transaksi Hari Ini"
              value={isLoadingTransaksiHariIni ? <Loader2 className="h-5 w-5 animate-spin" /> : transaksiHariIni}
              secondaryTitle="Tanggal"
              secondaryValue={formattedDate}
              gradientFrom="from-blue-500"
              gradientTo="to-indigo-600"
              icon="package"
              onClick={handleOpenTransaksiHariIniModal}
            />
            <SummaryCard
              title="Total Scan"
              value={isLoadingTotalScan ? <Loader2 className="h-5 w-5 animate-spin" /> : totalScan}
              gradientFrom="from-green-500"
              gradientTo="to-teal-600"
              icon="maximize"
            />
            <SummaryCard
              title="ID Rekomendasi"
              value={isLoadingIdRekCount ? <Loader2 className="h-5 w-5 animate-spin" /> : idRekCount}
              gradientFrom="from-purple-500"
              gradientTo="to-pink-600"
              icon="info"
            />
            <SummaryCard
              title="Belum Kirim (Hari Ini)"
              value={isLoadingBelumKirim ? <Loader2 className="h-5 w-5 animate-spin" /> : belumKirim}
              gradientFrom="from-red-500"
              gradientTo="to-orange-600"
              icon="warning"
              onClick={handleOpenBelumKirimModal}
            />
            <SummaryCard
              title="Follow Up (Belum Kirim)"
              value={isLoadingFollowUpFlagNoCount ? <Loader2 className="h-5 w-5 animate-spin" /> : followUpFlagNoCount}
              gradientFrom="from-yellow-500"
              gradientTo="to-amber-600"
              icon="clock"
              onClick={handleOpenFollowUpFlagNoModal}
            />
            <SummaryCard
              title="Scan Follow Up (Tidak Sesuai Tanggal)"
              value={isLoadingScanFollowupLateCount ? <Loader2 className="h-5 w-5 animate-spin" /> : scanFollowupLateCount}
              gradientFrom="from-cyan-500"
              gradientTo="to-blue-600"
              icon="clock"
              onClick={handleOpenScanFollowupModal}
            />
            <SummaryCard
              title="Batal"
              value={isLoadingBatalCount ? <Loader2 className="h-5 w-5 animate-spin" /> : batalCount}
              gradientFrom="from-gray-500"
              gradientTo="to-gray-700"
              icon="warning"
            />
          </div>

          {/* Expedition Details Section */}
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Detail Ekspedisi</h2>
          {isLoadingAny ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Memuat detail ekspedisi...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedExpeditionSummaries.length > 0 ? (
                sortedExpeditionSummaries.map((summary) => (
                  <div
                    key={summary.name}
                    className="relative overflow-hidden rounded-lg shadow-lg transform transition-transform hover:scale-105"
                    onClick={() => handleOpenExpeditionDetailModal(summary.name)}
                  >
                    {/* Dynamic gradient based on expedition name or a default */}
                    <div
                      className={cn(
                        "absolute inset-0",
                        summary.name === "ID" && "bg-gradient-to-r from-blue-600 to-purple-700",
                        summary.name === "JNE" && "bg-gradient-to-r from-red-600 to-red-800",
                        summary.name === "SPX" && "bg-gradient-to-r from-orange-500 to-orange-700",
                        summary.name === "INSTAN" && "bg-gradient-to-r from-green-500 to-green-700",
                        summary.name === "SICEPAT" && "bg-gradient-to-r from-yellow-500 to-yellow-700",
                        !["ID", "JNE", "SPX", "INSTAN", "SICEPAT"].includes(summary.name) && "bg-gradient-to-r from-gray-400 to-gray-600" // Default for others
                      )}
                    ></div>
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
                ))
              ) : (
                <p className="col-span-full text-center text-gray-600">Tidak ada data ekspedisi untuk tanggal ini.</p>
              )}
            </div>
          )}
        </div>
        <MadeWithDyad />
      </div>

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
    </React.Fragment>
  );
};

export default DashboardPage;