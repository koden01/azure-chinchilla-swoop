import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExpeditionDetailCardProps {
  name: string;
  totalTransaksi: number;
  totalScan: number;
  sisa: number;
  jumlahKarung: number;
  idRekomendasi?: number;
  totalBatal: number; // New prop
  totalScanFollowUp: number; // New prop
  gradientFrom?: string; // New prop for styling
  gradientTo?: string; // New prop for styling
}

const ExpeditionDetailCard: React.FC<ExpeditionDetailCardProps> = ({
  name,
  totalTransaksi,
  totalScan,
  sisa,
  jumlahKarung,
  idRekomendasi,
  totalBatal, // Destructure new prop
  totalScanFollowUp, // Destructure new prop
  gradientFrom = "from-gray-400", // Default gradient if not provided
  gradientTo = "to-gray-600", // Default gradient if not provided
}) => {
  const showIdRekomendasi = name === "ID" && idRekomendasi !== undefined;

  return (
    <Card
      className={`relative overflow-hidden rounded-lg shadow-lg transform transition-transform hover:scale-105 cursor-pointer text-white`}
    >
      {/* Lapisan gradien sebagai latar belakang */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}
      ></div>
      {/* Konten kartu dengan z-index untuk memastikan di atas gradien */}
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
            <p>Batal:</p> {/* New field */}
            <p>Scan Follow Up:</p> {/* New field */}
            {showIdRekomendasi && <p>ID Rekomendasi:</p>}
          </div>
          <div className="text-right font-medium">
            <p>{totalTransaksi}</p>
            <p>{totalScan}</p>
            <p>{sisa}</p>
            <p>{jumlahKarung}</p>
            <p>{totalBatal}</p> {/* Display new value */}
            <p>{totalScanFollowUp}</p> {/* Display new value */}
            {showIdRekomendasi && <p>{idRekomendasi}</p>}
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default ExpeditionDetailCard;