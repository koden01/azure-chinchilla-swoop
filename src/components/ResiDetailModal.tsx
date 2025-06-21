import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy } from "lucide-react";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import { showSuccess, showError } from "@/utils/toast";
import { ModalDataItem } from "@/types/data";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

interface ResiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: ModalDataItem[];
  modalType: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni" | null;
  selectedCourier?: string | null;
  onBatalResi: (resiNumber: string) => Promise<void>;
  onConfirmResi: (resiNumber: string) => Promise<void>;
  onCekfuToggle: (resiNumber: string, currentCekfuStatus: boolean) => Promise<void>;
}

const ResiDetailModal: React.FC<ResiDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  modalType,
  selectedCourier,
  onBatalResi,
  onConfirmResi,
  onCekfuToggle,
}) => {
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    // Reset filter and sorting when modal opens or data/type changes
    setGlobalFilter("");
    setSorting([]);
    setColumnFilters([]);
    table.setPageIndex(0); // Reset to first page
    // Reset column visibility if needed, or define default visibility
    // setColumnVisibility({}); 
  }, [data, isOpen, modalType]); // Added table to dependencies for setPageIndex

  const columns = useMemo<ColumnDef<ModalDataItem>[]>(() => {
    const baseColumns: ColumnDef<ModalDataItem>[] = [];

    if (modalType === "belumKirim" || modalType === "expeditionDetail" || modalType === "transaksiHariIni") {
      baseColumns.push(
        {
          accessorKey: "resino",
          header: "No. Resi",
          cell: ({ row }) => row.original.resino,
        },
        {
          accessorKey: "orderno",
          header: "No Order",
          cell: ({ row }) => row.original.orderno || "-",
        },
        {
          accessorKey: "chanelsales",
          header: "Marketplace",
          cell: ({ row }) => row.original.chanelsales || "-",
        },
        {
          accessorKey: "datetrans",
          header: "Tanggal Pembelian",
          cell: ({ row }) => {
            const date = row.original.datetrans;
            return date ? format(new Date(date as string), "dd/MM/yyyy HH:mm") : "-";
          },
        },
        {
          accessorKey: "couriername",
          header: "Kurir",
          cell: ({ row }) => row.original.couriername || "-",
        },
        {
          accessorKey: "cekfu",
          header: "Followup",
          cell: ({ row }) => (
            <Checkbox
              checked={row.original.cekfu || false}
              onCheckedChange={() => row.original.resino && onCekfuToggle(row.original.resino, row.original.cekfu || false)}
            />
          ),
        },
        {
          id: "actions",
          header: "Aksi",
          cell: ({ row }) => (
            <div className="flex space-x-2">
              <Button variant="destructive" size="sm" onClick={() => row.original.resino && onBatalResi(row.original.resino)}>
                Batal
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => row.original.resino && onConfirmResi(row.original.resino)}>
                Konfirmasi
              </Button>
            </div>
          ),
          enableSorting: false,
          enableColumnFilter: false,
        }
      );
    } else if (modalType === "followUp") {
      baseColumns.push(
        {
          accessorKey: "Resi",
          header: "No. Resi",
          cell: ({ row }) => row.original.Resi,
        },
        {
          accessorKey: "created_resi",
          header: "Tanggal Resi",
          cell: ({ row }) => {
            const date = row.original.created_resi;
            return date ? format(new Date(date as string), "dd/MM/yyyy HH:mm") : "-";
          },
        },
        {
          accessorKey: "created_expedisi",
          header: "Tanggal Expedisi",
          cell: ({ row }) => {
            const date = row.original.created_expedisi;
            return date ? format(new Date(date as string), "dd/MM/yyyy HH:mm") : "-";
          },
        },
        {
          accessorKey: "couriername",
          header: "Kurir",
          cell: ({ row }) => row.original.couriername || "-",
        },
        {
          accessorKey: "cekfu",
          header: "Followup",
          cell: ({ row }) => (
            <Checkbox
              checked={row.original.cekfu || false}
              onCheckedChange={() => row.original.Resi && onCekfuToggle(row.original.Resi, row.original.cekfu || false)}
            />
          ),
        },
        {
          id: "actions",
          header: "Aksi",
          cell: ({ row }) => (
            <div className="flex space-x-2">
              <Button variant="destructive" size="sm" onClick={() => row.original.Resi && onBatalResi(row.original.Resi)}>
                Batal
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => row.original.Resi && onConfirmResi(row.original.Resi)}>
                Konfirmasi
              </Button>
            </div>
          ),
          enableSorting: false,
          enableColumnFilter: false,
        }
      );
    }
    return baseColumns;
  }, [modalType, onBatalResi, onConfirmResi, onCekfuToggle]);

  const table = useReactTable({
    data,
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
        pageSize: 10, // Default page size
      },
    },
  });

  const handleCopyTableData = useCallback(async () => {
    const rowsToCopy = table.getFilteredRowModel().rows;
    if (rowsToCopy.length === 0) {
      showError("Tidak ada data untuk disalin.");
      return;
    }

    // Extract headers directly from columnDef.header as they are simple strings
    const headers = table.getHeaderGroups()[0].headers
      .filter(header => header.id !== "actions") // Exclude the "Aksi" column
      .map(header => String(header.column.columnDef.header)); // Directly get string header
    const headerRow = headers.join('\t');

    const dataRows = rowsToCopy.map(row => {
      const rowValues = row.getVisibleCells()
        .filter(cell => cell.column.id !== "actions") // Exclude the "Aksi" column
        .map(cell => {
          if (cell.column.id === "datetrans" || cell.column.id === "created_resi" || cell.column.id === "created_expedisi") {
            const dateValue = cell.getValue() as string | null;
            return dateValue ? format(new Date(dateValue), "dd/MM/yyyy HH:mm") : "-";
          }
          if (cell.column.id === "cekfu") {
            return cell.getValue() ? "YES" : "NO";
          }
          return String(cell.getValue() || "");
        });
      return rowValues.join('\t');
    }).join('\n');

    const textToCopy = `${headerRow}\n${dataRows}`;

    console.log("Attempting to copy data:", textToCopy);

    try {
      await navigator.clipboard.writeText(textToCopy);
      showSuccess(`Berhasil menyalin ${rowsToCopy.length} baris data!`);
      console.log("Data copied successfully!");
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] lg:max-w-[1000px] max-h-[90vh] flex flex-col overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Menampilkan {table.getFilteredRowModel().rows.length} dari {data.length} resi.
            {selectedCourier && ` (Kurir: ${selectedCourier})`}
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 flex flex-col md:flex-row gap-2 w-full overflow-x-hidden">
          <Input
            id="search-term-input"
            placeholder="Cari..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full"
          />
          <Button
            onClick={handleCopyTableData}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Copy className="mr-2 h-4 w-4" /> Copy Table Data
          </Button>
        </div>
        <div className="overflow-x-scroll flex-grow">
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
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
      </DialogContent>
    </Dialog>
  );
};

export default ResiDetailModal;