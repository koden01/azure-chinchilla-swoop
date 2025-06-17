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

interface KarungSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedition: string;
  date: string;
  summaryData: { karungNumber: string; quantity: number; }[];
}

const KarungSummaryModal: React.FC<KarungSummaryModalProps> = ({
  isOpen,
  onClose,
  expedition,
  date,
  summaryData,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ringkasan Karung</DialogTitle>
          <DialogDescription>
            Detail karung untuk ekspedisi {expedition} pada tanggal {date}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No Karung</TableHead>
                <TableHead className="text-right">QTY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.length > 0 ? (
                summaryData.map((item) => (
                  <TableRow key={item.karungNumber}>
                    <TableCell className="font-medium">{item.karungNumber}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    Tidak ada data karung untuk tanggal ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KarungSummaryModal;