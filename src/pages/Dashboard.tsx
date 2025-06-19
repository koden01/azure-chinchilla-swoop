import { useState, useMemo } from "react"; // Added useMemo
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SummaryCard from "@/components/SummaryCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DataTable } from "@/components/ui/data-table";
import { columns as transaksiHariIniColumns, TransaksiHariIniData } from "@/components/columns/transaksiHariIniColumns";
import { columns as belumKirimColumns, BelumKirimData } from "@/components/columns/belumKirimColumns";
import { columns as followUpColumns, FollowUpData } from "@/components/columns/followUpColumns";
import { columns as flagNoExceptTodayColumns, FlagNoExceptTodayData } from "@/components/columns/flagNoExceptTodayColumns";
import { columns as scanFollowUpColumns, ScanFollowUpData } from "@/components/columns/scanFollowUpColumns";
import { columns as batalColumns, BatalData } from "@/components/columns/batalColumns";
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
    expedisiDataForSelectedDate,
    isLoadingExpedisiDataForSelectedDate,
    allResiData,
    isLoadingAllResi,
  } = useDashboardData(date);

  // Memoize filtered data for tables to prevent unnecessary re-renders
  const filteredBelumKirimData = useMemo(() => {
    return expedisiDataForSelectedDate?.filter((item: BelumKirimData) => item.flag === 'NO') || [];
  }, [expedisiDataForSelectedDate]);

  const filteredFlagNoExceptTodayData = useMemo(() => {
    return expeditionSummaries.filter((summary: FlagNoExceptTodayData) => summary.sisa > 0) || [];
  }, [expeditionSummaries]);

  const filteredScanFollowUpData = useMemo(() => {
    return allResiData?.filter((resi: ScanFollowUpData) => resi.schedule === 'late') || [];
  }, [allResiData]);

  const filteredBatalData = useMemo(() => {
    return allResiData?.filter((resi: BatalData) => resi.schedule === 'batal') || [];
  }, [allResiData]);

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
            icon="package"
            gradientFrom="from-blue-500"
            gradientTo="to-indigo-600"
          />
          <SummaryCard
            title="Total Scan"
            value={isLoadingTotalScan ? "Loading..." : totalScan?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            icon="maximize"
            gradientFrom="from-green-500"
            gradientTo="to-teal-600"
          />
          <SummaryCard
            title="ID Rekomendasi"
            value={isLoadingIdRekCount ? "Loading..." : idRekCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            icon="info"
            gradientFrom="from-purple-500"
            gradientTo="to-pink-600"
          />
          <SummaryCard
            title="Belum Kirim"
            value={isLoadingBelumKirim ? "Loading..." : belumKirim?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            icon="package"
            gradientFrom="from-orange-500"
            gradientTo="to-red-600"
          />
          <SummaryCard
            title="Follow Up (Flag NO)"
            value={isLoadingFollowUpFlagNoCount ? "Loading..." : followUpFlagNoCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={format(new Date(), 'yyyy-MM-dd')}
            icon="warning"
            gradientFrom="from-yellow-500"
            gradientTo="to-amber-600"
          />
          <SummaryCard
            title="Scan Follow Up"
            value={isLoadingScanFollowupLateCount ? "Loading..." : scanFollowupLateCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            icon="clock"
            gradientFrom="from-cyan-500"
            gradientTo="to-blue-700"
          />
          <SummaryCard
            title="Batal"
            value={isLoadingBatalCount ? "Loading..." : batalCount?.toLocaleString() || "0"}
            secondaryTitle="Tanggal"
            secondaryValue={formattedDate}
            icon="warning"
            gradientFrom="from-gray-500"
            gradientTo="to-gray-700"
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
                  expeditionSummaries.map((summary: any) => (
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
                <DataTable columns={followUpColumns} data={followUpData as FollowUpData[]} />
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
                <DataTable columns={transaksiHariIniColumns} data={expedisiDataForSelectedDate as TransaksiHariIniData[]} />
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
              {isLoadingBelumKirim ? (
                <div>Loading detail belum kirim...</div>
              ) : filteredBelumKirimData.length > 0 ? (
                <DataTable
                  columns={belumKirimColumns}
                  data={filteredBelumKirimData as BelumKirimData[]}
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
              {isLoadingFollowUpFlagNoCount ? (
                <div>Loading detail follow up...</div>
              ) : filteredFlagNoExceptTodayData.length > 0 ? (
                <DataTable
                  columns={flagNoExceptTodayColumns}
                  data={filteredFlagNoExceptTodayData as FlagNoExceptTodayData[]}
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
              {isLoadingScanFollowupLateCount || isLoadingAllResi ? (
                <div>Loading detail scan follow up...</div>
              ) : filteredScanFollowUpData.length > 0 ? (
                <DataTable
                  columns={scanFollowUpColumns}
                  data={filteredScanFollowUpData as ScanFollowUpData[]}
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
              {isLoadingBatalCount || isLoadingAllResi ? (
                <div>Loading detail batal...</div>
              ) : filteredBatalData.length > 0 ? (
                <DataTable
                  columns={batalColumns}
                  data={filteredBatalData as BatalData[]}
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