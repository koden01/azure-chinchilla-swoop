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
  // gradientFrom?: string; // Dihapus karena tidak lagi digunakan untuk styling internal
  // gradientTo?: string; // Dihapus karena tidak lagi digunakan untuk styling internal
}

const ExpeditionDetailCard: React.FC<ExpeditionDetailCardProps> = React.memo(({
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
  // console.log(`--- ExpeditionDetailCard DEBUG for ${name} ---`); // Removed
  // console.log(`  totalTransaksi: ${totalTransaksi}`); // Removed
  // console.log(`  totalScan: ${totalScan}`); // Removed
  // console.log(`  sisa: ${sisa}`); // Removed
  // console.log(`  jumlahKarung: ${jumlahKarung}`); // Removed
  // console.log(`  idRekomendasi: ${idRekomendasi}`); // Removed
  // console.log(`  totalBatal: ${totalBatal}`); // Removed
  // console.log(`  totalScanFollowUp: ${totalScanFollowUp}`); // Removed
  // console.log(`---------------------------------------------`); // Removed

  const showIdRekomendasi = name === "ID" && idRekomendasi !== undefined;

  return (
    <Card
      className={`rounded-lg shadow-md transform transition-transform hover:scale-105 cursor-pointer bg-gradient-to-r from-blue-600 to-purple-700 text-white`}
    >
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
});

export default ExpeditionDetailCard;