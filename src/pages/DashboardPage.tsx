"use client";

import React, { useState } from "react";
import ResiDetailModal from "@/components/ResiDetailModal";
import DashboardDatePicker from "@/components/dashboard/DashboardDatePicker";
import DashboardSummaryCards from "@/components/dashboard/DashboardSummaryCards";
import DashboardExpeditionDetails from "@/components/dashboard/DashboardExpeditionDetails";
import { useCombinedDashboardData } from "@/hooks/dashboard/useCombinedDashboardData"; // Updated import
import { useDashboardModals } from "@/hooks/useDashboardModals";

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
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate,
    allExpedisiData,
    isLoadingAllResi, // Ensure this is destructured here
    isLoadingExpedisiDataForSelectedDate, // Ensure this is destructured here
    isLoadingAllExpedisiUnfiltered, // Ensure this is destructured here
  } = useCombinedDashboardData(selectedDate); // Updated hook call

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
    onCekfuToggle,
  } = useDashboardModals({ date: selectedDate, formattedDate, allExpedisiData });

  const isLoadingAny =
    isLoadingTransaksiHariIni ||
    isLoadingTotalScan ||
    isLoadingIdRekCount ||
    isLoadingBelumKirim ||
    isLoadingFollowUpFlagNoCount ||
    isLoadingScanFollowupLateCount ||
    isLoadingBatalCount ||
    isLoadingFollowUp ||
    isLoadingAllResi || // Include in overall loading check
    isLoadingExpedisiDataForSelectedDate || // Include in overall loading check
    isLoadingAllExpedisiUnfiltered; // Include in overall loading check

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
        onConfirmResi={handleConfirmResi}
        onCekfuToggle={onCekfuToggle}
      />
    </React.Fragment>
  );
};

export default DashboardPage;