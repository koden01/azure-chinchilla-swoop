import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ModalDataItem } from "@/types/data";
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { addPendingOperation } from "@/integrations/indexeddb/pendingOperations";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useQueryClient, QueryKey } from "@tanstack/react-query";
import { HistoryData } from "@/components/columns/historyColumns";

interface UseDashboardModalsProps {
  date: Date | undefined;
  formattedDate: string;
  allExpedisiData: Map<string, any> | undefined;
}

interface UseDashboardModalsReturn {
  isModalOpen: boolean;
  modalTitle: string;
  modalData: ModalDataItem[];
  modalType: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni" | null;
  selectedCourier: string | null;
  openResiModal: (title: string, data: ModalDataItem[], type: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni", courier?: string | null) => void;
  handleOpenTransaksiHariIniModal: () => Promise<void>;
  handleOpenBelumKirimModal: () => Promise<void>;
  handleOpenFollowUpFlagNoModal: () => Promise<void>;
  handleOpenScanFollowupModal: () => Promise<void>;
  handleOpenExpeditionDetailModal: (courierName: string) => Promise<void>;
  handleCloseModal: () => void;
  handleBatalResi: (resiNumber: string) => Promise<void>;
  onConfirmResi: (resiNumber: string) => Promise<void>;
  onCekfuToggle: (resiNumber: string, currentCekfuStatus: boolean) => Promise<void>;
}

export const useDashboardModals = ({ date, formattedDate, allExpedisiData }: UseDashboardModalsProps): UseDashboardModalsReturn => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalData, setModalData] = React.useState<ModalDataItem[]>([]);
  const [modalType, setModalType] = React.useState<
    "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni" | null
  >(null);
  const [selectedCourier, setSelectedCourier] = React.useState<string | null>(null);

  const { triggerSync: debouncedTriggerSync } = useBackgroundSync();
  const queryClient = useQueryClient();

  const openResiModal = (
    title: string,
    data: ModalDataItem[],
    type: "belumKirim" | "followUp" | "expeditionDetail" | "transaksiHariIni",
    courier: string | null = null
  ) => {
    setModalTitle(title);
    setModalData(data);
    setModalType(type);
    setSelectedCourier(courier);
    setIsModalOpen(true);
  };

  const handleOpenTransaksiHariIniModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_transaksi_hari_ini_records", {
      p_selected_date: formattedDate,
    });
      
    if (error) {
      showError("Gagal memuat data transaksi hari ini.");
      console.error("Error fetching Transaksi Hari Ini data:", error);
      return;
    }
    openResiModal("Transaksi Hari Ini", data || [], "transaksiHariIni");
  };

  const handleOpenBelumKirimModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_belum_kirim_records", {
      p_selected_date: formattedDate,
    });
      
    if (error) {
      showError("Gagal memuat data resi yang belum dikirim.");
      console.error("Error fetching Belum Kirim data:", error);
      return;
    }
    openResiModal("Belum Kirim (Hari Ini)", data || [], "belumKirim");
  };

  const handleOpenFollowUpFlagNoModal = async () => {
    const actualCurrentDate = new Date();
    const actualCurrentFormattedDate = format(actualCurrentDate, 'yyyy-MM-dd');

    const { data, error } = await supabase.rpc("get_flag_no_expedisi_records_except_today", {
      p_selected_date: actualCurrentFormattedDate,
    });

    if (error) {
      showError("Gagal memuat data Follow Up (Belum Kirim).");
      console.error("Error fetching Follow Up (Belum Kirim) data via RPC:", error);
      return;
    }
    openResiModal("Follow Up (Belum Kirim)", data || [], "belumKirim");
  };

  const handleOpenScanFollowupModal = async () => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_scan_follow_up", {
      selected_date: formattedDate,
    });
    if (error) {
      showError("Gagal memuat data Scan Follow Up.");
      console.error("Error fetching Scan Follow Up:", error);
      return;
    }
    openResiModal("Follow Up (Scan Tidak Sesuai Tanggal)", data || [], "followUp");
  };

  const handleOpenExpeditionDetailModal = async (courierName: string) => {
    if (!date) {
      showError("Mohon pilih tanggal terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase.rpc("get_expedition_detail_records", {
      p_couriername: courierName,
      p_selected_date: formattedDate,
    });

    if (error) {
      showError(`Gagal memuat detail resi untuk ${courierName}.`);
      console.error(`Error fetching expedition detail data for ${courierName}:`, error);
      return;
    }
    openResiModal(`Detail Resi ${courierName} (Belum Kirim)`, data || [], "expeditionDetail", courierName);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalData([]);
    setModalType(null);
    setSelectedCourier(null);
  };

  const handleBatalResi = async (resiNumber: string) => {
    console.log(`[handleBatalResi] Attempting to batal resi: ${resiNumber}`);
    const originalModalData = modalData;
    const itemToBatal = originalModalData.find(item => (item.Resi || item.resino) === resiNumber);
    
    // Normalize resiNumber for comparison
    const normalizedResiNumber = resiNumber.toLowerCase().trim();

    setModalData(prevData => {
      const newData = prevData.filter(item => {
        const itemResi = (item.Resi || item.resino || "").toLowerCase().trim();
        return itemResi !== normalizedResiNumber;
      });
      return newData;
    });

    try {
      let expedisiRecord = allExpedisiData?.get(normalizedResiNumber); // Use normalized resi for map lookup
      let originalCourierName: string | null = null;
      let createdTimestampForResi: string;
      
      if (!expedisiRecord) {
        console.log(`[handleBatalResi] Expedisi record not found in cache for ${resiNumber}. Fetching directly.`);
        const { data: directExpedisiData, error: directExpedisiError } = await supabase
            .from("tbl_expedisi")
            .select("created, couriername")
            .eq("resino", resiNumber) // Use original resiNumber for DB query
            .single();

        if (directExpedisiError && directExpedisiError.code !== 'PGRST116') { // PGRST116 means "no rows found"
            throw directExpedisiError;
        }
        
        if (directExpedisiData) {
            expedisiRecord = directExpedisiData;
        } else {
            console.warn(`[handleBatalResi] Resi ${resiNumber} not found in tbl_expedisi. Proceeding with 'batal' in tbl_resi using default values.`);
        }
      }

      // Use the created timestamp from tbl_expedisi if available, otherwise use current time
      createdTimestampForResi = expedisiRecord?.created ? new Date(expedisiRecord.created).toISOString() : new Date().toISOString();
      originalCourierName = expedisiRecord?.couriername || null;

      console.log(`[handleBatalResi] Adding pending operation for batal: ${resiNumber}, created: ${createdTimestampForResi}, courier: ${originalCourierName}`);
      await addPendingOperation({
        id: `batal-${resiNumber}-${Date.now()}`,
        type: "batal",
        payload: {
          resiNumber,
          createdTimestampFromExpedisi: createdTimestampForResi, // Ensure it's an ISO string
          keteranganValue: normalizeExpeditionName(originalCourierName),
          expedisiFlagStatus: "YES", // Changed from "NO" to "YES" as requested
        },
        timestamp: Date.now(),
      });

      showSuccess(`Resi ${resiNumber} berhasil dibatalkan.`);
      
      // Optimistically update historyData cache for any active history queries
      queryClient.setQueriesData({
        queryKey: ["historyData"],
        exact: false,
        updater: (oldData: HistoryData[] | undefined, queryKey: QueryKey) => {
          if (!oldData) return undefined;

          const [, queryStartDateStr, queryEndDateStr] = queryKey;
          const queryStartDate = queryStartDateStr ? new Date(queryStartDateStr as string) : undefined;
          const queryEndDate = queryEndDateStr ? new Date(queryEndDateStr as string) : undefined;

          const affectedResiCreatedDate = itemToBatal?.created ? new Date(itemToBatal.created) : undefined;

          const isAffectedDateIncluded = affectedResiCreatedDate && queryStartDate && queryEndDate &&
                                         isWithinInterval(affectedResiCreatedDate, { start: startOfDay(queryStartDate), end: endOfDay(queryEndDate) });

          if (isAffectedDateIncluded) {
            return oldData.map(item => {
              if (item.Resi === resiNumber) {
                return {
                  ...item,
                  schedule: "batal",
                  Keterangan: normalizeExpeditionName(originalCourierName),
                };
              }
              return item;
            });
          }
          return oldData;
        },
      });

      queryClient.invalidateQueries({ queryKey: ["historyData"] });
      debouncedTriggerSync();

    } catch (error: any) {
      if (itemToBatal) {
        setModalData(originalModalData);
      }
      showError(`Gagal membatalkan resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("Error batal resi:", error);
    }
  };

  const handleConfirmResi = async (resiNumber: string) => {
    const originalModalData = modalData;
    const itemToConfirm = originalModalData.find(item => (item.Resi || item.resino) === resiNumber);
    setModalData(prevData => {
      const newData = prevData.filter(item => {
        const itemResi = item.Resi || item.resino;
        return itemResi !== resiNumber;
      });
      return newData;
    });

    try {
      let expedisiRecord = allExpedisiData?.get(resiNumber.toLowerCase());
      
      if (!expedisiRecord) {
        const { data: directExpedisiData, error: directExpedisiError } = await supabase
            .from("tbl_expedisi")
            .select("created, couriername")
            .eq("resino", resiNumber)
            .single();

        if (directExpedisiError && directExpedisiError.code !== 'PGRST116') {
            throw directExpedisiError;
        }
        
        if (directExpedisiData) {
            expedisiRecord = directExpedisiData;
        } else {
            throw new Error(`Gagal mendapatkan data ekspedisi untuk resi ${resiNumber}: Data tidak ditemukan di database.`);
        }
      }

      const courierNameFromExpedisi = normalizeExpeditionName(expedisiRecord.couriername);
      const expedisiCreatedTimestamp = expedisiRecord.created;

      await addPendingOperation({
        id: `confirm-${resiNumber}-${Date.now()}`,
        type: "confirm",
        payload: {
          resiNumber,
          courierNameFromExpedisi,
          expedisiCreatedTimestamp,
          keteranganValue: courierNameFromExpedisi,
        },
        timestamp: Date.now(),
      });

      showSuccess(`Resi ${resiNumber} berhasil dikonfirmasi.`);
      
      // Optimistically update historyData cache for any active history queries
      queryClient.setQueriesData({
        queryKey: ["historyData"],
        exact: false,
        updater: (oldData: HistoryData[] | undefined, queryKey: QueryKey) => {
          if (!oldData) return undefined;

          const [, queryStartDateStr, queryEndDateStr] = queryKey;
          const queryStartDate = queryStartDateStr ? new Date(queryStartDateStr as string) : undefined;
          const queryEndDate = queryEndDateStr ? new Date(queryEndDateStr as string) : undefined;

          const affectedResiCreatedDate = itemToConfirm?.created ? new Date(itemToConfirm.created) : undefined;

          const isAffectedDateIncluded = affectedResiCreatedDate && queryStartDate && queryEndDate &&
                                         isWithinInterval(affectedResiCreatedDate, { start: startOfDay(queryStartDate), end: endOfDay(queryEndDate) });

          if (isAffectedDateIncluded) {
            return oldData.map(item => {
              if (item.Resi === resiNumber) {
                return {
                  ...item,
                  schedule: "ontime",
                  Keterangan: normalizeExpeditionName(courierNameFromExpedisi),
                };
              }
              return item;
            });
          }
          return oldData;
        },
      });

      queryClient.invalidateQueries({ queryKey: ["historyData"] });
      debouncedTriggerSync();

    } catch (error: any) {
      if (itemToConfirm) {
        setModalData(originalModalData);
      }
      showError(`Gagal mengkonfirmasi resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("[handleConfirmResi] Error confirming resi:", error);
    }
  };

  const onCekfuToggle = async (resiNumber: string, currentCekfuStatus: boolean) => {
    const originalModalData = modalData;
    setModalData(prevData =>
      prevData.map(item => {
        const itemResi = item.Resi || item.resino;
        return itemResi === resiNumber
          ? { ...item, cekfu: !currentCekfuStatus }
          : item;
      })
    );

    try {
      let expedisiRecord = allExpedisiData?.get(resiNumber.toLowerCase());
      
      if (!expedisiRecord) {
        const { data: directExpedisiData, error: directExpedisiError } = await supabase
            .from("tbl_expedisi")
            .select("created, couriername")
            .eq("resino", resiNumber)
            .single();

        if (directExpedisiError && directExpedisiError.code !== 'PGRST116') {
            throw directExpedisiError;
        }
        
        if (directExpedisiData) {
            expedisiRecord = directExpedisiData;
        } else {
            throw new Error(`Gagal memperbarui status CEKFU resi ${resiNumber}: Data ekspedisi tidak ditemukan di database.`);
        }
      }

      await addPendingOperation({
        id: `cekfu-${resiNumber}-${Date.now()}`,
        type: "cekfu",
        payload: {
          resiNumber,
          newCekfuStatus: !currentCekfuStatus,
        },
        timestamp: Date.now(),
      });

      showSuccess(`Status CEKFU resi ${resiNumber} berhasil diperbarui.`);
      queryClient.invalidateQueries({ queryKey: ["historyData"] });
      debouncedTriggerSync();
    } catch (error: any) {
      setModalData(originalModalData);
      showError(`Gagal memperbarui status CEKFU resi ${resiNumber}. ${error.message || "Silakan coba lagi."}`);
      console.error("Error updating CEKFU status:", error);
    }
  };

  return {
    isModalOpen,
    modalTitle,
    modalData,
    modalType,
    selectedCourier,
    openResiModal,
    handleOpenTransaksiHariIniModal,
    handleOpenBelumKirimModal,
    handleOpenFollowUpFlagNoModal,
    handleOpenScanFollowupModal,
    handleOpenExpeditionDetailModal,
    handleCloseModal,
    handleBatalResi,
    onConfirmResi: handleConfirmResi,
    onCekfuToggle,
  };
};