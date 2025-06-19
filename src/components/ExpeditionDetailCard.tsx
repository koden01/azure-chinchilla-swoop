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
  // gradientFrom dan gradientTo tidak lagi digunakan karena gradien diterapkan di parent
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
}) => {
  // CRITICAL DEBUG LOG: Check exact props received by this card
  console.log(`--- ExpeditionDetailCard DEBUG for ${name} ---`);
  console.log(`  totalTransaksi: ${totalTransaksi}`);
  console.log(`  totalScan: ${totalScan}`);
  console.log(`  sisa: ${sisa}`);
  console.log(`  jumlahKarung: ${jumlahKarung}`);
  console.log(`  idRekomendasi: ${idRekomendasi}`);
  console.log(`  totalBatal: ${totalBatal}`);
  console.log(`  totalScanFollowUp: ${totalScanFollowUp}`);
  console.log(`---------------------------------------------`);

  const showIdRekomendasi = name === "ID" && idRekomendasi !== undefined;

  return (
    <Card
      className={`rounded-lg shadow-md transform transition-transform hover:scale-105 cursor-pointer bg-transparent border border-white/30 text-white`}
    >
      {/* Lapisan gradien dihapus dari sini, akan diterapkan di parent div di DashboardPage */}
      <div className="relative z-10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-white">{name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm text-white">
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