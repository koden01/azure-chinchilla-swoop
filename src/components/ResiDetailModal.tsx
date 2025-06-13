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
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";

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

  // Reset to first page and clear search term when modal opens or data/type changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm("");
  }, [isOpen, data, modalType]);

  const filteredData = React.useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (!lowerCaseSearchTerm) return data;

    return data.filter((item) => {
      // Adjust properties based on modalType for searching
      if (modalType === "belumKirim" || modalType === "expeditionDetail") {
        return (
          item.resino?.toLowerCase().includes(lowerCaseSearchTerm) ||
          item.nokarung?.toLowerCase().includes(lowerCaseSearchTerm) ||
          item.couriername?.toLowerCase().includes(lowerCaseSearchTerm) ||
          item.flag?.toLowerCase().includes(lowerCaseSearchTerm) ||
          (item.created ? format(new Date(item.created), "dd/MM/yyyy HH:mm").toLowerCase().includes(lowerCaseSearchTerm) : false)
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
  }, [searchTerm, data, modalType]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getTableHeaders = () => {
    if (modalType === "belumKirim" || modalType === "expeditionDetail") {
      return ["No. Resi", "No Karung", "Tanggal Input", "Kurir", "Flag", "CEKFU", "Aksi"];
    } else if (modalType === "followUp") {
      return ["No. Resi", "Tanggal Resi", "Tanggal Expedisi", "Kurir", "CEKFU", "Aksi"];
    }
    return [];
  };

  const renderTableRows = () => {
    if (modalType === "belumKirim") {
      return currentData.map((item, index) => (
        <TableRow key={item.resino || index}>
          <TableCell>{item.resino}</TableCell>
          <TableCell>{item.nokarung || "-"}</TableCell>
          <TableCell>{item.created ? format(new Date(item.created), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.couriername || "-"}</TableCell>
          <TableCell>{item.flag || "-"}</TableCell>
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
            {/* No Confirm button for 'belumKirim' as per original logic, it's for expeditionDetail */}
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
            {/* Confirm button might be relevant here too if 'late' items can be confirmed */}
            <Button variant="default" size="sm" onClick={() => onConfirmResi(item.Resi)}>
              Konfirmasi
            </Button>
          </TableCell>
        </TableRow>
      ));
    } else if (modalType === "expeditionDetail") {
      return currentData.map((item, index) => (
        <TableRow key={item.resino || index}>
          <TableCell>{item.resino}</TableCell>
          <TableCell>{item.nokarung || "-"}</TableCell>
          <TableCell>{item.created ? format(new Date(item.created), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.couriername || "-"}</TableCell>
          <TableCell>{item.flag || "-"}</TableCell>
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
            <Button variant="default" size="sm" onClick={() => onConfirmResi(item.resino)}>
              Konfirmasi
            </Button>
          </TableCell>
        </TableRow>
      ));
    }
    return null;
  };

  // Logic to determine which page numbers to display
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
            Menampilkan {currentData.length} dari {filteredData.length} resi.
            {selectedCourier && ` (Kurir: ${selectedCourier})`}
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          <Input
            placeholder="Cari Resi, No Karung, Kurir, atau Keterangan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
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