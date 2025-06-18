import React from "react";
// Dyad Debug: Forcing re-evaluation of DashboardPage.tsx
console.log("DashboardPage.tsx loaded at:", new Date().toISOString());
import { MadeWithDyad } from "@/components/made-with-dyad";
import SummaryCard from "@/components/SummaryCard";
import ExpeditionDetailCard from "@/components/ExpeditionDetailCard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CalendarDays, Package, Loader2 } from "lucide-react"; // Import Loader2
import { format } from "date-fns";
import { cn } from "@/lib/utils";
// import { useQueryClient } from "@tanstack/react-query"; // Removed unused import
import ResiDetailModal from "@/components/ResiDetailModal";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardModals } from "@/hooks/useDashboardModals";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const DashboardPage: React.FC = () => {
  console.log("DashboardPage rendering..."); // Added this line to force re-evaluation
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  // const queryClient = useQueryClient(); // Removed unused declaration

  // Inisialisasi useTransition
  const [isPending, startTransition] = React.useTransition();

  // State for expedition detail pagination
  const [expeditionCurrentPage, setExpeditionCurrentPage] = React.useState(1);
  const EXPEDITIONS_PER_PAGE = 6; // Number of expedition cards per page

  const {
    transaksiHariIni,
    isLoadingTransaksiHariIni,
    totalScan,
    isLoadingTotalScan,
    idRekCount,
    isLoadingIdRekCount,
    belumKirim,
    isLoadingBelumKirim,
    followUpFlagNoCount,
    isLoadingFollowUpFlagNoCount,
    scanFollowupLateCount,
    isLoadingScanFollowupLateCount,
    batalCount,
    isLoadingBatalCount,
    formattedDate,
    allExpedisiData,
    expeditionSummaries, // Data ini berasal dari useDashboardData
  } = useDashboardData(date);

  const {
    isModalOpen,
    modalTitle,
    modalData,
    modalType,
    selectedCourier,
    handleOpenTransaksiHariIniModal,
    handleOpenBelumKirimModal, // Keep this as it's now used
    handleOpenFollowUpFlagNoModal,
    handleOpenScanFollowupModal,
    handleOpenExpeditionDetailModal,
    handleCloseModal,
    handleBatalResi,
    handleConfirmResi,
    handleCekfuToggle,
  } = useDashboardModals({ date, formattedDate, allExpedisiData });

  // Calculate pagination for expedition details
  const totalExpeditionPages = Math.ceil(expeditionSummaries.length / EXPEDITIONS_PER_PAGE);
  const expeditionStartIndex = (expeditionCurrentPage - 1) * EXPEDITIONS_PER_PAGE;
  const expeditionEndIndex = expeditionStartIndex + EXPEDITIONS_PER_PAGE;
  const currentExpeditionSummaries = expeditionSummaries.slice(expeditionStartIndex, expeditionEndIndex);

  const handleExpeditionPageChange = (page: number) => {
    if (page >= 1 && page <= totalExpeditionPages) {
      setExpeditionCurrentPage(page);
    }
  };

  // Logic to determine which page numbers to display for expedition pagination
  const getExpeditionPaginationPages = React.useMemo(() => {
    const pages = [];
    if (totalExpeditionPages <= 3) {
      for (let i = 1; i <= totalExpeditionPages; i++) {
        pages.push(i);
      }
    } else {
      if (expeditionCurrentPage <= 2) {
        pages.push(1, 2, 3);
      } else if (expeditionCurrentPage >= totalExpeditionPages - 1) {
        pages.push(totalExpeditionPages - 2, totalExpeditionPages - 1, totalExpeditionPages);
      } else {
        pages.push(expeditionCurrentPage - 1, expeditionCurrentPage, expeditionCurrentPage + 1);
      }
    }
    return pages;
  }, [expeditionCurrentPage, totalExpeditionPages]);

  console.log("DashboardPage: expeditionSummaries (from hook):", expeditionSummaries); // Debug log
  console.log("DashboardPage: currentExpeditionSummaries (after pagination):", currentExpeditionSummaries); // Debug log
  console.log("DashboardPage: currentExpeditionSummaries being mapped:", currentExpeditionSummaries);


  return (
    <>
      <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)] mt-16"> {/* Added mt-16 to account for fixed navbar */}
        {/* Filter Tanggal Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg shadow-md">
          <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
            <CalendarDays className="mr-2 h-6 w-6" /> Filter Tanggal
          </h2>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full md:w-[280px] justify-start text-left font-normal bg-white text-gray-800 hover:bg-gray-100",
                  !date && "text-muted-foreground"
                )}
                disabled={isPending} // Disable button while pending
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                {isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} {/* Show spinner */}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => {
                  // Gunakan startTransition untuk pembaruan state yang mungkin memakan waktu
                  startTransition(() => {
                    setDate(newDate);
                  });
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SummaryCard
            title="Transaksi Hari Ini"
            value={isLoadingTransaksiHariIni ? "Loading..." : transaksiHariIni || 0}
            sisaTitle="Sisa"
            sisaValue={isLoadingBelumKirim ? "Loading..." : belumKirim || 0}
            gradientFrom="from-green-400"
            gradientTo="to-blue-500"
            icon="package"
            onClick={handleOpenTransaksiHariIniModal}
            onSisaClick={handleOpenBelumKirimModal} {/* Added onClick for Sisa */}
          />
          <SummaryCard
            title="Total Scan"
            value={isLoadingTotalScan ? "Loading..." : totalScan || 0}
            secondaryTitle="ID Rekomendasi"
            secondaryValue={isLoadingIdRekCount ? "Loading..." : idRekCount || 0}
            gradientFrom="from-purple-500"
            gradientTo="to-pink-500"
            icon="maximize"
          />
          <SummaryCard
            title="Follow Up"
            value={isLoadingFollowUpFlagNoCount ? "Loading..." : followUpFlagNoCount || 0}
            secondaryTitle="Scan Followup"
            secondaryValue={isLoadingScanFollowupLateCount ? "Loading..." : scanFollowupLateCount || 0}
            gradientFrom="from-orange-500"
            gradientTo="to-red-500"
            icon="warning"
            onClick={handleOpenFollowUpFlagNoModal}
            onSisaClick={handleOpenScanFollowupModal}
          />
          <SummaryCard
            title="Batal"
            value={isLoadingBatalCount ? "Loading..." : batalCount || 0}
            gradientFrom="from-red-700"
            gradientTo="to-red-900"
            icon="info"
          />
        </div>

        {/* Detail per Expedisi Section */}
        <div className="space-y-4 p-6 rounded-lg shadow-md bg-gradient-to-r from-emerald-400 to-blue-400">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Package className="mr-2 h-6 w-6" /> Detail per Expedisi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentExpeditionSummaries && currentExpeditionSummaries.length > 0 ? (
              currentExpeditionSummaries.map((summary) => {
                return (
                  <div key={summary.name} onClick={() => handleOpenExpeditionDetailModal(summary.name)}>
                    <ExpeditionDetailCard
                      name={summary.name}
                      totalTransaksi={summary.totalTransaksi}
                      totalScan={summary.totalScan}
                      sisa={summary.sisa}
                      jumlahKarung={summary.jumlahKarung}
                      idRekomendasi={summary.idRekomendasi}
                      totalBatal={summary.totalBatal}
                      totalScanFollowUp={summary.totalScanFollowUp}
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-white col-span-full text-center">Memuat detail ekspedisi atau tidak ada data.</p>
            )}
          </div>
          {totalExpeditionPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationPrevious
                  href="#"
                  onClick={() => handleExpeditionPageChange(expeditionCurrentPage - 1)}
                  className={expeditionCurrentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
                {getExpeditionPaginationPages.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === expeditionCurrentPage}
                      onClick={() => handleExpeditionPageChange(pageNumber)}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={() => handleExpeditionPageChange(expeditionCurrentPage + 1)}
                    className={expeditionCurrentPage === totalExpeditionPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
        <MadeWithDyad />

        <ResiDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={modalTitle}
          data={modalData}
          modalType={modalType}
          selectedCourier={selectedCourier}
          onBatalResi={handleBatalResi}
          onConfirmResi={handleConfirmResi}
          onCekfuToggle={handleCekfuToggle}
        />
      </div>
    </>
  );
};

export default DashboardPage;