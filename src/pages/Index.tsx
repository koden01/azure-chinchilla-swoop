import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExpeditionDetailCard } from "@/components/ExpeditionDetailCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";

export default function Index() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

  const {
    transaksiHariIniCount,
    belumKirimCount,
    scanFollowUpCount,
    expeditionCounts,
    idRekomendasiCount, // Get the new count
    isLoading,
  } = useDashboardData(date || new Date());

  const expeditionOrder = ["JNE", "SPX", "ID", "ANTERAJA", "SICEPAT", "NINJA", "JNT", "LAIN-LAIN"];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard Expedisi</h1>

      <div className="mb-6">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[200px] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ExpeditionDetailCard
            expeditionName="Total Transaksi Hari Ini"
            totalTransaksi={transaksiHariIniCount}
            belumKirim={belumKirimCount}
            scanFollowUp={scanFollowUpCount}
            showIdRekomendasi={false} // This card doesn't show ID Rekomendasi
            className="bg-blue-50 border-blue-200"
          />
          {expeditionOrder.map((expName) => {
            const data = expeditionCounts[expName] || { total: 0, belumKirim: 0, scanFollowUp: 0 };
            const showIdRekomendasiForCard = expName === "ID";
            return (
              <ExpeditionDetailCard
                key={expName}
                expeditionName={expName}
                totalTransaksi={data.total}
                belumKirim={data.belumKirim}
                scanFollowUp={data.scanFollowUp}
                showIdRekomendasi={showIdRekomendasiForCard}
                idRekomendasiCount={showIdRekomendasiForCard ? idRekomendasiCount : undefined} // Pass the count only for ID card
              />
            );
          })}
        </div>
      )}
    </div>
  );
}