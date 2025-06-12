import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";

interface ResiExpedisiData {
  Resi: string;
  nokarung: string | null;
  created: string;
  tbl_expedisi: {
    couriername: string | null;
  };
}

const InputPage = () => {
  const [expedition, setExpedition] = React.useState<string>("");
  const [selectedKarung, setSelectedKarung] = React.useState<string>("");
  const [resiNumber, setResiNumber] = React.useState<string>("");
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");

  const { data: karungSummary, isLoading: isLoadingKarungSummary } = useQuery({
    queryKey: ["karungSummary", expedition, formattedDate],
    queryFn: async () => {
      if (!expedition) return { highest: 0, last: 0, count: 0, karungOptions: [] };

      const { data: resiExpedisiData, error } = await supabase
        .from("tbl_resi")
        .select(`
          Resi,
          nokarung,
          created,
          tbl_expedisi!inner(couriername)
        `)
        .eq("tbl_expedisi.couriername", expedition)
        .gte("created", startOfDay(today).toISOString())
        .lt("created", endOfDay(today).toISOString());

      if (error) {
        console.error("Error fetching karung data:", error);
        throw error;
      }

      const validKarungNumbers = (resiExpedisiData || [])
        .map(item => parseInt(item.nokarung || "0"))
        .filter(num => !isNaN(num) && num > 0);

      const highest = validKarungNumbers.length > 0 ? Math.max(...validKarungNumbers) : 0;

      const sortedByCreated = [...(resiExpedisiData || [])].sort((a, b) => {
        const dateA = new Date(a.created).getTime();
        const dateB = new Date(b.created).getTime();
        return dateB - dateA; // Descending
      });
      const last = sortedByCreated.length > 0 ? parseInt(sortedByCreated[0].nokarung || "0") : 0;

      const count = resiExpedisiData?.length || 0;

      const karungOptions = Array.from({ length: highest > 0 ? highest : 1 }, (_, i) => (i + 1).toString());

      return { highest, last, count, karungOptions };
    },
    enabled: !!expedition, // Only run query if expedition is selected
  });

  const currentCount = karungSummary?.count || 0;
  const lastKarung = karungSummary?.last || 0;
  const highestKarung = karungSummary?.highest || 0;
  const karungOptions = karungSummary?.karungOptions || ["1"];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg shadow-md text-white text-center space-y-4">
        <h2 className="text-2xl font-semibold">Input Data Resi</h2>
        <div className="text-6xl font-bold">
          {isLoadingKarungSummary ? "..." : currentCount}
        </div>
        <p className="text-xl">
          {expedition ? `${expedition} - Karung ${selectedKarung || '?'}` : "Pilih Expedisi"}
        </p>
        <p className="text-sm opacity-80">
          No Karung (Last: {isLoadingKarungSummary ? "..." : lastKarung}, Highest: {isLoadingKarungSummary ? "..." : highestKarung})
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div>
            <label htmlFor="expedition" className="block text-left text-sm font-medium mb-2">
              Expedisi
            </label>
            <Select onValueChange={setExpedition} value={expedition}>
              <SelectTrigger className="w-full bg-white text-gray-800">
                <SelectValue placeholder="Pilih Expedisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JNE">JNE</SelectItem>
                <SelectItem value="SPX">SPX</SelectItem>
                <SelectItem value="INSTAN">INSTAN</SelectItem>
                <SelectItem value="ID">ID</SelectItem>
                <SelectItem value="SICEPAT">SICEPAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="no-karung" className="block text-left text-sm font-medium mb-2">
              No Karung
            </label>
            <Select onValueChange={setSelectedKarung} value={selectedKarung} disabled={!expedition || isLoadingKarungSummary}>
              <SelectTrigger className="w-full bg-white text-gray-800">
                <SelectValue placeholder="Pilih No Karung" />
              </SelectTrigger>
              <SelectContent>
                {karungOptions.map((num) => (
                  <SelectItem key={num} value={num}>{num}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="scan-resi" className="block text-left text-sm font-medium mb-2">
              Scan Resi
            </label>
            <Input
              id="scan-resi"
              type="text"
              placeholder="Scan nomor resi"
              value={resiNumber}
              onChange={(e) => setResiNumber(e.target.value)}
              className="w-full bg-white text-gray-800"
            />
          </div>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default InputPage;