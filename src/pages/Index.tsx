"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SummaryCard from "@/components/SummaryCard";
import { DatePicker } from "@/components/ui/date-picker"; // Menggunakan DatePicker dari shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

const Index: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [followUpCount, setFollowUpCount] = useState<number | null>(null);
  // Anda bisa menambahkan state lain untuk kartu ringkasan lainnya di sini

  useEffect(() => {
    const fetchFollowUpCount = async () => {
      if (!selectedDate) {
        setFollowUpCount(0);
        return;
      }

      // Memanggil fungsi RPC Supabase untuk mendapatkan jumlah follow up
      const { data, error } = await supabase.rpc('get_flag_no_except_today_count', {
        p_selected_date: format(selectedDate, 'yyyy-MM-dd'), // Format tanggal ke 'YYYY-MM-DD'
      });

      if (error) {
        console.error('Error fetching follow up count:', error);
        setFollowUpCount(0); // Atur ke 0 jika ada kesalahan
      } else {
        setFollowUpCount(data);
      }
    };

    fetchFollowUpCount();
  }, [selectedDate]); // Jalankan ulang efek saat selectedDate berubah

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard Expedisi</h1>

      <div className="mb-6 flex items-center space-x-4">
        <h2 className="text-xl font-semibold">Pilih Tanggal:</h2>
        <DatePicker
          date={selectedDate}
          setDate={setSelectedDate}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Kartu Follow Up */}
        <SummaryCard
          title="Follow Up"
          value={followUpCount !== null ? followUpCount : "Memuat..."}
          gradientFrom="from-red-500"
          gradientTo="to-red-700"
          icon="warning"
          onClick={() => console.log("Follow Up card clicked!")}
        />

        {/* Anda bisa menambahkan kartu ringkasan lainnya di sini */}
        <SummaryCard
          title="Total Paket"
          value={1234} // Contoh nilai
          gradientFrom="from-blue-500"
          gradientTo="to-blue-700"
          icon="package"
          onClick={() => console.log("Total Paket card clicked!")}
        />
        <SummaryCard
          title="Paket Terkirim"
          value={1000} // Contoh nilai
          gradientFrom="from-green-500"
          gradientTo="to-green-700"
          icon="check"
          onClick={() => console.log("Paket Terkirim card clicked!")}
        />
        <SummaryCard
          title="Paket Bermasalah"
          value={50} // Contoh nilai
          gradientFrom="from-orange-500"
          gradientTo="to-orange-700"
          icon="x"
          onClick={() => console.log("Paket Bermasalah card clicked!")}
        />
      </div>

      {/* Bagian lain dari dashboard Anda bisa ditambahkan di sini */}
    </div>
  );
};

export default Index;