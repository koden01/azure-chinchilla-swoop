"use client";

import React, { useState } from "react";
import ResiDetailModal from "@/components/ResiDetailModal";
import DashboardDatePicker from "@/components/dashboard/DashboardDatePicker";
import DashboardSummaryCards from "@/components/dashboard/DashboardSummaryCards";
import DashboardExpeditionDetails from "@/components/dashboard/DashboardExpeditionDetails";
import { useCombinedDashboardData } from "@/hooks/dashboard/useCombinedDashboardData";
import { useDashboardModals } from "@/hooks/useDashboardModals";

const DashboardPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const {
    transaksiHariIni,
    isLoadingTransaksiHariIni,
    totalScan,
    isLoadingTotalScan,
    belumKirim,
    isLoadingBelumKirim,
    followUpFlagNoCount,
    isLoadingFollowUpFlagNoCount,
    scanFollowupLateCount,
    isLoadingScanFollowupLateCount,
    batalCount,
    isLoadingBatalCount,
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate,
    allExpedisiData,
    isLoadingAllResi,
    isLoadingExpedisiDataForSelectedDate,
    isLoadingAllExpedisiUnfiltered,
  } = useCombinedDashboardData(selectedDate);

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
    onConfirmResi,
    onCekfuToggle,
  } = useDashboardModals({ date: selectedDate, formattedDate, allExpedisiData });

  const isLoadingAny =
    isLoadingTransaksiHariIni ||
    isLoadingTotalScan ||
    isLoadingBelumKirim ||
    isLoadingFollowUpFlagNoCount ||
    isLoadingScanFollowupLateCount ||
    isLoadingBatalCount ||
    isLoadingFollowUp ||
    isLoadingAllResi ||
    isLoadingExpedisiDataForSelectedDate ||
    isLoadingAllExpedisiUnfiltered;

  // Sort expeditionSummaries alphabetically by name
  const sortedExpeditionSummaries = React.useMemo(() => {
    return [...expeditionSummaries].sort((a, b) => a.name.localeCompare(b.name));
  }, [expeditionSummaries]);

  return (
    <React.Fragment>
      <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Date Picker Section */}
          <DashboardDatePicker
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />

          {/* Summary Cards Section */}
          <DashboardSummaryCards
            transaksiHariIni={transaksiHariIni}
            isLoadingTransaksiHariIni={isLoadingTransaksiHariIni}
            totalScan={totalScan}
            isLoadingTotalScan={isLoadingTotalScan}
            belumKirim={belumKirim}
            isLoadingBelumKirim={isLoadingBelumKirim}
            followUpFlagNoCount={followUpFlagNoCount}
            isLoadingFollowUpFlagNoCount={isLoadingFollowUpFlagNoCount}
            scanFollowupLateCount={scanFollowupLateCount}
            isLoadingScanFollowupLateCount={isLoadingScanFollowupLateCount}
            batalCount={batalCount}
            isLoadingBatalCount={isLoadingBatalCount}
            handleOpenTransaksiHariIniModal={handleOpenTransaksiHariIniModal}
            handleOpenBelumKirimModal={handleOpenBelumKirimModal}
            handleOpenFollowUpFlagNoModal={handleOpenFollowUpFlagNoModal}
            handleOpenScanFollowupModal={handleOpenScanFollowupModal}
          />

          {/* Expedition Details Section */}
          <DashboardExpeditionDetails
            sortedExpeditionSummaries={sortedExpeditionSummaries}
            isLoadingAny={isLoadingAny}
            handleOpenExpeditionDetailModal={handleOpenExpeditionDetailModal}
          />
        </div>
      </div>

      <ResiDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        data={modalData}
        modalType={modalType}
        selectedCourier={selectedCourier}
        onBatalResi={handleBatalResi}
        onConfirmResi={onConfirmResi}
        onCekfuToggle={onCekfuToggle}
      />
    </React.Fragment>
  );
};

export default DashboardPage;