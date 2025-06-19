import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SummaryCard } from "@/components/SummaryCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DataTable } from "@/components/ui/data-table";
import { columns as transaksiHariIniColumns } from "@/components/columns/transaksiHariIniColumns";
import { columns as belumKirimColumns } from "@/components/columns/belumKirimColumns";
import { columns as followUpColumns } from "@/components/columns/followUpColumns";
import { columns as flagNoExceptTodayColumns } from "@/components/columns/flagNoExceptTodayColumns";
import { columns as scanFollowUpColumns } from "@/components/columns/scanFollowUpColumns";
import { columns as batalColumns } from "@/components/columns/batalColumns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const [date, setDate] = useState<Date | undefined>(new Date());

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
    followUpData,
    isLoadingFollowUp,
    expeditionSummaries,
    formattedDate,
    expedisiDataForSelectedDate, // Data for Transaksi Hari Ini table
    allResiData, // Data for Belum Kirim, Scan Follow Up, Batal tables
  } = useDashboardData(date);

  return (
    <div className="hidden flex-col md:flex">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
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
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Transaksi Hari Ini"
            value={isLoadingTransaksiHariIni ? "Loading..." : transaksiHariIni?.toLocaleString() || "0"}
            // secondaryTitle="Tanggal" // Removed secondaryTitle
            // secondaryValue={formattedDate} // Removed secondaryValue
            description="Total transaksi hari ini"
            icon="package"
          />
          <SummaryCard
            title="Total Scan"
            value={isLoadingTotalScan ? "Loading..." : totalScan?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            description="Total resi yang sudah discan"
            icon="scan"
          />
          <SummaryCard
            title="ID Rekomendasi"
            value={isLoadingIdRekCount ? "Loading..." : idRekCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            description="Total resi ID Rekomendasi"
            icon="award"
          />
          <SummaryCard
            title="Belum Kirim"
            value={isLoadingBelumKirim ? "Loading..." : belumKirim?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            description="Total resi belum dikirim hari ini"
            icon="truck"
          />
          <SummaryCard
            title="Follow Up (Flag NO)"
            value={isLoadingFollowUpFlagNoCount ? "Loading..." : followUpFlagNoCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={format(new Date(), 'yyyy-MM-dd')} // Always show current date for this card
            description="Total resi flag NO (kecuali hari ini)"
            icon="alertCircle"
          />
          <SummaryCard
            title="Scan Follow Up"
            value={isLoadingScanFollowupLateCount ? "Loading..." : scanFollowupLateCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            description="Total resi scan follow up (late)"
            icon="history"
          />
          <SummaryCard
            title="Batal"
            value={isLoadingBatalCount ? "Loading..." : batalCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            description="Total resi yang dibatalkan"
            icon="xCircle"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Ringkasan Ekspedisi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expeditionSummaries.length > 0 ? (
                  expeditionSummaries.map((summary, index) => (
                    <div key={summary.name} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-none">{summary.name}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-sm text-muted-foreground">
                          Transaksi: {summary.totalTransaksi}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Scan: {summary.totalScan}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Sisa: {summary.sisa}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Karung: {summary.jumlahKarung}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ID Rekomendasi: {summary.idRekomendasi}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Batal: {summary.totalBatal}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Scan Follow Up: {summary.totalScanFollowUp}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">Tidak ada data ringkasan ekspedisi untuk tanggal ini.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Follow Up Data</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFollowUp ? (
                <div>Loading Follow Up Data...</div>
              ) : followUpData && followUpData.length > 0 ? (
                <DataTable columns={followUpColumns} data={followUpData} />
              ) : (
                <p className="text-center text-muted-foreground">Tidak ada data follow up untuk tanggal ini.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Detail Transaksi Hari Ini ({formattedDate})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingExpedisiDataForSelectedDate ? (
                <div>Loading detail transaksi...</div>
              ) : expedisiDataForSelectedDate && expedisiDataForSelectedDate.length > 0 ? (
                <DataTable columns={transaksiHariIniColumns} data={expedisiDataForSelectedDate} />
              ) : (
                <p className="text-center text-muted-foreground">Tidak ada detail transaksi untuk tanggal ini.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Detail Belum Kirim ({formattedDate})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBelumKirim ? ( // Re-using isLoadingBelumKirim as the data comes from the same source
                <div>Loading detail belum kirim...</div>
              ) : allResiData && allResiData.filter(resi => {
                const expedisiRecord = expeditionSummaries.find(exp => exp.name === resi.Keterangan);
                return expedisiRecord && expedisiRecord.sisa > 0; // This logic needs to be refined if `allResiData` is not directly tied to `belumKirim`
              }).length > 0 ? (
                // Filter allResiData to show only 'belum kirim' based on flag 'NO' from expedisiDataForSelectedDate
                <DataTable 
                  columns={belumKirimColumns} 
                  data={expedisiDataForSelectedDate?.filter(item => item.flag === 'NO') || []} 
                />
              ) : (
                <p className="text-center text-muted-foreground">Tidak ada detail belum kirim untuk tanggal ini.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Detail Follow Up (Flag NO Kecuali Hari Ini)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFollowUpFlagNoCount ? ( // Re-using isLoadingFollowUpFlagNoCount
                <div>Loading detail follow up...</div>
              ) : followUpFlagNoCount && followUpFlagNoCount > 0 ? (
                <DataTable 
                  columns={flagNoExceptTodayColumns} 
                  data={expeditionSummaries.filter(summary => summary.name !== 'ID' && summary.sisa > 0)} // This data needs to come from a specific query for "flag NO except today"
                />
              ) : (
                <p className="text-center text-muted-foreground">Tidak ada detail follow up (flag NO kecuali hari ini).</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Detail Scan Follow Up ({formattedDate})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingScanFollowupLateCount ? (
                <div>Loading detail scan follow up...</div>
              ) : allResiData && allResiData.filter(resi => resi.schedule === 'late').length > 0 ? (
                <DataTable 
                  columns={scanFollowUpColumns} 
                  data={allResiData.filter(resi => resi.schedule === 'late')} 
                />
              ) : (
                <p className="text-center text-muted-foreground">Tidak ada detail scan follow up untuk tanggal ini.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Detail Batal ({formattedDate})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBatalCount ? (
                <div>Loading detail batal...</div>
              ) : allResiData && allResiData.filter(resi => resi.schedule === 'batal').length > 0 ? (
                <DataTable 
                  columns={batalColumns} 
                  data={allResiData.filter(resi => resi.schedule === 'batal')} 
                />
              ) : (
                <p className="text-center text-muted-foreground">Tidak ada detail batal untuk tanggal ini.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}