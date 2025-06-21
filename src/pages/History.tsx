import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { getKeteranganBadgeClasses } from "@/utils/expeditionUtils";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";

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
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [resiToDelete, setResiToDelete] = useState<string | null>(null);

  const [lastClickInfo, setLastClickInfo] = useState<{ resi: string | null; timestamp: number | null } | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);

  const queryClient = useQueryClient();

  const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

  const fetchAllResiDataPaginated = useCallback(async (startIso: string, endIso: string) => {
    let allRecords: HistoryData[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("Resi, Keterangan, nokarung, created, schedule")
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
        hasMore = data.length === limit;
      } else {
        hasMore = false;
      }
    }
    return allRecords;
  }, []);

  const { data: historyData, isLoading: isLoadingHistory } = useQuery<HistoryData[]>({
    queryKey: ["historyData", formattedStartDate, formattedEndDate],
    queryFn: async () => {
      if (!startDate || !endDate) {
        console.log("HistoryPage: Skipping fetch, startDate or endDate is undefined.");
        return [];
      }

      const startOfSelectedStartDate = new Date(startDate);
      startOfSelectedStartDate.setHours(0, 0, 0, 0);

      const endOfSelectedEndDate = new Date(endDate);
      endOfSelectedEndDate.setHours(23, 59, 59, 999);

      const startIso = startOfSelectedStartDate.toISOString();
      const endIso = endOfSelectedEndDate.toISOString();
      
      console.log(`HistoryPage: Fetching data for range ${startIso} to ${endIso}`);
      const data = await fetchAllResiDataPaginated(startIso, endIso);
      console.log(`HistoryPage: Fetched ${data.length} records.`);
      return data || [];
    },
    enabled: !!startDate && !!endDate,
  });

  useEffect(() => {
    console.log("HistoryPage: historyData updated:", historyData);
  }, [historyData]);

  const columns = useMemo<ColumnDef<HistoryData>[]>(() => [
    {
      accessorKey: "rowNumber",
      header: "No",
      cell: ({ row }) => row.index + 1 + table.getState().pagination.pageIndex * table.getState().pagination.pageSize,
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: "Resi",
      header: "Nomor Resi",
    },
    {
      accessorKey: "Keterangan",
      header: "Keterangan",
      cell: ({ row }) => (
        <span className={cn(
          "px-2 py-1 rounded-full text-xs font-semibold",
          getKeteranganBadgeClasses(row.original.Keterangan)
        )}>
          {row.original.Keterangan}
        </span>
      ),
    },
    {
      accessorKey: "nokarung",
      header: "No Karung",
    },
    {
      accessorKey: "schedule",
      header: "Schedule",
      cell: ({ row }) => row.original.schedule || "-",
    },
    {
      accessorKey: "created",
      header: "Tanggal Input",
      cell: ({ row }) => format(new Date(row.original.created), "dd/MM/yyyy HH:mm"),
    },
  ], []);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data: historyData || [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedGlobalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  useEffect(() => {
    table.setPageIndex(0);
  }, [debouncedGlobalFilter, startDate, endDate, table]);

  const handleDeleteClick = useCallback((resi: string) => {
    setResiToDelete(resi);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleRowClick = useCallback((resi: string) => {
    const now = Date.now();

    if (lastClickInfo && lastClickInfo.resi === resi && (now - lastClickInfo.timestamp!) < 300) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      setLastClickInfo(null);
      handleDeleteClick(resi);
    } else {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      setLastClickInfo({ resi, timestamp: now });
      clickTimeoutRef.current = setTimeout(() => {
        setLastClickInfo(null);
      }, 300);
    }
  }, [lastClickInfo, handleDeleteClick]);

  const confirmDeleteResi = useCallback(async () => {
    if (!resiToDelete) return;

    const itemToDelete = historyData?.find(item => item.Resi === resiToDelete);
    const dateOfDeletedResi = itemToDelete ? new Date(itemToDelete.created) : undefined;
    const expeditionOfDeletedResi = itemToDelete?.Keterangan || undefined;

    const { error } = await supabase
      .from("tbl_resi")
      .delete()
      .eq("Resi", resiToDelete);

    if (error) {
      showError(`Gagal menghapus resi ${resiToDelete}: ${error.message}`);
      console.error("Error deleting resi:", error);
    } else {
      showSuccess(`Resi ${resiToDelete} berhasil dihapus.`);

      await queryClient.refetchQueries({ queryKey: ["historyData", formattedStartDate, formattedEndDate] });

      await queryClient.refetchQueries({
        queryKey: ["allResiForExpedition"],
        exact: false,
      });

      await queryClient.refetchQueries({ queryKey: ["allResiDataComprehensive"] });

      invalidateDashboardQueries(queryClient, dateOfDeletedResi, expeditionOfDeletedResi); 
    }
    setIsDeleteDialogOpen(false);
    setResiToDelete(null);
  }, [resiToDelete, historyData, formattedStartDate, formattedEndDate, queryClient]);

  const handleCopyTableData = useCallback(async () => {
    const rowsToCopy = table.getFilteredRowModel().rows;
    if (rowsToCopy.length === 0) {
      showError("Tidak ada data untuk disalin.");
      return;
    }

    const headers = table.getHeaderGroups()[0].headers
      .filter(header => header.column.id !== "rowNumber")
      .map(header => flexRender(header.column.columnDef.header, header.getContext()));
    const headerRow = headers.join('\t');

    const dataRows = rowsToCopy.map(row => {
      const rowValues = row.getVisibleCells()
        .filter(cell => cell.column.id !== "rowNumber")
        .map(cell => {
          if (cell.column.id === "created") {
            const dateValue = cell.getValue() as string;
            return format(new Date(dateValue), "dd/MM/yyyy HH:mm");
          }
          return String(cell.getValue() || "");
        });
      return rowValues.join('\t');
    }).join('\n');

    const textToCopy = `${headerRow}\n${dataRows}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      showSuccess(`Berhasil menyalin ${rowsToCopy.length} baris data!`);
    } catch (err: any) {
      showError(`Gagal menyalin data tabel: ${err.message || "Unknown error"}`);
      console.error("Failed to copy table data:", err);
    }
  }, [table]);

  const getPaginationPages = useMemo(() => {
    const pages = [];
    const totalPages = table.getPageCount();
    const currentPage = table.getState().pagination.pageIndex + 1;

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
  }, [table.getPageCount(), table.getState().pagination.pageIndex]);

  return (
    <React.Fragment>
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-lg shadow-md">
          <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
            <CalendarDays className="mr-2 h-6 w-6" /> Filter Tanggal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-date-picker" className="block text-left text-sm font-medium text-white mb-1">
                Tanggal Mulai
              </label>
              <Popover open={isStartDatePopoverOpen} onOpenChange={(open) => {
                console.log("Start Date Popover changed:", open);
                setIsStartDatePopoverOpen(open);
              }}>
                <PopoverTrigger asChild>
                  <Button
                    id="start-date-picker"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white text-gray-800",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    key={startDate?.toISOString() || 'start-date-empty'}
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      console.log("Selected start date:", date);
                      setStartDate(date);
                      setIsStartDatePopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label htmlFor="end-date-picker" className="block text-left text-sm font-medium text-white mb-1">
                Tanggal Selesai
              </label>
              <Popover open={isEndDatePopoverOpen} onOpenChange={(open) => {
                console.log("End Date Popover changed:", open);
                setIsEndDatePopoverOpen(open);
              }}>
                <PopoverTrigger asChild>
                  <Button
                    id="end-date-picker"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white text-gray-800",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    key={endDate?.toISOString() || 'end-date-empty'}
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      console.log("Selected end date:", date);
                      setEndDate(date);
                      setIsEndDatePopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter & Search</h3>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-grow w-full">
              <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-1">
                Cari
              </label>
              <Input
                id="search-input"
                type="text"
                placeholder="Cari no. resi, keterangan, atau lainnya..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap w-full md:w-auto"
              onClick={handleCopyTableData}
              disabled={table.getFilteredRowModel().rows.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy Table Data ({table.getFilteredRowModel().rows.length} records)
            </Button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Data History ({table.getFilteredRowModel().rows.length} records)</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : (
                            <div
                              {...{
                                className: header.column.getCanSort()
                                  ? "cursor-pointer select-none"
                                  : "",
                                onClick: header.column.getToggleSortingHandler(),
                              }}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {{
                                asc: " 🔼",
                                desc: " 🔽",
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">Memuat data...</TableCell></TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow 
                      key={row.id} 
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleRowClick(row.original.Resi)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {table.getPageCount() > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={() => table.previousPage()}
                    className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {getPaginationPages.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === table.getState().pagination.pageIndex + 1}
                      onClick={() => table.setPageIndex(pageNumber - 1)}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={() => table.nextPage()}
                    className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : ""}
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