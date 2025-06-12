import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import SummaryCard from "@/components/SummaryCard";
import ExpeditionDetailCard from "@/components/ExpeditionDetailCard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const Index = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]"> {/* Adjusted min-h to account for Navbar height */}
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
          value={588}
          gradientFrom="from-green-400"
          gradientTo="to-blue-500"
        />
        <SummaryCard
          title="Total Scan"
          value={182}
          gradientFrom="from-purple-500"
          gradientTo="to-pink-500"
        />
        <SummaryCard
          title="Belum Dikirim"
          value={403}
          gradientFrom="from-orange-500"
          gradientTo="to-red-500"
          icon="warning"
        />
        <SummaryCard
          title="Batal"
          value={3}
          gradientFrom="from-blue-500"
          gradientTo="to-purple-600"
          icon="info"
        />
        <SummaryCard
          title="Follow Up"
          value={7}
          gradientFrom="from-orange-500"
          gradientTo="to-red-500"
        />
        <SummaryCard
          title="Scan Follow Up"
          value={0}
          gradientFrom="from-blue-500"
          gradientTo="to-purple-600"
          icon="clock"
        />
      </div>

      {/* Detail per Expedisi Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Detail per Expedisi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ExpeditionDetailCard
            name="JNE"
            totalTransaksi={21}
            totalScan={0}
            sisa={21}
            jumlahKarung={0}
          />
          <ExpeditionDetailCard
            name="SPX"
            totalTransaksi={261}
            totalScan={163}
            sisa={96}
            jumlahKarung={4}
          />
          <ExpeditionDetailCard
            name="INSTAN"
            totalTransaksi={19}
            totalScan={19}
            sisa={0}
            jumlahKarung={1}
          />
          <ExpeditionDetailCard
            name="ID"
            totalTransaksi={178}
            totalScan={178}
            sisa={0}
            jumlahKarung={0}
            idRekomendasi={0}
          />
          <ExpeditionDetailCard
            name="SICEPAT"
            totalTransaksi={61}
            totalScan={0}
            sisa={61}
            jumlahKarung={0}
          />
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;