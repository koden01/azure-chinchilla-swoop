import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, safeFormatDate } from "@/lib/utils"; // Import safeFormatDate
import { id } from "date-fns/locale";

interface ExpeditionDetailCardProps {
  expeditionName: string;
  totalTransaksi: number;
  belumKirim: number;
  scanFollowUp: number;
  idRekomendasiCount?: number; // New prop for ID Rekomendasi count
  showIdRekomendasi: boolean;
  className?: string;
}

export function ExpeditionDetailCard({
  expeditionName,
  totalTransaksi,
  belumKirim,
  scanFollowUp,
  idRekomendasiCount,
  showIdRekomendasi,
  className,
}: ExpeditionDetailCardProps) {
  const today = safeFormatDate(new Date(), "dd MMMM yyyy", "-", { locale: id }); // Use safeFormatDate

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="text-lg">{expeditionName}</CardTitle>
        <p className="text-sm text-muted-foreground">{today}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="font-semibold">
            <p>Total Transaksi:</p>
            <p>Belum Kirim:</p>
            <p>Scan Follow Up:</p>
            {showIdRekomendasi && <p>ID Rekomendasi:</p>}
          </div>
          <div className="text-right font-medium">
            <p>{totalTransaksi}</p>
            <p>{belumKirim}</p>
            <p>{scanFollowUp}</p>
            {showIdRekomendasi && <p>{idRekomendasiCount !== undefined ? idRekomendasiCount : '-'}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}