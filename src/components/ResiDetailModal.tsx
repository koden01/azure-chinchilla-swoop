import React from "react";
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
  onBatalResi,
  onConfirmResi,
  onCekfuToggle,
}) => {
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    // Reset to first page when modal opens or data/type changes
    setCurrentPage(1);
  }, [isOpen, data, modalType]);

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = data.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getTableHeaders = () => {
    if (modalType === "belumKirim" || modalType === "expeditionDetail") {
      return ["No. Resi", "Tanggal Input", "Flag", "Aksi"];
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
          <TableCell>{item.created ? format(new Date(item.created), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.flag}</TableCell>
          <TableCell>
            <Button variant="destructive" size="sm" onClick={() => onBatalResi(item.resino)}>
              Batal
            </Button>
            <Checkbox
              checked={item.cekfu || false}
              onCheckedChange={() => onCekfuToggle(item.resino, item.cekfu || false)}
              className="ml-2"
            />
          </TableCell>
        </TableRow>
      ));
    } else if (modalType === "followUp") {
      return currentData.map((item, index) => (
        <TableRow key={item.Resi || index}>
          <TableCell>{item.Resi}</TableCell>
          <TableCell>{item.created_resi ? format(new Date(item.created_resi), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.created_expedisi ? format(new Date(item.created_expedisi), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.couriername}</TableCell>
          <TableCell>
            <Checkbox
              checked={item.cekfu || false}
              onCheckedChange={() => onCekfuToggle(item.Resi, item.cekfu || false)}
            />
          </TableCell>
          <TableCell>
            <Button variant="destructive" size="sm" onClick={() => onBatalResi(item.Resi)}>
              Batal
            </Button>
          </TableCell>
        </TableRow>
      ));
    } else if (modalType === "expeditionDetail") {
      return currentData.map((item, index) => (
        <TableRow key={item.resino || index}>
          <TableCell>{item.resino}</TableCell>
          <TableCell>{item.created ? format(new Date(item.created), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
          <TableCell>{item.flag}</TableCell>
          <TableCell>
            <Button variant="default" size="sm" onClick={() => onConfirmResi(item.resino)}>
              Konfirmasi
            </Button>
          </TableCell>
        </TableRow>
      ));
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Menampilkan {currentData.length} dari {data.length} resi.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
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
              {Array.from({ length: totalPages }, (_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={i + 1 === currentPage}
                    onClick={() => handlePageChange(i + 1)}
                  >
                    {i + 1}
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