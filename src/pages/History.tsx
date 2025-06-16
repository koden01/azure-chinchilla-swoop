import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface HistoryData {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string;
  schedule: string | null; // Added schedule field
}

const HistoryPage = () => {
  const [startDate, setStartDate] = React.useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = React.useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [resiToDelete, setResiToDelete] = React.useState<string | null>(null);

  const queryClient = useQueryClient();

  const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

  console.log("HistoryPage: startDate (state)", startDate);
  console.log("HistoryPage: endDate (state)", endDate);
  console.log("HistoryPage: formattedStartDate", formattedStartDate);
  console.log("HistoryPage: formattedEndDate", formattedEndDate);

  const { data: historyData, isLoading: isLoadingHistory, error: historyError } = useQuery<HistoryData[]>({
    queryKey: ["historyData", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      if (!startDate || !endDate) {
        console.log("HistoryPage: Skipping query, startDate or endDate is undefined.");
        return [];
      }

      // Calculate start of startDate and end of endDate for precise range
      const startOfSelectedStartDate = new Date(startDate);
      startOfSelectedStartDate.setHours(0, 0, 0, 0); // Set to start of the day

      const endOfSelectedEndDate = new Date(endDate);
      endOfSelectedEndDate.setHours(23, 59, 59, 999); // Set to end of the day

      console.log("HistoryPage: Querying Supabase with range (ISO):", startOfSelectedStartDate.toISOString(), "to", endOfSelectedEndDate.toISOString());

      let query = supabase
        .from("tbl_resi")
        .select("Resi, Keterangan, nokarung, created, schedule") // Select schedule column
        .gte("created", startOfSelectedStartDate.toISOString())
        .lte("created", endOfSelectedEndDate.toISOString())
        .order("created", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching history data:", error);
        throw error;
      }
      console.log("HistoryPage: Fetched history data:", data);
      return data || [];
    },
    enabled: !!startDate && !!endDate,
  });

  console.log("HistoryPage: isLoadingHistory", isLoadingHistory);
  console.log("HistoryPage: historyData (from query)", historyData);
  console.log("HistoryPage: historyError", historyError);

  const filteredHistoryData = React.useMemo(() => {
    if (!historyData) return [];
    const lowerCaseSearchQuery = searchQuery.toLowerCase();
    const filtered = historyData.filter(data =>
      data.Resi.toLowerCase().includes(lowerCaseSearchQuery) ||
      (data.Keterangan?.toLowerCase() || "").includes(lowerCaseSearchQuery) ||
      (data.nokarung?.toLowerCase() || "").includes(lowerCaseSearchQuery) ||
      (data.schedule?.toLowerCase() || "").includes(lowerCaseSearchQuery) || // Include schedule in search
      format(new Date(data.created), "dd/MM/yyyy").includes(lowerCaseSearchQuery)
    );
    console.log("HistoryPage: filteredHistoryData", filtered);
    return filtered;
  }, [historyData, searchQuery]);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalPages = Math.ceil(filteredHistoryData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = filteredHistoryData.slice(startIndex, endIndex);

  console.log("HistoryPage: currentData (for table)", currentData);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  const getPaginationPages = () => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 2) {
        pages.push(1, 2, 3);
      } else if (currentPage >= totalPages - 1) {
        pages.push(totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(currentPage - 1, currentPage, currentPage + 1);
      }
    }
    return pages;
  };

  const handleDeleteClick = (resi: string) => {
    setResiToDelete(resi);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteResi = async () => {
    if (!resiToDelete) return;

    console.log(`Attempting to delete resi: ${resiToDelete}`);
    const { error } = await supabase
      .from("tbl_resi")
      .delete()
      .eq("Resi", resiToDelete);

    if (error) {
      showError(`Gagal menghapus resi ${resiToDelete}: ${error.message}`);
      console.error("Error deleting resi:", error);
    } else {
      showSuccess(`Resi ${resiToDelete} berhasil dihapus.`);
      console.log(`Successfully deleted resi: ${resiToDelete}`);

      // Invalidate history data itself
      queryClient.invalidateQueries({ queryKey: ["historyData", formattedStartDate, formattedEndDate] });

      // Invalidate the specific query used by useResiInputData for duplicate checking
      // This query uses today's date, not the selected history date
      const todayFormatted = format(new Date(), "yyyy-MM-dd");
      queryClient.invalidateQueries({
        queryKey: ["allResiForExpedition"], // Invalidate all instances of this query key
        refetchType: "all", // Ensure all instances are refetched
      });

      // Invalidate general dashboard queries that might rely on tbl_resi counts
      invalidateDashboardQueries(queryClient, new Date());
    }
    setIsDeleteDialogOpen(false);
    setResiToDelete(null);
  };

  const handleExportToExcel = () => {
    if (filteredHistoryData.length === 0) {
      showError("Tidak ada data untuk diekspor.");
      return;
    }

    try {
      const headers = ["Nomor Resi", "Keterangan", "No Karung", "Schedule", "Tanggal Input"]; // Added Schedule
      const dataToExport = filteredHistoryData.map(item => [
        item.Resi,
        item.Keterangan || "",
        item.nokarung || "",
        item.schedule || "", // Export schedule
        format(new Date(item.created), "dd/MM/yyyy HH:mm")
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataToExport]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "History Resi");

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = `History_Resi_${formattedStartDate}_to_${formattedEndDate}.xlsx`;
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);

      showSuccess(`Berhasil mengekspor ${filteredHistoryData.length} data ke ${fileName}`);
    } catch (error: any) {
      showError(`Gagal mengekspor data: ${error.message || "Terjadi kesalahan."}`);
      console.error("Error exporting to Excel:", error);
    }
  };

  return (
    <React.Fragment>
      <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
        {/* History Data Input Section */}
        <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-lg shadow-md">
          <h2 className="text-white text-xl font-semibold mb-4">History Data Input</h2>
          <div className="bg-white p-4 rounded-md shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter & Search</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label htmlFor="start-date-picker" className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Mulai
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date-picker"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label htmlFor="end-date-picker" className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Selesai
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="end-date-picker"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="md:col-span-2 flex items-end space-x-2">
                <div className="flex-grow">
                  <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Cari
                  </label>
                  <Input
                    id="search-input"
                    type="text"
                    placeholder="Cari no. resi, keterangan, atau lainnya..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                  onClick={handleExportToExcel}
                >
                  Export Data ({filteredHistoryData.length} records)
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Data History Table Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Data History ({filteredHistoryData.length} records)</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead className="w-[25%]">Nomor Resi</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>No Karung</TableHead>
                  <TableHead>Schedule</TableHead> {/* New Table Head */}
                  <TableHead>Tanggal Input</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center"> {/* Updated colspan */}
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : currentData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center"> {/* Updated colspan */}
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentData.map((data, index) => (
                    <TableRow key={data.Resi + index} className="hover:bg-gray-100">
                      <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                      <TableCell className="w-[25%]">{data.Resi}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: data.Keterangan === "DATA" ? "#e0f7fa" : data.Keterangan === "MASUK" ? "#e8f5e9" : "#fff3e0",
                            color: data.Keterangan === "DATA" ? "#00796b" : data.Keterangan === "MASUK" ? "#2e7d32" : "#e65100",
                          }}
                        >
                          {data.Keterangan}
                        </span>
                      </TableCell>
                      <TableCell>{data.nokarung}</TableCell>
                      <TableCell>{data.schedule || "-"}</TableCell> {/* Display schedule */}
                      <TableCell>{format(new Date(data.created), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(data.Resi)}
                        >
                          Hapus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {getPaginationPages().map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === currentPage}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
        <MadeWithDyad />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Penghapusan</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus resi <span className="font-bold">{resiToDelete}</span>? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteResi} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </React.Fragment>
  );
};

export default HistoryPage;