"use client";

import React from "react";
import SummaryCard from "@/components/SummaryCard";
import { Loader2 } from "lucide-react";

interface DashboardSummaryCardsProps {
  transaksiHariIni: number | undefined;
  isLoadingTransaksiHariIni: boolean;
  totalScan: number | undefined;
  isLoadingTotalScan: boolean;
  idRekCount: number | undefined;
  isLoadingIdRekCount: boolean;
  belumKirim: number | undefined;
  isLoadingBelumKirim: boolean;
  followUpFlagNoCount: number | undefined;
  isLoadingFollowUpFlagNoCount: boolean;
  scanFollowupLateCount: number | undefined;
  isLoadingScanFollowupLateCount: boolean;
  batalCount: number | undefined;
  isLoadingBatalCount: boolean;
  formattedDate: string;
  handleOpenTransaksiHariIniModal: () => void;
  handleOpenBelumKirimModal: () => void;
  handleOpenFollowUpFlagNoModal: () => void;
  handleOpenScanFollowupModal: () => void;
}

const DashboardSummaryCards: React.FC<DashboardSummaryCardsProps> = ({
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
  handleOpenTransaksiHariIniModal,
  handleOpenBelumKirimModal,
  handleOpenFollowUpFlagNoModal,
  handleOpenScanFollowupModal,
}) => {
  return (
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
  );
};

export default DashboardSummaryCards;