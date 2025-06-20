import React, { useState, useCallback, useMemo, useRef } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Copy, CalendarDays } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { invalidateDashboardQueries } from "@/utils/dashboardQueryInvalidation";
import { useDebounce } from "@/hooks/useDebounce";
import { getKeteranganBadgeClasses } from "@/utils/expeditionUtils"; // Import new utility

interface HistoryData {
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  created: string;
  schedule: string | null;
}

const HistoryPage = () => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [rawSearchQuery, setRawSearchQuery] = useState<string>("");
  const debouncedSearchQuery = useDebounce(rawSearchQuery, 300);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [resiToDelete, setResiToDelete] = useState<string | null>(null);

  // State untuk melacak klik terakhir untuk deteksi double-click
  const [lastClickInfo, setLastClickInfo] = useState<{ resi: string | null; timestamp: number | null } | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClient = useQueryClient();

  const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

  // Function to fetch all data from tbl_resi with pagination for a given date range
  const fetchAllResiDataPaginated = useCallback(async (startIso: string, endIso: string) => {
    let allRecords: HistoryData[] = [];
    let offset = 0;
    const limit = 1000; // Fetch 1000 records at a time
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, Keterangan, nokarung, created, schedule") // Only select necessary columns
        .gte("created", startIso)
        .lte("created", endIso)
        .order("created", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error(`Error fetching paginated history data:`, error);
        throw error;
      }

      if (data && data.length > 0) {
        allRecords = allRecords.concat(data);
        offset += data.length;
        hasMore = data.length === limit; // If less than limit, no more data
      } else {
        hasMore = false;
      }
    }
    return allRecords;
  }, []); // No dependencies, as it's a pure fetch function

  const { data: historyData, isLoading: isLoadingHistory, error: historyError } = useQuery<HistoryData[]>({
    queryKey: ["historyData", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      if (!startDate || !endDate) {
        return [];
      }

      const startOfSelectedStartDate = new Date(startDate);
      startOfSelectedStartDate.setHours(0, 0, 0, 0);

      const endOfSelectedEndDate = new Date(endDate);
      endOfSelectedEndDate.setHours(23, 59, 59, 999);

      const startIso = startOfSelectedStartDate.toISOString();
      const endIso = endOfSelectedEndDate.toISOString();
      
      const data = await fetchAllResiDataPaginated(startIso, endIso);
      return data || [];
    },
    enabled: !!startDate && !!endDate,
  });

  const filteredHistoryData = useMemo(() => {
    if (!historyData) return [];
    // Ensure debouncedSearchQuery is treated as a string
    const lowerCaseSearchQuery = (debouncedSearchQuery || "").toLowerCase(); // Use debounced term and handle potential null/undefined
    const filtered = historyData.filter(data =>
      data.Resi.toLowerCase().includes(lowerCaseSearchQuery) ||
      (data.Keterangan?.toLowerCase() || "").includes(lowerCaseSearchQuery) ||
      (data.nokarung?.toLowerCase() || "").includes(lowerCaseSearchQuery) ||
      (data.schedule?.toLowerCase() || "").includes(lowerCaseSearchQuery) ||
      format(new Date(data.created), "dd/MM/yyyy").includes(lowerCaseSearchQuery)
    );
    return filtered;
  }, [historyData, debouncedSearchQuery]); // Use debouncedSearchQuery as dependency

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(filteredHistoryData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = filteredHistoryData.slice(startIndex, endIndex);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]); // totalPages is a dependency

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, startDate, endDate]); // Use debouncedSearchQuery here

  const getPaginationPages = useMemo(() => {
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
    }, [currentPage, totalPages]);

  const handleDeleteClick = useCallback((resi: string) => {
    setResiToDelete(resi);
    setIsDeleteDialogOpen(true);
  }, []); // No dependencies

  // New handler for row clicks to detect double-click
  const handleRowClick = useCallback((resi: string) => {
    const now = Date.now();

    if (lastClickInfo && lastClickInfo.resi === resi && (now - lastClickInfo.timestamp!) < 300) { // 300ms for double click
      // Double click detected
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      setLastClickInfo(null); // Reset for next double click
      handleDeleteClick(resi); // Trigger the delete confirmation
    } else {
      // First click or different resi
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      setLastClickInfo({ resi, timestamp: now });
      clickTimeoutRef.current = setTimeout(() => {
        setLastClickInfo(null); // Clear after timeout if no second click
      }, 300);
    }
  }, [lastClickInfo, handleDeleteClick]); // lastClickInfo and handleDeleteClick are dependencies

  const confirmDeleteResi = useCallback(async () => {
    if (!resiToDelete) return;

    // Find the item to get its creation date and Keterangan (expedition)
    const itemToDelete = historyData?.find(item => item.Resi === resiToDelete);
    const dateOfDeletedResi = itemToDelete ? new Date(itemToDelete.created) : undefined;
    const expeditionOfDeletedResi = itemToDelete?.Keterangan || undefined; // Get expedition name

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

      // Force refetch history data for the current date range
      await queryClient.refetchQueries({ queryKey: ["historyData", formattedStartDate, formattedEndDate] });

      // Force refetch allResiForExpedition (used by Input page)
      await queryClient.refetchQueries({
        queryKey: ["allResiForExpedition"],
        exact: false, // Ensure it refetches all variations of this query key
      });

      // NEW: Force refetch the comprehensive resi data cache
      await queryClient.refetchQueries({ queryKey: ["allResiDataComprehensive"] });

      // Invalidate dashboard queries and karungSummary/lastKarung for the date and expedition of the deleted resi
      invalidateDashboardQueries(queryClient, dateOfDeletedResi, expeditionOfDeletedResi); 
    }
    setIsDeleteDialogOpen(false);
    setResiToDelete(null);
  }, [resiToDelete, historyData, formattedStartDate, formattedEndDate, queryClient]); // Dependencies

  const handleCopyTableData = useCallback(async () => {
    if (filteredHistoryData.length === 0) {
      showError("Tidak ada data untuk disalin.");
      return;
    }

    // Headers without "Aksi"
    const headers = ["No", "Nomor Resi", "Keterangan", "No Karung", "Schedule", "Tanggal Input"];
    const headerRow = headers.join('\t');

    const rows = filteredHistoryData.map((item, index) => {
      return [
        (startIndex + index + 1).toString(), // Add row number
        item.Resi || "",
        item.Keterangan || "",
        item.nokarung || "",
        item.schedule || "",
        format(new Date(item.created), "dd/MM/yyyy HH:mm"),
      ];
    });

    const dataRows = rows.map(row => row.join('\t')).join('\n');
    const textToCopy = `${headerRow}\n${dataRows}`;

    console.log("Attempting to copy data:", textToCopy);

    try {
      await navigator.clipboard.writeText(textToCopy);
      showSuccess(`Berhasil menyalin ${filteredHistoryData.length} baris data!`);
      console.log("Data copied successfully!");
    } catch (err: any) {
      showError(`Gagal menyalin data tabel: ${err.message || "Unknown error"}`);
      console.error("Failed to copy table data:", err);
    }
  }, [filteredHistoryData, startIndex]); // Dependencies

  return (
    <React.Fragment>
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-lg shadow-md">
          <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
            <CalendarDays className="mr-2 h-6 w-6" /> Filter Tanggal
          </h2>
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
                  value={rawSearchQuery}
                  onChange={(e) => setRawSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                onClick={handleCopyTableData}
                disabled={filteredHistoryData.length === 0}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy Table Data ({filteredHistoryData.length} records)
              </Button>
            </div>
          </div>
        </div>

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
                  <TableHead>Schedule</TableHead>
                  <TableHead>Tanggal Input</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Memuat data...</TableCell></TableRow>
                ) : currentData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Tidak ada data.</TableCell></TableRow>
                ) : (
                  currentData.map((data, index) => (
                    <TableRow 
                      key={data.Resi + index} 
                      className="hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleRowClick(data.Resi)} // Menggunakan handler double-click
                    >
                      <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                      <TableCell className="w-[25%]">{data.Resi}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-semibold",
                          getKeteranganBadgeClasses(data.Keterangan) // Use the new utility function
                        )}>
                          {data.Keterangan}
                        </span>
                      </TableCell>
                      <TableCell>{data.nokarung}</TableCell>
                      <TableCell>{data.schedule || "-"}</TableCell>
                      <TableCell>{format(new Date(data.created), "dd/MM/yyyy HH:mm")}</TableCell>
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
                {getPaginationPages.map((pageNumber) => (
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