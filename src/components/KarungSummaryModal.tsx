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
  expedition?: string; // Make optional
  date: string;
  summaryData: { karungNumber: string; quantity: number; expeditionName?: string }[]; // Add optional expeditionName
  showAllExpeditions: boolean; // New prop to indicate if it's showing all
}

const KarungSummaryModal: React.FC<KarungSummaryModalProps> = ({
  isOpen,
  onClose,
  expedition,
  date,
  summaryData,
  showAllExpeditions, // Destructure new prop
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {showAllExpeditions ? "Ringkasan Karung Semua Expedisi" : `Ringkasan Karung ${expedition}`}
          </DialogTitle>
          <DialogDescription>
            Detail karung untuk {showAllExpeditions ? "semua ekspedisi" : `ekspedisi ${expedition}`} pada tanggal {date}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                {showAllExpeditions && <TableHead>Expedisi</TableHead>} {/* Conditionally render */}
                <TableHead>No Karung</TableHead>
                <TableHead className="text-right">QTY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.length > 0 ? (
                summaryData.map((item, index) => (
                  <TableRow key={`${item.expeditionName || expedition}-${item.karungNumber}-${index}`}>
                    {showAllExpeditions && <TableCell className="font-medium">{item.expeditionName}</TableCell>} {/* Conditionally render */}
                    <TableCell className="font-medium">{item.karungNumber}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={showAllExpeditions ? 3 : 2} className="text-center">
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