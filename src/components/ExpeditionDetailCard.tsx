import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExpeditionDetailCardProps {
  name: string;
  totalTransaksi: number;
  totalScan: number;
  sisa: number;
  jumlahKarung: number;
  idRekomendasi?: number;
}

const ExpeditionDetailCard: React.FC<ExpeditionDetailCardProps> = ({
  name,
  totalTransaksi,
  totalScan,
  sisa,
  jumlahKarung,
  idRekomendasi,
}) => {
  const showIdRekomendasi = name === "ID" && idRekomendasi !== undefined;

  return (
    <Card className="bg-white shadow-md rounded-lg p-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-gray-800">{name}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm text-gray-700">
        <div>
          <p>Total Transaksi:</p>
          <p>Total Scan:</p>
          <p>Sisa:</p>
          <p>Jumlah Karung:</p>
          {showIdRekomendasi && <p>ID Rekomendasi:</p>}
        </div>
        <div className="text-right font-medium">
          <p>{totalTransaksi}</p>
          <p>{totalScan}</p>
          <p>{sisa}</p>
          <p>{jumlahKarung}</p>
          {showIdRekomendasi && <p>{idRekomendasi}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpeditionDetailCard;