"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfDay, endOfDay } from 'date-fns';
import { CalendarIcon, PackageIcon, TruckIcon, XCircleIcon, CheckCircleIcon, ScanIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import ResiDetailModal from '@/components/ResiDetailModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ExpeditionSummary {
  couriername: string;
  total_items: number;
  belum_kirim: number;
}

interface KarungSummary {
  karung_number: string;
  quantity: number;
}

interface ScanFollowUpRecord {
  Resi: string;
  created_resi: string;
  created_expedisi: string;
  couriername: string;
}

const Index: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [expeditionSummaries, setExpeditionSummaries] = useState<ExpeditionSummary[]>([]);
  const [karungSummaries, setKarungSummaries] = useState<KarungSummary[]>([]);
  const [transaksiHariIniCount, setTransaksiHariIniCount] = useState<number>(0);
  const [belumKirimCount, setBelumKirimCount] = useState<number>(0);
  const [flagNoExceptTodayCount, setFlagNoExceptTodayCount] = useState<number>(0);
  const [idRekomendasiCount, setIdRekomendasiCount] = useState<number>(0);
  const [scanFollowUpRecords, setScanFollowUpRecords] = useState<ScanFollowUpRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // State for ResiDetailModal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalExpeditionName, setModalExpeditionName] = useState("");
  const [modalSearchResi, setModalSearchResi] = useState("");
  const [modalSearchNokarung, setModalSearchNokarung] = useState("");
  const [modalSelectedDate, setModalSelectedDate] = useState<Date | undefined>(new Date());

  const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  const fetchDashboardData = useCallback(async () => {
    if (!selectedDate) return;

    setIsLoading(true);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    try {
      // Fetch counts
      const { data: transaksiCount, error: err1 } = await supabase.rpc('get_transaksi_hari_ini_count', { p_selected_date: formattedDate });
      if (err1) throw err1;
      setTransaksiHariIniCount(transaksiCount || 0);

      const { data: belumKirim, error: err2 } = await supabase.rpc('get_belum_kirim_count', { p_selected_date: formattedDate });
      if (err2) throw err2;
      setBelumKirimCount(belumKirim || 0);

      const { data: flagNoExcept, error: err3 } = await supabase.rpc('get_flag_no_except_today_count', { p_selected_date: formattedDate });
      if (err3) throw err3;
      setFlagNoExceptTodayCount(flagNoExcept || 0);

      const { data: idRekCount, error: err4 } = await supabase.rpc('get_id_rekomendasi_count', { p_selected_date: formattedDate });
      if (err4) throw err4;
      setIdRekomendasiCount(idRekCount || 0);

      // Fetch expedition summaries
      const { data: expeditionData, error: err5 } = await supabase
        .from('tbl_expedisi')
        .select('couriername, flag')
        .eq('created::date', formattedDate);

      if (err5) throw err5;

      const summaries: { [key: string]: { total_items: number; belum_kirim: number } } = {};
      expeditionData.forEach(item => {
        if (!summaries[item.couriername]) {
          summaries[item.couriername] = { total_items: 0, belum_kirim: 0 };
        }
        summaries[item.couriername].total_items++;
        if (item.flag === 'NO') {
          summaries[item.couriername].belum_kirim++;
        }
      });
      setExpeditionSummaries(Object.entries(summaries).map(([couriername, counts]) => ({
        couriername,
        total_items: counts.total_items,
        belum_kirim: counts.belum_kirim,
      })));

      // Fetch karung summaries
      const { data: karungData, error: err6 } = await supabase.rpc('get_all_karung_summaries_for_date', { p_selected_date: formattedDate });
      if (err6) throw err6;
      setKarungSummaries(karungData || []);

      // Fetch scan follow up records
      const { data: scanFuData, error: err7 } = await supabase.rpc('get_scan_follow_up', { selected_date: formattedDate });
      if (err7) throw err7;
      setScanFollowUpRecords(scanFuData || []);

    } catch (error: any) {
      console.error("Error fetching dashboard data:", error.message);
      toast({
        title: "Error",
        description: `Gagal memuat data dashboard: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleOpenModal = (title: string, expeditionName: string) => {
    setModalTitle(title);
    setModalExpeditionName(expeditionName);
    setModalSelectedDate(selectedDate); // Initialize modal date with current dashboard date
    setModalSearchResi(""); // Clear previous search
    setModalSearchNokarung(""); // Clear previous search
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Optionally re-fetch dashboard data after modal closes if changes might have occurred
    fetchDashboardData();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Memuat data dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Dashboard Expedisi</h1>

      <div className="mb-6 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full sm:w-[280px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : <span>Pilih tanggal</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button onClick={fetchDashboardData} disabled={isLoading}>
          {isLoading ? "Memuat..." : "Refresh Data"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaksi Hari Ini</CardTitle>
            <PackageIcon className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transaksiHariIniCount}</div>
            <p className="text-xs opacity-80">Total resi masuk hari ini</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Kirim Hari Ini</CardTitle>
            <XCircleIcon className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{belumKirimCount}</div>
            <p className="text-xs opacity-80">Resi belum dikirim hari ini</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flag NO (Kecuali Hari Ini)</CardTitle>
            <TruckIcon className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flagNoExceptTodayCount}</div>
            <p className="text-xs opacity-80">Resi belum dikirim (hari sebelumnya)</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ID Rekomendasi</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{idRekomendasiCount}</div>
            <p className="text-xs opacity-80">Resi dengan keterangan ID_REKOMENDASI</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Ekspedisi ({formattedDate})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ekspedisi</TableHead>
                  <TableHead>Total Item</TableHead>
                  <TableHead>Belum Kirim</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expeditionSummaries.length > 0 ? (
                  expeditionSummaries.map((summary) => (
                    <TableRow key={summary.couriername}>
                      <TableCell className="font-medium">{summary.couriername}</TableCell>
                      <TableCell>{summary.total_items}</TableCell>
                      <TableCell>{summary.belum_kirim}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(`Detail Resi ${summary.couriername}`, summary.couriername)}
                        >
                          Lihat Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">Tidak ada ringkasan ekspedisi.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Karung ({formattedDate})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Karung</TableHead>
                  <TableHead>Jumlah Resi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {karungSummaries.length > 0 ? (
                  karungSummaries.map((summary) => (
                    <TableRow key={summary.karung_number}>
                      <TableCell className="font-medium">{summary.karung_number}</TableCell>
                      <TableCell>{summary.quantity}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">Tidak ada ringkasan karung.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scan Follow Up (Resi Hari Ini, Expedisi Hari Sebelumnya)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resi</TableHead>
                <TableHead>Dibuat Resi</TableHead>
                <TableHead>Dibuat Expedisi</TableHead>
                <TableHead>Ekspedisi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanFollowUpRecords.length > 0 ? (
                scanFollowUpRecords.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{record.Resi}</TableCell>
                    <TableCell>{record.created_resi ? format(new Date(record.created_resi), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                    <TableCell>{record.created_expedisi ? format(new Date(record.created_expedisi), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                    <TableCell>{record.couriername}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">Tidak ada catatan scan follow up.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ResiDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        expeditionName={modalExpeditionName}
        searchResi={modalSearchResi}
        setSearchResi={setModalSearchResi}
        searchNokarung={modalSearchNokarung}
        setSearchNokarung={setModalSearchNokarung}
        selectedDate={modalSelectedDate}
        setSelectedDate={setModalSelectedDate}
      />
    </div>
  );
};

export default Index;