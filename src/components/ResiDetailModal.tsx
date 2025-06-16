import React, { useState, useEffect } from "react";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import { Copy } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

interface ResiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  modalType: "belumKirim" | "followUp" | "expeditionDetail" | null;
  selectedCourier?: string | null;
  onBatalResi: (resiNumber: string) => Promise<void>;
  onConfirmResi: (resiNumber: string) => Promise<void>;
  onCekfuToggle: (resiNumber: string, currentCekfuStatus: boolean) => Promise<void>;
}

const ITEMS_PER_PAGE = 20;

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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm("");
  }, [isOpen, data, modalType]);

  const sortedAndFilteredData = React.useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    let tempFilteredData = data.filter((item) => {
      if (modalType === "belumKirim" || modalType === "expeditionDetail") {
        return (
          item.resino?.toLowerCase().includes(lowerCaseSearchTerm) ||
          item.orderno?.toLowerCase().includes(lowerCaseSearchTerm) ||
          item.chanelsales?.toLowerCase().includes(lowerCaseSearchTerm) ||
          item.couriername?.toLowerCase().includes(lowerCaseSearchTerm) ||
          (item.datetrans ? format(new Date(item.datetrans), "dd/MM/yyyy HH:mm").toLowerCase().includes(lowerCaseSearchTerm) : false)
        );
      } else if (modalType === "followUp") {
        return (
          item.Resi?.toLowerCase().includes(lowerCaseSearchTerm) ||
          item.couriername?.toLowerCase().includes(lowerCaseSearchTerm) ||
          (item.created_resi ? format(new Date(item.created_resi), "dd/MM/yyyy HH:mm").toLowerCase().includes(lowerCaseSearchTerm) : false) ||
          (item.created_expedisi ? format(new Date(item.created_expedisi), "dd/MM/yyyy HH:mm").toLowerCase().includes(lowerCaseSearchTerm) : false)
        );
      }
      return false;
    });

    if (modalType === "belumKirim" || modalType === "expeditionDetail") {
      tempFilteredData.sort((a, b) => {
        const dateA = a.datetrans ? new Date(a.datetrans).getTime() : 0;
        const dateB = b.datetrans ? new Date(b.datetrans).getTime() : 0;
        return dateA - dateB;
      });
    } else if (modalType === "followUp") {
      tempFilteredData.sort((a, b) => {
        const dateA = a.created_resi ? new Date(a.created_resi).getTime() : 0;
        const dateB = b.created_resi ? new Date(b.created_resi).getTime() : 0;
        return dateA - dateB;
      });
    }

    return tempFilteredData;
  }, [searchTerm, data, modalType]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = sortedAndFilteredData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getTableHeaders = () => {
    if (modalType === "belumKirim" || modalType === "expeditionDetail") {
      return ["No. Resi", "No Order", "Marketplace", "Tanggal Pembelian", "Kurir", "CEKFU", "Aksi"];
    } else if (modalType === "followUp") {
      return ["No. Resi", "Tanggal Resi", "Tanggal Expedisi", "Kurir", "CEKFU", "Aksi"];
    }
    return [];
  };

  const renderTableRows = () => {
    if (modalType === "belumKirim" || modalType === "expeditionDetail") {
      return currentData.map((item, index) => (
        <TableRow key={item.resino || index}>
          <TableCell>{item.resino}</TableCell>
          <TableCell>{item.orderno || "-"}</TableCell>
          <TableCell>{item.chanelsales || "-"}</TableCell>
          <TableCell>{item.datetrans ? format(new Date(item.datetrans), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.couriername || "-"}</TableCell>
          <TableCell>
            <Checkbox
              checked={item.cekfu || false}
              onCheckedChange={() => onCekfuToggle(item.resino, item.cekfu || false)}
            />
          </TableCell>
          <TableCell className="flex space-x-2">
            <Button variant="destructive" size="sm" onClick={() => onBatalResi(item.resino)}>
              Batal
            </Button>
            {(modalType === "expeditionDetail" || modalType === "belumKirim") && (
              <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => onConfirmResi(item.resino)}>
                Konfirmasi
              </Button>
            )}
          </TableCell>
        </TableRow>
      ));
    } else if (modalType === "followUp") {
      return currentData.map((item, index) => (
        <TableRow key={item.Resi || index}>
          <TableCell>{item.Resi}</TableCell>
          <TableCell>{item.created_resi ? format(new Date(item.created_resi), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.created_expedisi ? format(new Date(item.created_expedisi), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.couriername || "-"}</TableCell>
          <TableCell>
            <Checkbox
              checked={item.cekfu || false}
              onCheckedChange={() => onCekfuToggle(item.Resi, item.cekfu || false)}
            />
          </TableCell>
          <TableCell className="flex space-x-2">
            <Button variant="destructive" size="sm" onClick={() => onBatalResi(item.Resi)}>
              Batal
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => onConfirmResi(item.Resi)}>
              Konfirmasi
            </Button>
          </TableCell>
        </TableRow>
      ));
    }
    return null;
  };

  const handleCopyTableData = async () => {
    if (sortedAndFilteredData.length === 0) {
      showError("Tidak ada data untuk disalin.");
      return;
    }

    const headers = getTableHeaders();
    // Exclude the "Aksi" column from headers for copying
    const headerRow = headers.slice(0, -1).join('\t');

    const rows = sortedAndFilteredData.map(item => {
      if (modalType === "belumKirim" || modalType === "expeditionDetail") {
        return [
          item.resino || "",
          item.orderno || "",
          item.chanelsales || "",
          item.datetrans ? format(new Date(item.datetrans), "dd/MM/yyyy HH:mm") : "",
          item.couriername || "",
          item.cekfu ? "YES" : "NO",
        ];
      } else if (modalType === "followUp") {
        return [
          item.Resi || "",
          item.created_resi ? format(new Date(item.created_resi), "dd/MM/yyyy HH:mm") : "",
          item.created_expedisi ? format(new Date(item.created_expedisi), "dd/MM/yyyy HH:mm") : "",
          item.couriername || "",
          item.cekfu ? "YES" : "NO",
        ];
      }
      return [];
    });

    const dataRows = rows.map(row => row.join('\t')).join('\n');
    const textToCopy = `${headerRow}\n${dataRows}`;

    console.log("Attempting to copy data:", textToCopy);

    try {
      await navigator.clipboard.writeText(textToCopy);
      showSuccess(`Berhasil menyalin ${sortedAndFilteredData.length} baris data!`);
      console.log("Data copied successfully!");
    } catch (err: any) {
      showError(`Gagal menyalin data tabel: ${err.message || "Unknown error"}`);
      console.error("Failed to copy table data:", err);
    }
  };

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] lg:max-w-[1000px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Menampilkan {currentData.length} dari {sortedAndFilteredData.length} resi.
            {selectedCourier && ` (Kurir: ${selectedCourier})`}
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Cari Resi, No Order, Marketplace, Kurir, atau Tanggal Pembelian..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <Button
            onClick={handleCopyTableData}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Copy className="mr-2 h-4 w-4" /> Copy Table Data
          </Button>
        </div>
        <div className="overflow-y-auto flex-grow">
          <Table>
            <TableHeader>
              <TableRow>
                {getTableHeaders().map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableRows()}
              {currentData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={getTableHeaders().length} className="text-center">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
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
      </DialogContent>
    </Dialog>
  );
};

export default ResiDetailModal;