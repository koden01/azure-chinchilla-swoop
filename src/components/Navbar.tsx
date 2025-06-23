import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Plus, History, LayoutDashboard } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const Navbar = () => {
  const location = useLocation();
  const queryClient = useQueryClient();

  const navItems = [
    { name: "Input", path: "/", icon: Plus },
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "History", path: "/history", icon: History },
  ];

  // Function to pre-fetch dashboard data
  const prefetchDashboardData = async () => {
    const today = new Date();
    const formattedDate = format(today, "yyyy-MM-dd");
    const formattedDateISO = today.toISOString().split('T')[0]; // For queries using date part only

    console.log(`Prefetching dashboard data for date: ${formattedDate}`);

    // Prefetch Transaksi Hari Ini
    queryClient.prefetchQuery({
      queryKey: ["transaksiHariIni", formattedDate],
      queryFn: async () => {
        const { data: countData, error } = await supabase.rpc("get_transaksi_hari_ini_count", {
          p_selected_date: formattedDate,
        });
        if (error) throw error;
        return countData || 0;
      },
    });

    // Prefetch Total Scan
    queryClient.prefetchQuery({
      queryKey: ["totalScan", formattedDateISO], // Use formattedDateISO
      queryFn: async () => {
        const { count, error } = await supabase
          .from("tbl_resi")
          .select("*", { count: "exact" })
          .eq("schedule", "ontime")
          .gte("created", today.toISOString().split('T')[0] + 'T00:00:00.000Z') // Start of day
          .lt("created", new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z'); // End of day
        if (error) throw error;
        return count || 0;
      },
    });

    // Prefetch ID Rekomendasi
    queryClient.prefetchQuery({
      queryKey: ["idRekCount", formattedDateISO], // Use formattedDateISO
      queryFn: async () => {
        const { count, error } = await supabase
          .from("tbl_resi")
          .select("*", { count: "exact" })
          .eq("Keterangan", "ID_REKOMENDASI")
          .gte("created", today.toISOString().split('T')[0] + 'T00:00:00.000Z')
          .lt("created", new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z');
        if (error) throw error;
        return count || 0;
      },
    });

    // Prefetch Belum Kirim
    queryClient.prefetchQuery({
      queryKey: ["belumKirim", formattedDate],
      queryFn: async () => {
        const { data: countData, error } = await supabase.rpc("get_belum_kirim_count", {
          p_selected_date: formattedDate,
        });
        if (error) throw error;
        return countData || 0;
      },
    });

    // Prefetch Follow Up (Belum Kirim) - uses actual current date
    const actualCurrentFormattedDate = format(new Date(), 'yyyy-MM-dd');
    queryClient.prefetchQuery({
      queryKey: ["followUpFlagNoCount", actualCurrentFormattedDate],
      queryFn: async () => {
        const { data: countData, error } = await supabase.rpc("get_flag_no_except_today_count", {
          p_selected_date: actualCurrentFormattedDate,
        });
        if (error) throw error;
        return countData || 0;
      },
    });

    // Prefetch Scan Followup (Late)
    queryClient.prefetchQuery({
      queryKey: ["scanFollowupLateCount", formattedDateISO], // Use formattedDateISO
      queryFn: async () => {
        const { count, error } = await supabase
          .from("tbl_resi")
          .select("*", { count: "exact" })
          .eq("schedule", "late")
          .gte("created", today.toISOString().split('T')[0] + 'T00:00:00.000Z')
          .lt("created", new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z');
        if (error) throw error;
        return count || 0;
      },
    });

    // Prefetch Batal
    queryClient.prefetchQuery({
      queryKey: ["batalCount", formattedDateISO], // Use formattedDateISO
      queryFn: async () => {
        const { count, error } = await supabase
          .from("tbl_resi")
          .select("*", { count: "exact" })
          .eq("schedule", "batal")
          .gte("created", today.toISOString().split('T')[0] + 'T00:00:00.000Z')
          .lt("created", new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z');
        if (error) throw error;
        return count || 0;
      },
    });

    // Prefetch Expedisi Data for Selected Date (RPC)
    queryClient.prefetchQuery({
      queryKey: ["expedisiDataForSelectedDate", formattedDate],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_transaksi_hari_ini_records", {
          p_selected_date: formattedDate,
        });
        if (error) throw error;
        return data || [];
      },
    });

    // Prefetch All Resi Data for Selected Date (paginated)
    queryClient.prefetchQuery({
      queryKey: ["allResiData", formattedDateISO], // Use formattedDateISO
      queryFn: async () => {
        let allRecords: any[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        const startOfTodayISO = today.toISOString().split('T')[0] + 'T00:00:00.000Z';
        const endOfTodayISO = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z';

        while (hasMore) {
          const { data, error } = await supabase
            .from("tbl_resi")
            .select("*")
            .gte("created", startOfTodayISO)
            .lt("created", endOfTodayISO)
            .range(offset, offset + limit - 1);

          if (error) throw error;
          if (data && data.length > 0) {
            allRecords = allRecords.concat(data);
            offset += data.length;
            hasMore = data.length === limit;
          } else {
            hasMore = false;
          }
        }
        return allRecords;
      },
    });

    // allExpedisiDataUnfiltered is already persisted and fetched on app load,
    // so explicit prefetch might not be strictly necessary here if it's already in cache.
    // However, including it ensures it's fresh if stale.
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(today.getDate() - 2);
    const twoDaysAgoFormatted = format(twoDaysAgo, "yyyy-MM-dd");
    const endOfTodayFormatted = format(today, "yyyy-MM-dd");

    queryClient.prefetchQuery({
      queryKey: ["allExpedisiDataUnfiltered", twoDaysAgoFormatted, endOfTodayFormatted],
      queryFn: async () => {
        let allRecords: any[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase.from("tbl_expedisi").select("*").range(offset, offset + limit - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allRecords = allRecords.concat(data);
            offset += data.length;
            hasMore = data.length === limit;
          } else {
            hasMore = false;
          }
        }
        const expedisiMap = new Map<string, any>();
        allRecords.forEach(item => {
          if (item.resino) {
            expedisiMap.set(item.resino.toLowerCase(), item);
          }
        });
        return expedisiMap;
      },
    });
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-gradient-to-r from-blue-600 to-purple-700 p-4 flex items-center justify-center shadow-lg">
      <div className="flex items-center space-x-4">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex items-center px-4 py-2 rounded-md text-white text-sm font-medium transition-colors duration-200",
              location.pathname === item.path
                ? "bg-white bg-opacity-20"
                : "hover:bg-white hover:bg-opacity-10"
            )}
            onMouseEnter={item.name === "Dashboard" ? prefetchDashboardData : undefined}
            onFocus={item.name === "Dashboard" ? prefetchDashboardData : undefined}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;