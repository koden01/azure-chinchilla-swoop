"use client";

import React from "react";
import DashboardDatePicker from "@/components/dashboard/DashboardDatePicker";
import DashboardSummaryCards from "@/components/dashboard/DashboardSummaryCards";
import DashboardExpeditionDetails from "@/components/dashboard/DashboardExpeditionDetails";
import ResiDetailModal from "@/components/ResiDetailModal";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardModals } from "@/hooks/useDashboardModals";
import { Loader2 } from "lucide-react";
import { MadeWithDyad } from "@/components/made-with-dyad"; // Ensure this is imported if used

const DashboardPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

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
    expeditionSummaries,
    formattedDate,
    allExpedisiData, // Pass this to useDashboardModals
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

  // Sort expedition summaries alphabetically by name
  const sortedExpeditionSummaries = React.useMemo(() => {
    return [...expeditionSummaries].sort((a, b) => a.name.localeCompare(b.name));
  }, [expeditionSummaries]);

  const isLoadingAnyDashboardData =
    isLoadingTransaksiHariIni ||
    isLoadingTotalScan ||
    isLoadingIdRekCount ||
    isLoadingBelumKirim ||
    isLoadingFollowUpFlagNoCount ||
    isLoadingScanFollowupLateCount ||
    isLoadingBatalCount;

  return (
    <React.Fragment>
      <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
        <DashboardDatePicker
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />

        <DashboardSummaryCards
          transaksiHariIni={transaksiHariIni}
          isLoadingTransaksiHariIni={isLoadingTransaksiHariIni}
          totalScan={totalScan}
          isLoadingTotalScan={isLoadingTotalScan}
          idRekCount={idRekCount}
          isLoadingIdRekCount={isLoadingIdRekCount}
          belumKirim={belumKirim}
          isLoadingBelumKirim={isLoadingBelumKirim}
          followUpFlagNoCount={followUpFlagNoCount}
          isLoadingFollowUpFlagNoCount={isLoadingFollowUpFlagNoCount}
          scanFollowupLateCount={scanFollowupLateCount}
          isLoadingScanFollowupLateCount={isLoadingScanFollowupLateCount}
          batalCount={batalCount}
          isLoadingBatalCount={isLoadingBatalCount}
          formattedDate={formattedDate}
          handleOpenTransaksiHariIniModal={handleOpenTransaksiHariIniModal}
          handleOpenBelumKirimModal={handleOpenBelumKirimModal}
          handleOpenFollowUpFlagNoModal={handleOpenFollowUpFlagNoModal}
          handleOpenScanFollowupModal={handleOpenScanFollowupModal}
        />

        <DashboardExpeditionDetails
          sortedExpeditionSummaries={sortedExpeditionSummaries}
          isLoadingAny={isLoadingAnyDashboardData}
          handleOpenExpeditionDetailModal={handleOpenExpeditionDetailModal}
        />
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