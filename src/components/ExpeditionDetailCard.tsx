import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExpeditionDetailCardProps {
  name: string;
  totalTransaksi: number;
  totalScan: number;
  sisa: number;
  jumlahKarung: number;
  idRekomendasi?: number;
  totalBatal: number;
  totalScanFollowUp: number;
  // gradientFrom dan gradientTo tidak lagi digunakan untuk background card itu sendiri
  // tetapi tetap ada di props jika ada kebutuhan lain di masa depan
  gradientFrom?: string;
  gradientTo?: string;
}

const ExpeditionDetailCard: React.FC<ExpeditionDetailCardProps> = ({
  name,
  totalTransaksi,
  totalScan,
  sisa,
  jumlahKarung,
  idRekomendasi,
  totalBatal,
  totalScanFollowUp,
  // gradientFrom, // Tidak digunakan untuk styling internal card lagi
  // gradientTo, // Tidak digunakan untuk styling internal card lagi
}) => {
  const showIdRekomendasi = name === "ID" && idRekomendasi !== undefined;

  return (
    <Card
      className={`rounded-lg shadow-md transform transition-transform hover:scale-105 cursor-pointer bg-white border border-gray-200 text-foreground`}
    >
      {/* Lapisan gradien dihapus dari sini, akan diterapkan di parent div di DashboardPage */}
      <div className="relative z-10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">{name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm text-foreground">
          <div>
            <p>Total Transaksi:</p>
            <p>Total Scan:</p>
            <p>Sisa:</p>
            <p>Jumlah Karung:</p>
            <p>Batal:</p>
            <p>Scan Follow Up:</p>
            {showIdRekomendasi && <p>ID Rekomendasi:</p>}
          </div>
          <div className="text-right font-medium">
            <p>{totalTransaksi}</p>
            <p>{totalScan}</p>
            <p>{sisa}</p>
            <p>{jumlahKarung}</p>
            <p>{totalBatal}</p>
            <p>{totalScanFollowUp}</p>
            {showIdRekomendasi && <p>{idRekomendasi}</p>}
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default ExpeditionDetailCard;