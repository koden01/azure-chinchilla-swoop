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

const InputPage = () => {
  const [expedition, setExpedition] = React.useState<string>("");
  const [resiNumber, setResiNumber] = React.useState<string>("");

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg shadow-md text-white text-center space-y-4">
        <h2 className="text-2xl font-semibold">Input Data Resi</h2>
        <div className="text-6xl font-bold">0</div>
        <p className="text-xl">SPX - Karung 0</p>
        <p className="text-sm opacity-80">No Karung (Last 0, Highest 4)</p>

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