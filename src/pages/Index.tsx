import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import SummaryCard from "@/components/SummaryCard";
import ExpeditionDetailCard from "@/components/ExpeditionDetailCard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import ResiDetailModal from "@/components/ResiDetailModal";

// Define types for Supabase data
interface TblExpedisi {
  datetrans: string | null;
  chanelsales: string | null;
  orderno: string;
  couriername: string | null;
  resino: string;
  created: string | null;
  flag: string | null;
  cekfu: boolean | null;
}

interface TblResi {
  created: string;
  Resi: string;
  Keterangan: string | null;
  nokarung: string | null;
  schedule: string | null;
}

interface ScanFollowUpData {
  Resi: string;
  created_resi: string;
  created_expedisi: string | null;
  couriername: string | null;
  cekfu?: boolean; // Added for follow-up modal
}

interface ExpeditionSummary {
  name: string;
  totalTransaksi: number;
  totalScan: number;
  sisa: number;
  jumlahKarung: number;
  idRekomendasi: number;
}

const Index = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const formattedDate = date ? format(date, "yyyy-MM-dd") : "";
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalData, setModalData] = React.useState<any[]>([]);
  const [modalType, setModalType] = React.useState<
    "belumKirim" | "followUp" | "expeditionDetail" | null
  >(null);
  const [selectedCourier, setSelectedCourier] = React.useState<string | null>(null);

  // Fetching summary data
  const { data: transaksiHariIni, isLoading: isLoadingTransaksiHariIni } = useQuery<number>({
    queryKey: ["transaksiHariIni", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("resino", { count: "exact", head: true })
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: totalScan, isLoading: isLoadingTotalScan } = useQuery<number>({
    queryKey: ["totalScan", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("Resi", { count: "exact", head: true })
        .eq("schedule", "ontime")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: idRekomendasi, isLoading: isLoadingIdRekomendasi } = useQuery<number>({
    queryKey: ["idRekomendasi", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("Resi", { count: "exact", head: true })
        .eq("schedule", "idrek")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: belumKirim, isLoading: isLoadingBelumKirim } = useQuery<number>({
    queryKey: ["belumKirim", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_expedisi")
        .select("resino", { count: "exact", head: true })
        .eq("flag", "NO")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: batalCount, isLoading: isLoadingBatalCount } = useQuery<number>({
    queryKey: ["batalCount", formattedDate],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tbl_resi")
        .select("Resi", { count: "exact", head: true })
        .eq("schedule", "batal")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!date,
  });

  const { data: followUpData, isLoading: isLoadingFollowUp } = useQuery<ScanFollowUpData[]>({
    queryKey: ["followUpData", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_scan_follow_up", {
        selected_date: formattedDate,
      });
      if (error) throw error;
      // For follow-up, we need to get cekfu from tbl_expedisi
      const resiWithCekfu = await Promise.all((data || []).map(async (item: ScanFollowUpData) => {
        const { data: expedisiDetail, error: expError } = await supabase
          .from("tbl_expedisi")
          .select("cekfu")
          .eq("resino", item.Resi)
          .single();
        return {
          ...item,
          cekfu: expedisiDetail?.cekfu || false, // Default to false if not found
        };
      }));
      return resiWithCekfu || [];
    },
    enabled: !!date,
  });

  // Fetching all expedition and resi data for detailed summary calculation
  const { data: allExpedisi, isLoading: isLoadingAllExpedisi } = useQuery<TblExpedisi[]>({
    queryKey: ["allExpedisi", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_expedisi")
        .select("*")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!date,
  });

  const { data: allResi, isLoading: isLoadingAllResi } = useQuery<TblResi[]>({
    queryKey: ["allResi", formattedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tbl_resi")
        .select("*")
        .gte("created", startOfDay(date!).toISOString())
        .lt("created", endOfDay(date!).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!date,
  });

  const expeditionSummaries: ExpeditionSummary[] = React.useMemo(() => {
    if (!allExpedisi || !allResi) return [];

    const summaries: { [key: string]: ExpeditionSummary } = {};

    // Initialize summaries with all unique courier names from tbl_expedisi
    allExpedisi.forEach((exp) => {
      if (exp.couriername && !summaries[exp.couriername]) {
        summaries[exp.couriername] = {
          name: exp.couriername,
          totalTransaksi: 0,
          totalScan: 0,
          sisa: 0,
          jumlahKarung: 0,
          idRekomendasi: 0,
        };
      }
    });

    // Calculate totalTransaksi
    allExpedisi.forEach((exp) => {
      if (exp.couriername) {
        summaries[exp.couriername].totalTransaksi++;
      }
    });

    // Calculate totalScan, idRekomendasi, and unique nokarung
    const courierNokarungMap: { [key: string]: Set<string> } = {};
    allResi.forEach((resi) => {
      const matchingExpedisi = allExpedisi.find((exp) => exp.resino === resi.Resi);
      if (matchingExpedisi && matchingExpedisi.couriername) {
        const courierSummary = summaries[matchingExpedisi.couriername];
        if (courierSummary) {
          if (resi.schedule === "ontime") {
            courierSummary.totalScan++;
          }
          if (resi.schedule === "idrek") {
            courierSummary.idRekomendasi++;
          }
          if (resi.nokarung) {
            if (!courierNokarungMap[matchingExpedisi.couriername]) {
              courierNokarungMap[matchingExpedisi.couriername] = new Set();
            }
            courierNokarungMap[matchingExpedisi.couriername].add(resi.nokarung);
          }
        }
      }
    });

    // Assign jumlahKarung from the map
    Object.keys(summaries).forEach((courierName) => {
      summaries[courierName].jumlahKarung = courierNokarungMap[courierName]?.size || 0;
    });

    // Calculate sisa
    Object.values(summaries).forEach((summary) => {
      summary.sisa = summary.totalTransaksi - summary.totalScan;
    });

    return Object.values(summaries);
  }, [allExpedisi, allResi]);

  const handleOpenBelumKirimModal = async () => {
    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("*")
      .eq("flag", "NO")
      .gte("created", startOfDay(date!).toISOString())
      .lt("created", endOfDay(date!).toISOString());
    if (error) {
      showError("Gagal memuat data Belum Kirim.");
      console.error("Error fetching Belum Kirim:", error);
      return;
    }
    setModalTitle("Detail Resi Belum Dikirim");
    setModalData(data || []);
    setModalType("belumKirim");
    setIsModalOpen(true);
  };

  const handleOpenFollowUpModal = async () => {
    const { data, error } = await supabase.rpc("get_scan_follow_up", {
      selected_date: formattedDate,
    });
    if (error) {
      showError("Gagal memuat data Follow Up.");
      console.error("Error fetching Follow Up:", error);
      return;
    }
    // For follow-up, we need to get cekfu from tbl_expedisi
    const resiWithCekfu = await Promise.all((data || []).map(async (item: ScanFollowUpData) => {
      const { data: expedisiDetail, error: expError } = await supabase
        .from("tbl_expedisi")
        .select("cekfu")
        .eq("resino", item.Resi)
        .single();
      return {
        ...item,
        cekfu: expedisiDetail?.cekfu || false, // Default to false if not found
      };
    }));

    setModalTitle("Detail Resi Follow Up");
    setModalData(resiWithCekfu || []);
    setModalType("followUp");
    setIsModalOpen(true);
  };

  const handleOpenExpeditionDetailModal = async (courierName: string) => {
    setSelectedCourier(courierName);
    const { data, error } = await supabase
      .from("tbl_expedisi")
      .select("*")
      .eq("couriername", courierName)
      .eq("flag", "NO") // Only show 'NO' status as per request
      .gte("created", startOfDay(date!).toISOString())
      .lt("created", endOfDay(date!).toISOString());
    if (error) {
      showError(`Gagal memuat detail ekspedisi ${courierName}.`);
      console.error(`Error fetching expedition detail for ${courierName}:`, error);
      return;
    }
    setModalTitle(`Detail Resi ${courierName} (Belum Kirim)`);
    setModalData(data || []);
    setModalType("expeditionDetail");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalData([]);
    setModalType(null);
    setSelectedCourier(null);
  };

  const handleBatalResi = async (resiNumber: string) => {
    const { error } = await supabase
      .from("tbl_resi")
      .update({ schedule: "batal" })
      .eq("Resi", resiNumber);

    if (error) {
      showError(`Gagal membatalkan resi ${resiNumber}.`);
      console.error("Error batal resi:", error);
    } else {
      showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["batalCount", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["allResi", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["allExpedisi", formattedDate] });
      handleCloseModal();
    }
  };

  const handleConfirmResi = async (resiNumber: string) => {
    // Update tbl_expedisi flag to 'YES'
    const { error: expError } = await supabase
      .from("tbl_expedisi")
      .update({ flag: "YES" })
      .eq("resino", resiNumber);

    if (expError) {
      showError(`Gagal mengkonfirmasi resi ${resiNumber} di tbl_expedisi.`);
      console.error("Error confirming resi in tbl_expedisi:", expError);
      return;
    }

    // Update tbl_resi schedule to 'ontime'
    const { error: resiError } = await supabase
      .from("tbl_resi")
      .update({ schedule: "ontime" })
      .eq("Resi", resiNumber);

    if (resiError) {
      showError(`Gagal mengkonfirmasi resi ${resiNumber} di tbl_resi.`);
      console.error("Error confirming resi in tbl_resi:", resiError);
      return;
    }

    showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
    queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["totalScan", formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["allResi", formattedDate] });
    queryClient.invalidateQueries({ queryKey: ["allExpedisi", formattedDate] });
    handleCloseModal();
  };

  const handleCekfuToggle = async (resiNumber: string, currentCekfuStatus: boolean) => {
    const { error } = await supabase
      .from("tbl_expedisi")
      .update({ cekfu: !currentCekfuStatus })
      .eq("resino", resiNumber);

    if (error) {
      showError(`Gagal memperbarui status CEKFU untuk resi ${resiNumber}.`);
      console.error("Error updating CEKFU status:", error);
    } else {
      showSuccess(`Status CEKFU untuk resi ${resiNumber} berhasil diperbarui.`);
      queryClient.invalidateQueries({ queryKey: ["followUpData", formattedDate] });
      queryClient.invalidateQueries({ queryKey: ["belumKirim", formattedDate] }); // cekfu is in tbl_expedisi
      queryClient.invalidateQueries({ queryKey: ["allExpedisi", formattedDate] });
      // Re-open modal with updated data if needed, or refetch modal data
      if (modalType === "belumKirim") {
        handleOpenBelumKirimModal();
      } else if (modalType === "followUp") {
        handleOpenFollowUpModal();
      }
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
      {/* Filter Tanggal Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg shadow-md">
        <h2 className="text-white text-xl font-semibold mb-4">Filter Tanggal</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[280px] justify-start text-left font-normal bg-white text-gray-800 hover:bg-gray-100",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryCard
          title="Terisi Hari Ini"
          value={isLoadingTransaksiHariIni ? "Loading..." : transaksiHariIni || 0}
          gradientFrom="from-green-400"
          gradientTo="to-blue-500"
        />
        <SummaryCard
          title="Total Scan"
          value={isLoadingTotalScan ? "Loading..." : totalScan || 0}
          gradientFrom="from-purple-500"
          gradientTo="to-pink-500"
        />
        <SummaryCard
          title="Belum Dikirim"
          value={isLoadingBelumKirim ? "Loading..." : belumKirim || 0}
          gradientFrom="from-orange-500"
          gradientTo="to-red-500"
          icon="warning"
          onClick={handleOpenBelumKirimModal} // Add onClick handler
        />
        <SummaryCard
          title="Batal"
          value={isLoadingBatalCount ? "Loading..." : batalCount || 0}
          gradientFrom="from-blue-500"
          gradientTo="to-purple-600"
          icon="info"
        />
        <SummaryCard
          title="Follow Up"
          value={isLoadingFollowUp ? "Loading..." : followUpData?.length || 0}
          gradientFrom="from-orange-500"
          gradientTo="to-red-500"
          onClick={handleOpenFollowUpModal} // Add onClick handler
        />
        <SummaryCard
          title="Scan Follow Up"
          value={isLoadingIdRekomendasi ? "Loading..." : idRekomendasi || 0}
          gradientFrom="from-blue-500"
          gradientTo="to-purple-600"
          icon="clock"
        />
      </div>

      {/* Detail per Expedisi Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Detail per Expedisi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {expeditionSummaries.map((summary) => (
            <div key={summary.name} onClick={() => handleOpenExpeditionDetailModal(summary.name)}>
              <ExpeditionDetailCard
                name={summary.name}
                totalTransaksi={summary.totalTransaksi}
                totalScan={summary.totalScan}
                sisa={summary.sisa}
                jumlahKarung={summary.jumlahKarung}
                idRekomendasi={summary.idRekomendasi}
              />
            </div>
          ))}
        </div>
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
  );
};

export default Index;