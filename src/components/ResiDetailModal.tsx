"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

interface ResiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  expeditionName: string;
  searchResi: string;
  setSearchResi: (value: string) => void;
  searchNokarung: string;
  setSearchNokarung: (value: string) => void;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
}

const ResiDetailModal: React.FC<ResiDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  expeditionName,
  searchResi,
  setSearchResi,
  searchNokarung,
  setSearchNokarung,
  selectedDate,
  setSelectedDate,
}) => {
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    if (!selectedDate) {
      setFilteredData([]);
      return;
    }
    setIsLoading(true);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase.rpc('get_filtered_resi_for_expedition_and_date', {
        p_couriername: expeditionName,
        p_selected_date: formattedDate,
        p_resi: searchResi || null,
        p_nokarung: searchNokarung || null,
      });

      if (error) {
        console.error("Error fetching filtered data:", error);
        toast({
          title: "Error",
          description: "Gagal memuat data detail resi.",
          variant: "destructive",
        });
        setFilteredData([]);
      } else {
        setFilteredData(data || []);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan tak terduga saat memuat data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, searchResi, searchNokarung, selectedDate, expeditionName]);

  const handleClearFilter = () => {
    setSearchResi("");
    setSearchNokarung("");
    setSelectedDate(new Date()); // Reset to today
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] lg:max-w-[1000px] max-h-[90vh] flex flex-col overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Lihat detail resi untuk ekspedisi {expeditionName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <Input
              placeholder="Cari Resi..."
              value={searchResi}
              onChange={(e) => setSearchResi(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Cari No. Karung..."
              value={searchNokarung}
              onChange={(e) => setSearchNokarung(e.target.value)}
              className="flex-1"
            />
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
            <Button onClick={fetchData} disabled={isLoading}>
              {isLoading ? "Memuat..." : "Terapkan Filter"}
            </Button>
            <Button variant="outline" onClick={handleClearFilter} disabled={isLoading}>
              Bersihkan Filter
            </Button>
          </div>
          <div className="mt-4 overflow-auto max-h-[calc(90vh-200px)]">
            {isLoading ? (
              <p>Memuat data...</p>
            ) : filteredData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resi</TableHead>
                    <TableHead>No. Karung</TableHead>
                    <TableHead>Tanggal Dibuat</TableHead>
                    <TableHead>Ekspedisi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.Resi}</TableCell>
                      <TableCell>{item.nokarung}</TableCell>
                      <TableCell>{item.created ? format(new Date(item.created), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                      <TableCell>{item.couriername}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p>Tidak ada data yang ditemukan untuk filter ini.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResiDetailModal;