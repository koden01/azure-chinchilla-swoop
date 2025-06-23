"use client";

import React from "react";
import ExpeditionDetailCard from "@/components/ExpeditionDetailCard";
import { Loader2 } from "lucide-react";

interface ExpeditionSummary {
  name: string;
  totalTransaksi: number;
  totalScan: number;
  sisa: number;
  jumlahKarung: number;
  idRekomendasi?: number;
  totalBatal: number;
  totalScanFollowUp: number;
}

interface DashboardExpeditionDetailsProps {
  sortedExpeditionSummaries: ExpeditionSummary[];
  isLoadingAny: boolean;
  handleOpenExpeditionDetailModal: (courierName: string) => void;
}

const DashboardExpeditionDetails: React.FC<DashboardExpeditionDetailsProps> = ({
  sortedExpeditionSummaries,
  isLoadingAny,
  handleOpenExpeditionDetailModal,
}) => {
  return (
    <React.Fragment>
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
    </React.Fragment>
  );
};

export default DashboardExpeditionDetails;